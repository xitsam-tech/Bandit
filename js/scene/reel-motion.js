/**
 * Walzen-Animation: Anlauf, Lauf, Abbremsen mit Nachfedern, Lande-Effekte, Spannung.
 * Die Walzen tragen feste Streifen; jede drehende Walze läuft genau bis zu ihrer Ziel-Stoppposition.
 * Dazu plant jede Walze im Lauf ihr Ziel j (ganzzahlige Walzenstellung mit Stoppposition = Ziel) und gleicht
 * die Laufgeschwindigkeit leicht an (±25 %), damit das Abbremsen zur geplanten Zeit an der richtigen Stelle beginnt.
 * Nach dem Stopp der letzten Walze wird game/flow.settle() aufgerufen – ein bewusster Funktions-Zyklus
 * mit game/flow.js (beim Laden der Module wird davon nichts benutzt).
 */
import { Snd } from '../audio/sound.js';
import { CLOVER, COLS, DIAMOND, ROWS, SCATTER } from '../core/config.js';
import { rt } from '../core/runtime.js';
import { S } from '../core/state.js';
import { matrixFromStops } from '../core/strips.js';
import { now } from '../core/util.js';
import { buzz, reducedMotion } from '../dom.js';
import { settle } from '../game/flow.js';
import { BASE_EMISSIVE, N, STEP } from './constants.js';
import { reels } from './context.js';
import { nextStopAt, slotFor } from './reels.js';

/* =========================================================
   Walzen-Animation
   ========================================================= */
const VMAX = 25, ACC_T = 0.42, C1 = 0.75, WIND = 190;
const V_LO = 0.7, V_HI = 1.35;   // erlaubte Anpassung der Laufgeschwindigkeit beim Planen
const BRAKE_D = 6.2, TURBO_V = 1.25, TURBO_D = 5.0;   // Bremsweg (Felder); Turbo: schnellerer Lauf, kürzerer Bremsweg
const TENSE_V = 0.55, TENSE_D = 7.2;   // Spannung: Kriechtempo (Anteil von VMAX) und längerer Bremsweg
const easeOutBackC = x => 1 + (C1 + 1) * Math.pow(x - 1, 3) + C1 * Math.pow(x - 1, 2);
const easeOutBackD = x => 3 * (C1 + 1) * Math.pow(x - 1, 2) + 2 * C1 * (x - 1);
const LATE_W = 1.5;   // Planung: Verspätung zählt stärker als ein etwas früherer Stopp
let pendingMatrix = null, landCount = { scatter:0, clover:0, diamond:0 }, quickStopped = false, minGap = 0;

/**
 * Walzen starten. Gehaltene Walzen bleiben stehen; alle anderen laufen zu `targets[c]`.
 * @param {number[]} targets  Ziel-Stopppositionen (gehaltene Walzen: ihre aktuelle Position)
 * @param {boolean[]} [held]
 */
export function startReels(targets, held = []){
  pendingMatrix = matrixFromStops(targets); quickStopped = false; landCount = { scatter:0, clover:0, diamond:0 };
  const t = now();
  const base = S.turbo ? 280 : reducedMotion() ? 380 : 760, gap = S.turbo ? 95 : reducedMotion() ? 130 : 270;
  minGap = gap * 0.6;
  reels.forEach((reel, c) => {
    reel.held = !!held[c]; reel.target = targets[c]; reel.plan = null;
    if (reel.held){ reel.s = Math.round(reel.s); reel.phase = 'idle'; reel.tense = false; return; }
    reel.s = Math.round(reel.s); reel.s0 = reel.s; reel.phase = 'windup'; reel.t0 = t + c * (S.turbo ? 20 : 60); reel.wind = S.turbo ? 90 : WIND;
    reel.stopAt = t + base + c * gap; reel.tense = false; reel.v = 0; reel.lastT = t; reel.bounce = 0;
    reel.slots.forEach(sl => { sl.landFlash = 0; });
  });
}
export function quickStop(){
  quickStopped = true; minGap = 70;
  const t = now();
  reels.forEach(r => { if (r.phase !== 'idle' && r.phase !== 'decel'){ r.stopAt = Math.min(r.stopAt, t); r.plan = null; } r.tense = false; });
}
/**
 * Abbremsbeginn planen: Ziel j (ganzzahlige Walzenstellung mit der Ziel-Stoppposition) und Bremsbeginn tb.
 * Für jedes Ziel ergibt die erlaubte Laufgeschwindigkeit (V_LO…V_HI) ein Zeitfenster für tb; gewählt wird das Ziel,
 * dessen Fenster der Wunschzeit stopAt am nächsten liegt – auch etwas früher, damit die Walze im Mittel nicht auf ihre
 * Bremsstelle warten muss. tb liegt nie vor dem Bremsbeginn der linken Nachbarwalze + minGap (gestaffelte Stopps).
 * Liefert null, solange die linke Walze noch nicht geplant hat.
 */
