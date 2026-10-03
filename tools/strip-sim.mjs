// Mathematik der festen Walzenstreifen: exakte Basisspiel-Auswertung über alle Stoppkombinationen und
// Monte-Carlo der Freispiele (mit gehaltenen Walzen). Gemeinsam benutzt von tools/calibrate-strips.mjs und den Unit-Tests.
// Regeln wie in js/game/flow.js: Linien von links, Joker ersetzt alles außer Bonus, Bonus/Klee überall (auf gehaltenen
// Walzen zählen sie nicht), Klebe-Joker halten ihre Walze, Retrigger addiert, Glücksrad ab WHEEL_MIN Klee.
import { CLOVER, COLS, DIAMOND, FS_AWARD, FS_MULT, JOKER, PAY, ROWS, SCATTER, WHEEL, WHEEL_MIN } from '../js/core/config.js';
import { buildLines, evaluate, heldReels } from '../js/core/lines.js';
import { seededRandom } from '../js/core/rng.js';
import { REEL_STRIPS, matrixFromStops } from '../js/core/strips.js';

/** Standard: alle drei Paare = 10 Linien. */
export const LINES10 = buildLines([false, false, false, false], [true, true, true]);
export const WHEEL_MEAN = WHEEL.reduce((a, b) => a + b, 0) / WHEEL.length;

/**
 * Schnelle Linienauswertung (gleiche Regeln wie lines.evaluate, ohne Objekte). Liefert Summe der Linienquoten und Jackpot.
 * @param {number[][]} m
 * @param {number[][]} pats  Linienmuster
 * @param {number[][]} [pay]
 */
export function fastLines(m, pats, pay = PAY){
  let total = 0, jackpot = false;
  for (let li = 0; li < pats.length; li++){
    const p = pats[li];
    const s0 = m[p[0]][0], s1 = m[p[1]][1], s2 = m[p[2]][2], s3 = m[p[3]][3], s4 = m[p[4]][4];
    const seq = [s0, s1, s2, s3, s4];
    let best = 0, jk = 0;
    while (jk < 5 && seq[jk] === JOKER) jk++;
    if (jk >= 3) best = pay[JOKER][jk - 3];
    if (jk < 5){
      const base = seq[jk];
      if (base !== SCATTER){
        let k = jk; while (k < 5 && (seq[k] === base || seq[k] === JOKER)) k++;
        if (base === DIAMOND && k === 5){ jackpot = true; best = 0; }
        else if (k >= 3 && pay[base][k - 3] > best) best = pay[base][k - 3];
      }
    }
    total += best;
  }
  return { total, jackpot };
}

/**
 * Exakte Basisspiel-Kennzahlen über alle STRIP_LEN^5 Stoppkombinationen (gleichverteilte Stopps).
 * Quoten relativ zum Gesamteinsatz (= Anzahl Linien × 1).
 * @param {{ strips?: number[][], lines?: { pat: number[] }[], pay?: number[][] }} [o]
 */
export function exactBase({ strips = REEL_STRIPS, lines = LINES10, pay = PAY } = {}){
  const n = strips[0].length, pats = lines.map(l => l.pat), L = pats.length;
  // Spalten vorberechnen: col[c][p] = sichtbare 4 Symbole
  const cols = strips.map(s => Array.from({ length: n }, (_, p) => Array.from({ length: ROWS }, (_, r) => s[(p + r) % n])));
  const cnt = (/** @type {number[]} */ col, /** @type {number} */ v) => col.reduce((a, x) => a + (x === v ? 1 : 0), 0);
  const m = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  let N = 0, lineSum = 0, lineSq = 0, hits = 0, jp = 0, fs = 0, wheel = 0, anyHit = 0;
  /** @type {number[]} */
  const fsBy = Array(21).fill(0);
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) for (let c = 0; c < n; c++) for (let d = 0; d < n; d++) for (let e = 0; e < n; e++){
    const st = [a, b, c, d, e];
    let sc = 0, cl = 0;
    for (let col = 0; col < COLS; col++){
      const cc = cols[col][st[col]];
      for (let r = 0; r < ROWS; r++) m[r][col] = cc[r];
      sc += cnt(cc, SCATTER); cl += cnt(cc, CLOVER);
    }
    const res = fastLines(m, pats, pay);
    N++; lineSum += res.total; lineSq += res.total * res.total;
    if (res.total > 0) hits++;
    if (res.jackpot) jp++;
    fsBy[sc]++;
    if (FS_AWARD(sc)) fs++;
    if (cl >= WHEEL_MIN) wheel++;
    if (res.total > 0 || res.jackpot || FS_AWARD(sc) || cl >= WHEEL_MIN) anyHit++;
  }
  return {
    combos: N, rtpLines: lineSum / N / L, lineHit: hits / N, pJackpot: jp / N, pFs: fs / N, pWheel: wheel / N, anyHit: anyHit / N,
    rtpWheel: wheel / N * WHEEL_MEAN, lineSd: Math.sqrt(lineSq / N - (lineSum / N) ** 2) / L, fsBy: fsBy.map(x => x / N)
  };
}

