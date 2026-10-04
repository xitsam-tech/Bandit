// Kalibrierung der festen Walzenstreifen (seed-fest, reproduzierbar).
//
//   node tools/calibrate-strips.mjs                 Kennzahlen der aktuellen REEL_STRIPS (exakt + Monte Carlo)
//   node tools/calibrate-strips.mjs --legacy        Kennzahlen des früheren Modells (Einzelsymbole nach Gewichten)
//   node tools/calibrate-strips.mjs --search        Streifen suchen (Zusammensetzung + Reihenfolge), beste ausgeben
//   Optionen: --seed=1  --spins=2000000; Suche: --ev=0.6 --hit=0.022 --rtp=0.892 --any=0.25 --restarts=8 --arr=10 --steps=1500
//
// Basisspiel (Linien, Freispiel-/Rad-Auslösung, Jackpot) wird über alle STRIP_LEN^5 Stoppkombinationen exakt ausgewertet;
// die Freispiele (Klebe-Joker halten Walzen, Retrigger, Rad) per Monte Carlo. Quoten relativ zum Gesamteinsatz,
// ohne Jackpot-Topf (der wird mit 5 % jedes Einsatzes gespeist und kommt obendrauf).
import { CLOVER, COLS, DIAMOND, FS_AWARD, FS_MULT, JOKER, ROWS, SCATTER, SYMBOLS, WHEEL, WHEEL_MIN } from '../js/core/config.js';
import { evaluate, heldReels } from '../js/core/lines.js';
import { seededRandom } from '../js/core/rng.js';
import { REEL_STRIPS, STRIP_LEN, checkStrips } from '../js/core/strips.js';
import { LINES10, exactBase, fastLines, simFreeRound, simulate } from './strip-sim.mjs';

const arg = (/** @type {string} */ k, /** @type {number} */ d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? +a.split('=')[1] : d; };
const SEED = arg('seed', 1), SPINS = arg('spins', 2e6);
/** Gewichte des früheren Modells (jede Zelle unabhängig gezogen), nur zum Vergleich. */
const LEGACY_WEIGHTS = [16, 16, 13, 13, 10, 8, 6, 3, 3, 4, 3, 2, 5];
/** Früher: Klebe-Joker wurden in die Matrix geschrieben. @param {number[][]} m @param {number[]} keys */
const applyStickyLegacy = (m, keys) => keys.forEach(k => { m[Math.floor(k / COLS)][k % COLS] = JOKER; });
const pct = (/** @type {number} */ x, d = 2) => (x * 100).toFixed(d) + ' %';

/** Früheres Modell: jede Zelle unabhängig nach LEGACY_WEIGHTS, gehaltene Walzen behalten ihre Spalte, Klebe-Joker überschreiben. */
function simulateLegacy(spins, seed){
  const rnd = seededRandom(seed), tot = LEGACY_WEIGHTS.reduce((a, b) => a + b, 0), L = LINES10.length;
  const sample = () => { let r = rnd() * tot; for (let i = 0; i < LEGACY_WEIGHTS.length; i++){ r -= LEGACY_WEIGHTS[i]; if (r < 0) return i; } return 0; };
  const fresh = () => Array.from({ length: ROWS }, () => Array.from({ length: COLS }, sample));
  let won = 0, sq = 0, lineWon = 0, fsWon = 0, wheelWon = 0, fsTrig = 0, wheels = 0, jp = 0, hits = 0, lineHits = 0;
  for (let i = 0; i < spins; i++){
    const m = fresh(), res = evaluate(m, LINES10);
    let w = res.lineTotal / L; lineWon += w;
    if (res.lineTotal > 0) lineHits++;
    if (res.jackpot) jp++;
    if (res.clover.count >= WHEEL_MIN){ wheels++; const x = WHEEL[Math.floor(rnd() * WHEEL.length)]; w += x; wheelWon += x; }
    let left = FS_AWARD(res.scatter.count);
    if (left){
      fsTrig++;
      /** @type {number[]} */ const sticky = []; let prev = m;
      while (left > 0){
        left--;
        const held = heldReels(sticky), mm = fresh();
        for (let c = 0; c < COLS; c++) if (held[c]) for (let r = 0; r < ROWS; r++) mm[r][c] = prev[r][c];
        applyStickyLegacy(mm, sticky);
        const rr = evaluate(mm, LINES10);
        const sc = rr.scatter.cells.filter(({ c }) => !held[c]).length, cl = rr.clover.cells.filter(({ c }) => !held[c]).length;
        let fw = rr.lineTotal * FS_MULT / L;
        if (rr.jackpot) jp++;
        mm.forEach((row, r) => row.forEach((v, c) => { const k = r * COLS + c; if (v === JOKER && !sticky.includes(k)) sticky.push(k); }));
        if (cl >= WHEEL_MIN){ wheels++; fw += WHEEL[Math.floor(rnd() * WHEEL.length)]; }
        left += FS_AWARD(sc); prev = mm; fsWon += fw; w += fw;
      }
    }
    if (w > 0 || res.jackpot) hits++;
    won += w; sq += w * w;
  }
  const mean = won / spins;
  return { spins, rtp: mean, rtpLines: lineWon / spins, rtpFs: fsWon / spins, rtpWheel: wheelWon / spins, fsRate: fsTrig / spins,
    wheelRate: wheels / spins, jpRate: jp / spins, hitRate: hits / spins, lineHitRate: lineHits / spins, sd: Math.sqrt(sq / spins - mean * mean) };
}