function planStop(c, t){
  const reel = reels[c];
  let prevTb = -Infinity;
  for (let i = c - 1; i >= 0; i--){
    const p = reels[i];
    if (p.held) continue;
    if (p.phase === 'decel') prevTb = p.tD; else if (p.phase !== 'idle'){ if (!p.plan) return null; prevTb = p.plan.tb; }
    break;
  }
  const vT = cruiseV(reel), D = brakeDist(reel);
  // Im Anlauf (v = vC · smoothstep) entspricht der Weg bis zum Bremsbeginn vC · (tb − tA − Anlaufdauer/2)
  const t0 = reel.phase === 'accel' ? reel.tA + accDur() / 2 : t;
  // Wunschzeit stopAt; eine verspätete linke Walze holen die rechten über den Mindestabstand minGap wieder auf
  const lo = Math.max(t + 60, prevTb + minGap), want = Math.max(reel.stopAt, lo);
  let pick = null;
  for (let j = nextStopAt(reel.s + D + 0.5, reel.target), k = 0; k < 64; k++, j += N){
    const d = j - D - reel.s, early = t0 + d / (vT * V_HI) * 1000, late = t0 + d / (vT * V_LO) * 1000;
    if (late < lo) continue;                                   // zu nah: selbst langsam vor der linken Walze
    const tb = Math.min(late, Math.max(early, want)), cost = tb > want ? (tb - want) * LATE_W : want - tb;
    if (!pick || cost < pick.cost) pick = { j, tb, cost };
    if (early >= want) break;                                  // weitere Ziele liegen nur noch später
  }
  const d = pick.j - D - reel.s;
  return { j: pick.j, sDec: pick.j - D, tb: pick.tb, vC: Math.min(vT * V_HI, Math.max(vT * V_LO, d / Math.max(0.05, (pick.tb - t0) / 1000))) };
}
/** Dauer des Anlaufs in ms. */
const accDur = () => ACC_T * 1000 * (S.turbo ? 0.6 : 1);
/** Laufgeschwindigkeit (Turbo schneller, Spannung kriecht). */
const cruiseV = reel => (reel.tense ? VMAX * TENSE_V : S.turbo ? VMAX * TURBO_V : VMAX);
/** Bremsweg in Feldern (Turbo kürzer, Spannung länger). */
const brakeDist = reel => (reel.tense ? TENSE_D : S.turbo ? TURBO_D : BRAKE_D);