/**
 * Eine Bonusrunde (ab Auslösung) simulieren. Gewinne relativ zum Gesamteinsatz (Einsatz pro Linie 1).
 * @param {() => number} rnd
 * @param {{ strips?: number[][], lines?: { pat: number[] }[], award?: number }} o
 */
export function simFreeRound(rnd, { strips = REEL_STRIPS, lines = LINES10, award = 3 }){
  const n = strips[0].length, L = lines.length;
  let left = award, win = 0, spins = 0, jp = 0, wheels = 0, retrig = 0;
  /** @type {number[]} */
  const sticky = [];
  let stops = [0, 0, 0, 0, 0];
  while (left > 0){
    left--; spins++;
    const held = heldReels(sticky);
    stops = stops.map((p, c) => held[c] ? p : Math.floor(rnd() * n));
    const m = matrixFromStops(stops, strips);
    const res = evaluate(m, /** @type {any} */ (lines));
    const sc = res.scatter.cells.filter(({ c }) => !held[c]).length;
    const cl = res.clover.cells.filter(({ c }) => !held[c]).length;
    win += res.lineTotal * FS_MULT / L;
    if (res.jackpot) jp++;
    m.forEach((row, r) => row.forEach((v, c) => { const k = r * COLS + c; if (v === JOKER && !sticky.includes(k)) sticky.push(k); }));
    if (cl >= WHEEL_MIN){ wheels++; win += WHEEL[Math.floor(rnd() * WHEEL.length)]; }
    const add = FS_AWARD(sc); if (add){ left += add; retrig++; }
  }
  return { win, spins, jp, wheels, retrig, held: heldReels(sticky).filter(Boolean).length };
}

/**
 * Vollständige Monte-Carlo-Simulation (Basisspiel + Freispiele + Glücksrad), seed-fest.
 * Quoten relativ zum Gesamteinsatz; Jackpot separat gezählt (Topf, nicht in der Quote).
 * @param {{ strips?: number[][], lines?: { pat: number[] }[], spins?: number, seed?: number }} [o]
 */
export function simulate({ strips = REEL_STRIPS, lines = LINES10, spins = 1e6, seed = 1 } = {}){
  const rnd = seededRandom(seed), n = strips[0].length, L = lines.length;
  let won = 0, sq = 0, lineWon = 0, fsWon = 0, wheelWon = 0, fsTrig = 0, wheels = 0, jp = 0, hits = 0, lineHits = 0, fsSpins = 0, maxWin = 0;
  for (let i = 0; i < spins; i++){
    const stops = Array.from({ length: COLS }, () => Math.floor(rnd() * n));
    const m = matrixFromStops(stops, strips);
    const res = evaluate(m, /** @type {any} */ (lines));
    let w = res.lineTotal / L;
    lineWon += w;
    if (res.lineTotal > 0) lineHits++;
    if (res.jackpot) jp++;
    if (res.clover.count >= WHEEL_MIN){ wheels++; const x = WHEEL[Math.floor(rnd() * WHEEL.length)]; w += x; wheelWon += x; }
    const award = FS_AWARD(res.scatter.count);
    if (award){
      fsTrig++;
      const fr = simFreeRound(rnd, { strips, lines, award });
      w += fr.win; fsWon += fr.win; fsSpins += fr.spins; jp += fr.jp; wheels += fr.wheels;
    }
    if (w > 0 || res.jackpot) hits++;
    won += w; sq += w * w; if (w > maxWin) maxWin = w;
  }
  const mean = won / spins;
  return {
    spins, rtp: mean, rtpLines: lineWon / spins, rtpFs: fsWon / spins, rtpWheel: wheelWon / spins,
    fsRate: fsTrig / spins, wheelRate: wheels / spins, jpRate: jp / spins, hitRate: hits / spins, lineHitRate: lineHits / spins,
    fsSpinsPerTrigger: fsTrig ? fsSpins / fsTrig : 0, fsPerTrigger: fsTrig ? fsWon / fsTrig : 0,
    sd: Math.sqrt(sq / spins - mean * mean), maxWin
  };
}