/**
 * Bonusrunden-Erwartung je Auslösung per Monte Carlo, gewichtet nach der exakten Verteilung der Bonus-Anzahl
 * (3 / 4 / 5 Bonus → FS_AWARD 3 / 5 / 8 Freispiele).
 * @param {number[][]} strips @param {number[]} fsBy  Wahrscheinlichkeit je Bonus-Anzahl (aus exactBase)
 */
function fsValue(strips, fsBy, rounds, seed){
  const rnd = seededRandom(seed), pFs = fsBy.reduce((a, x, n) => a + (FS_AWARD(n) ? x : 0), 0);
  let w = 0, s = 0;
  for (let n = 3; n < fsBy.length; n++){
    const share = fsBy[n] / pFs, k = Math.round(rounds * share);
    if (!FS_AWARD(n) || !k) continue;
    let wn = 0, sn = 0;
    for (let i = 0; i < k; i++){ const r = simFreeRound(rnd, { strips, award: FS_AWARD(n) }); wn += r.win; sn += r.spins; }
    w += share * wn / k; s += share * sn / k;
  }
  return { perTrigger: w, spins: s };
}

function report(){
  const err = checkStrips();
  if (err.length) console.log('WARNUNG Streifen:', err);
  console.log('Streifen (oben → unten):');
  REEL_STRIPS.forEach((s, c) => console.log(`  Walze ${c + 1}: ${s.map(v => SYMBOLS[v].name).join(', ')}`));
  const ex = exactBase();
  console.log(`\nExakt über ${ex.combos} Stoppkombinationen (10 Linien):`);
  console.log(`  Linienquote ${pct(ex.rtpLines)}, Linientreffer ${pct(ex.lineHit)}, Treffer inkl. Features ${pct(ex.anyHit)}`);
  console.log(`  Freispiel-Auslöser ${pct(ex.pFs, 3)} (1 von ${(1 / ex.pFs).toFixed(1)}), Glücksrad ${pct(ex.pWheel, 3)} → ${pct(ex.rtpWheel)} Quote`);
  console.log(`  Jackpot ${ex.pJackpot.toExponential(3)} je Dreh (1 von ${Math.round(1 / ex.pJackpot)}), Bonus-Verteilung: ` + ex.fsBy.slice(0, 6).map((x, i) => `${i}:${pct(x, 3)}`).join(' '));
  console.log(`  Freispiel-Stufen: 3 Bonus 1 von ${(1 / ex.fsBy[3]).toFixed(0)}, 4 Bonus 1 von ${(1 / ex.fsBy[4]).toFixed(0)}, 5 Bonus 1 von ${(1 / ex.fsBy[5]).toFixed(0)}`);
  const fv = fsValue(REEL_STRIPS, ex.fsBy, 400000, SEED);
  console.log(`  Bonusrunde (MC 400k): ${fv.perTrigger.toFixed(3)}× Gesamteinsatz je Auslösung, ${fv.spins.toFixed(2)} Freispiele`);
  console.log(`  ⇒ Quote ohne Jackpot (exakt + MC-Bonus): ${pct(ex.rtpLines + ex.rtpWheel + ex.pFs * fv.perTrigger)}`);
  const t0 = Date.now(), mc = simulate({ spins: SPINS, seed: SEED });
  console.log(`\nMonte Carlo, ${SPINS} Drehungen, Seed ${SEED} (${((Date.now() - t0) / 1000).toFixed(1)} s):`);
  printMc(mc);
}
function printMc(/** @type {any} */ mc){
  console.log(`  Quote ohne Jackpot ${pct(mc.rtp)} = Linien ${pct(mc.rtpLines)} + Freispiele ${pct(mc.rtpFs)} + Glücksrad ${pct(mc.rtpWheel)}`);
  console.log(`  Freispiel-Auslöser ${pct(mc.fsRate, 3)}, Glücksrad ${pct(mc.wheelRate, 3)} (inkl. in Freispielen), Jackpot 1 von ${mc.jpRate ? Math.round(1 / mc.jpRate) : '∞'}`);
  console.log(`  Trefferquote ${pct(mc.hitRate)} (nur Linien ${pct(mc.lineHitRate)}), Standardabweichung ${mc.sd.toFixed(2)}× Einsatz${mc.maxWin ? `, Höchstgewinn ${mc.maxWin.toFixed(1)}×` : ''}`);
  if (mc.fsPerTrigger) console.log(`  Bonusrunde: ${mc.fsPerTrigger.toFixed(2)}× je Auslösung, ${mc.fsSpinsPerTrigger.toFixed(2)} Freispiele`);
}