export function updateReels(t){
  let moving = false, speedSum = 0;
  reels.forEach((reel, c) => {
    const dtRaw = Math.max(0, (t - (reel.lastT || t)) / 1000), dtS = Math.min(0.05, dtRaw); reel.lastT = t;
    if (reel.phase === 'idle'){
      // gedämpftes Nachfedern nach dem Stopp
      if (reel.bounce){
        const bt = (t - reel.tStop) / 1000, off = 0.085 * Math.exp(-bt * 8) * Math.sin(bt * 36);
        reel.group.rotation.x = (reel.s - off) * STEP;
        if (bt > 0.7){ reel.bounce = 0; reel.group.rotation.x = reel.s * STEP; }
      }
      return;
    }
    moving = true;
    let v = reel.v || 0;
    if (reel.phase === 'windup'){
      const d = (t - reel.t0) / reel.wind;
      if (d < 0) return;
      const e = Math.min(1, d);
      reel.s = reel.s0 - 0.3 * Math.sin(Math.PI * e);
      v = 0;
      if (e >= 1){
        reel.phase = 'accel'; reel.tA = t; reel.s = reel.s0;
        // schon zu Beginn des Anlaufs planen: das Anlauftempo zählt zur Angleichung (mehr Spielraum, kürzeres Warten)
        reel.plan = planStop(c, t); reel.vC = reel.plan ? reel.plan.vC : VMAX;
      }
    } else if (reel.phase === 'accel'){
      const x = Math.min(1, (t - reel.tA) / accDur());
      v = (reel.vC || VMAX) * x * x * (3 - 2 * x);
      reel.s += v * dtS;
      if (x >= 1) reel.phase = 'cruise';
    } else if (reel.phase === 'cruise'){
      const vT = cruiseV(reel);
      if (!reel.plan) reel.plan = planStop(c, t);
      let target = vT;
      if (reel.plan){
        const left = reel.plan.sDec - reel.s, dtB = Math.max(0.05, (reel.plan.tb - t) / 1000);
        target = Math.min(vT * 1.4, Math.max(vT * 0.6, left / dtB));
      }
      v += (target - v) * Math.min(1, dtS * 9);
      // Weg nach echter Zeit (bis 0,5 s je Bild): bei sehr niedriger Bildrate keine Zeitlupe, der Bremsbeginn liegt ja an einer festen Stelle
      reel.s += v * Math.min(0.5, dtRaw);
      // Bremsbeginn genau an der geplanten Stelle (nie darüber hinaus)
      if (reel.plan && reel.s >= reel.plan.sDec){
        const prev = prevMoving(c);
        if (prev && prev.phase !== 'decel'){ reel.plan.j += N; reel.plan.sDec += N; reel.plan.tb = Math.max(reel.plan.tb, t) + N / vT * 1000; }   // linke Walze noch nicht im Bremsen → eine Runde mehr
        else { reel.s = reel.plan.sDec; beginDecel(reel, t, v, prev); }
      }
    } else if (reel.phase === 'decel'){
      const x = (t - reel.tD) / (reel.TD * 1000);
      if (x >= 1){
        reel.s = reel.j; reel.phase = 'idle'; reel.v = 0; reel.bounce = 1; reel.tStop = t; reel.flash = 1;
        reel.group.rotation.x = reel.s * STEP; reel.blurU.value = 0;
        onReelStop(c);
        return;
      }
      const prev = reel.s;
      reel.s = reel.sD + reel.dist * easeOutBackC(x);
      v = Math.max(0, reel.dist * easeOutBackD(x) / reel.TD);
      if (Math.floor(reel.s) !== Math.floor(prev) && v < 16) Snd.ratchet(c, v / VMAX);
    }
    reel.v = v;
    reel.blurU.value = reducedMotion() ? 0 : Math.min(0.6, Math.max(0, (v - 2.5) / VMAX) * 0.65);
    reel.group.rotation.x = reel.s * STEP;
    speedSum += v;
  });
  if (moving || Snd.loop) Snd.spinLoop(moving ? speedSum / (VMAX * COLS) : 0);
  return moving;
}
/** Nächste noch laufende Walze links von c (gehaltene und stehende zählen nicht). */
function prevMoving(c){
  for (let i = c - 1; i >= 0; i--){ const p = reels[i]; if (!p.held && p.phase !== 'idle') return p; }
  return null;
}
function beginDecel(reel, t, v, prev){
  reel.sD = reel.s; reel.j = reel.plan.j; reel.dist = reel.j - reel.sD;
  reel.TD = reel.dist * (C1 + 3) / Math.max(4, v); reel.tD = t; reel.phase = 'decel';
  // Landung nie vor der linken Nachbarwalze (gestaffelt): notfalls etwas sanfter abbremsen
  if (prev) reel.TD = Math.max(reel.TD, (prev.tD + prev.TD * 1000 + minGap - t) / 1000);
  checkTension(reels.indexOf(reel), t);
}
// Lande-Blitz, Spannungs-Schimmer und Glanz besonderer Symbole
export function updateFlashes(t, dt){
  const fsCtx = S.freeSpins > 0 || (rt.spinCtx && rt.spinCtx.free);
  reels.forEach((reel, c) => {
    // 💥/🍀 auf gehaltenen Walzen sind nicht neu gelandet → zählen nicht, daher deutlich abgedunkelt
    for (let r = 0; r < ROWS; r++){
      const sl = slotFor(c, r), stale = fsCtx && reel.held && (sl.sid === SCATTER || sl.sid === CLOVER);
      if (stale && !sl.stale){ sl.stale = true; sl.mat.color.setScalar(0.28); }
      else if (!stale && sl.stale){ sl.stale = false; sl.mat.color.setScalar(0.88); }
    }
    reel.flash = Math.max(0, (reel.flash || 0) - dt * 3.2);
    const tense = reel.tense && reel.phase !== 'idle' ? 0.25 + 0.25 * Math.sin(t / 55) : 0;
    reel.slots.forEach(sl => {
      if (sl.win) return;
      sl.landFlash = Math.max(0, (sl.landFlash || 0) - dt * 1.6);
      sl.mat.emissiveIntensity = BASE_EMISSIVE + reel.flash * 0.28 + tense + sl.landFlash * 0.9;
    });
  });
}
/**
 * Spannung: Stehen auf den Walzen bis c (inkl. der gerade bremsenden) schon 2 Bonus-Symbole fest, kriechen die restlichen
 * Walzen länger. Geprüft beim Bremsbeginn, weil das Ziel dann feststeht – beim Landen wären die rechten Walzen schon im Bremsen.
 */
function checkTension(c, t){
  if (c >= COLS - 1 || reducedMotion() || quickStopped) return;
  let sc = 0; for (let cc = 0; cc <= c; cc++) if (!reels[cc].held) for (let r = 0; r < ROWS; r++) if (pendingMatrix[r][cc] === SCATTER) sc++;
  if (sc < 2) return;
  let k = 0;
  reels.forEach((rl, i) => { if (i > c && !rl.tense && rl.phase !== 'idle' && rl.phase !== 'decel'){ rl.stopAt = Math.max(rl.stopAt, t + 600 + k * 750); rl.tense = true; rl.plan = null; k++; } });
  if (k) Snd.tension();
}
function onReelStop(c){
  Snd.stop(c);
  for (let r = 0; r < ROWS; r++){
    const sid = pendingMatrix[r][c];
    const kind = sid === SCATTER ? 'scatter' : sid === CLOVER ? 'clover' : sid === DIAMOND ? 'diamond' : null;
    if (!kind) continue;
    Snd.land(kind, landCount[kind]++, c);
    slotFor(c, r).landFlash = 1;
  }
  if (reels.every(r => r.phase === 'idle')){ rt.shake = Math.max(rt.shake, 0.03); buzz(10); settle(); }
}