/* ---------- Suche ---------- */
// Aufbau (22 Felder): Bonus auf jeder Walze (je 1 → 3, 4 und 5 Bonus erreichbar), Klee auf jeder Walze, auf Walze 3 und 5
// doppelt (Glücksrad ≈ 1,4 %), Diamant auf jeder Walze, Joker auf Walze 2–5 (je 1). Die 9 normalen Symbole füllen den
// Rest (je Walze 1–5×). Mit 4 sichtbaren von 22 Feldern ist ein Symbol in 4/22 der Stopps zu sehen; fünf Bonus-Walzen
// ergeben deshalb zwangsläufig ≈ 4,5 % Freispiel-Auslöser (≥ 3 von 5).
export const SPECIALS = [
  [SCATTER, CLOVER, DIAMOND],
  [SCATTER, CLOVER, JOKER, DIAMOND],
  [SCATTER, CLOVER, CLOVER, JOKER, DIAMOND],
  [SCATTER, CLOVER, JOKER, DIAMOND],
  [SCATTER, CLOVER, CLOVER, JOKER, DIAMOND]
];
const MAX_COPIES = 5, CLIMB_STEPS = arg('steps', 1500);

/** Erwartete Linienquote und Trefferwahrscheinlichkeit EINER Linie aus den Symbolhäufigkeiten (reihenfolgeunabhängig). */
function lineStats(/** @type {number[][]} */ counts){
  const q = counts.map((cnt, c) => {
    /** @type {Map<number, number>} */ const m = new Map();
    SPECIALS[c].forEach(x => m.set(x, (m.get(x) || 0) + 1 / STRIP_LEN));
    cnt.forEach((k, x) => { if (k) m.set(x, (m.get(x) || 0) + k / STRIP_LEN); });
    return [...m];
  });
  let ev = 0, hit = 0; const row = [0, 0, 0, 0, 0];
  const rec = (/** @type {number} */ c, /** @type {number} */ p) => {
    if (c === COLS){ const r = fastLines([row], [[0, 0, 0, 0, 0]]); ev += p * r.total; if (r.total > 0) hit += p; return; }
    for (const [x, w] of q[c]){ row[c] = x; rec(c + 1, p * w); }
  };
  rec(0, 1);
  return { ev, hit };
}
/** Zusammensetzung per Bergsteigen: Linienquote ≈ targetEv, Linientreffer möglichst hoch. */
function climb(/** @type {() => number} */ rnd, /** @type {number} */ targetEv, /** @type {number} */ targetHit){
  const counts = SPECIALS.map(sp => {
    const c = Array(9).fill(1); let left = STRIP_LEN - sp.length - 9;
    while (left > 0){ const i = Math.floor(rnd() * 9); if (c[i] < MAX_COPIES){ c[i]++; left--; } }
    return c;
  });
  const score = (/** @type {{ ev: number, hit: number }} */ x) => Math.abs(x.ev - targetEv) * 10 + Math.abs(x.hit - targetHit) * 40;
  let cur = lineStats(counts), cs = score(cur);
  for (let it = 0; it < CLIMB_STEPS; it++){
    const c = Math.floor(rnd() * COLS), a = Math.floor(rnd() * 9), b = Math.floor(rnd() * 9);
    if (a === b || counts[c][a] <= 1 || counts[c][b] >= MAX_COPIES) continue;
    counts[c][a]--; counts[c][b]++;
    const x = lineStats(counts), sc = score(x);
    if (sc <= cs){ cur = x; cs = sc; } else { counts[c][a]++; counts[c][b]--; }
  }
  return { counts, ...cur, score: cs };
}
/**
 * Zufällige Anordnung per Tiefensuche: gleiche Symbole nie im selben 4er-Fenster (zyklisch, also auch nie benachbart),
 * Sonder-Symbole (Bonus, Joker, Diamant, Klee) zusätzlich nie zu zweit im selben Fenster – keine Klumpen.
 */
function arrange(/** @type {number[]} */ bag, /** @type {() => number} */ rnd){
  const special = (/** @type {number} */ v) => v === SCATTER || v === JOKER || v === DIAMOND || v === CLOVER;
  const n = bag.length, out = /** @type {number[]} */ ([]), left = new Map();
  bag.forEach(v => left.set(v, (left.get(v) || 0) + 1));
  const clash = (/** @type {number} */ a, /** @type {number} */ b) => a === b || (special(a) && special(b));
  const fits = (/** @type {number} */ v, /** @type {number} */ i) => {
    for (let d = 1; d < ROWS; d++){
      if (i - d >= 0 && clash(out[i - d], v)) return false;
      if (i + d >= n && clash(out[i + d - n], v)) return false;   // Umlauf zum Streifenanfang
    }
    return true;
  };
  let budget = 20000;
  const rec = (/** @type {number} */ i) => {
    if (i === n) return true;
    if (--budget < 0) return false;
    // Reihenfolge der Kandidaten: zufällig, gewichtet nach Restanzahl (häufige eher früher, sonst bleiben am Ende Dubletten)
    const opts = [...left.keys()].filter(v => left.get(v) > 0 && fits(v, i))
      .map(v => ({ v, key: Math.pow(rnd(), 1 / /** @type {number} */ (left.get(v))) })).sort((a, b) => b.key - a.key).map(o => o.v);
    for (const v of opts){
      out[i] = v; left.set(v, left.get(v) - 1);
      if (rec(i + 1)) return true;
      left.set(v, left.get(v) + 1);
    }
    return false;
  };
  for (let t = 0; t < 50; t++){ budget = 20000; out.length = 0; if (rec(0)) return out.slice(); }
  return null;
}
function search(){
  const rnd = seededRandom(SEED), targetEv = arg('ev', 0.6), targetHit = arg('hit', 0.022), restarts = arg('restarts', 8), arrangements = arg('arr', 10);
  const targetRtp = arg('rtp', 0.892), targetAny = arg('any', 0.25);
  // 1) Zusammensetzung
  let best = null;
  for (let i = 0; i < restarts; i++){ const r = climb(rnd, targetEv, targetHit); if (!best || r.score < best.score) best = r; }
  console.log('Zusammensetzung (Anzahl Kirsche…BAR je Walze):', JSON.stringify(best.counts), `Linienquote ${pct(best.ev)}, Treffer je Linie ${pct(best.hit)}`);
  // 2) Anordnung: Gesamtquote (exakt + MC-Freispiele) möglichst nah am Ziel, Trefferquote nah an ~25 %.
  //    Die Freispiele hängen stark von der Lage der Joker zu Bonus und Gewinnsymbolen ab, daher je Anordnung bewertet.
  let pick = null;
  for (let i = 0; i < arrangements; i++){
    const strips = best.counts.map((cnt, c) => { const bag = SPECIALS[c].slice(); cnt.forEach((k, x) => { for (let n = 0; n < k; n++) bag.push(x); }); return arrange(bag, rnd); });
    if (strips.some(x => !x) || checkStrips(/** @type {number[][]} */ (strips)).length) continue;
    const ex = exactBase({ strips: /** @type {number[][]} */ (strips) }), fv = fsValue(/** @type {number[][]} */ (strips), ex.fsBy, 100000, SEED);
    const rtp = ex.rtpLines + ex.rtpWheel + ex.pFs * fv.perTrigger, score = Math.abs(rtp - targetRtp) * 4 + Math.abs(ex.anyHit - targetAny);
    console.log(`  Anordnung ${i + 1}: Linien ${pct(ex.rtpLines)}, Treffer ${pct(ex.anyHit)}, Bonusrunde ${fv.perTrigger.toFixed(2)}× → Quote ${pct(rtp)}`);
    if (!pick || score < pick.score) pick = { strips, ex, fv, rtp, score };
  }
  if (!pick) throw new Error('keine Anordnung gefunden');
  console.log('Streifen:', JSON.stringify(pick.strips));
  const { ex, fv } = pick;
  console.log(`Linien ${pct(ex.rtpLines)}, Treffer ${pct(ex.anyHit)}, Rad ${pct(ex.rtpWheel)}, Freispiele ${pct(ex.pFs, 3)} × ${fv.perTrigger.toFixed(3)} → Quote ${pct(pick.rtp)}`);
}

if (process.argv.includes('--legacy')){
  console.log(`Früheres Modell (Gewichte ${LEGACY_WEIGHTS.join(',')}), ${SPINS} Drehungen, Seed ${SEED}:`);
  printMc(simulateLegacy(SPINS, SEED));
} else if (process.argv.includes('--search')){
  search();
} else report();
