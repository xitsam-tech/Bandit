/** Walzen-Animation: Anlauf, Lauf, Abbremsen mit Nachfedern, Lande-Effekte, Spannung. */
import { Snd } from '../audio/sound.js';
import { CLOVER, COLS, DIAMOND, ROWS, SCATTER } from '../core/config.js';
import { sampleSymbol } from '../core/rng.js';
import { rt } from '../core/runtime.js';
import { S } from '../core/state.js';
import { now } from '../core/util.js';
import { REDUCED } from '../dom.js';
import { buzz } from '../game/effects.js';
import { settle } from '../game/flow.js';
import { BASE_EMISSIVE, STEP } from './constants.js';
import { reels } from './context.js';
import { applySlot, setSlot, slotFor } from './reels.js';

/* =========================================================
   Walzen-Animation
   ========================================================= */
const VMAX = 22, ACC_T = 0.42, C1 = 0.75, WIND = 190;
const easeOutBackC = x => 1 + (C1 + 1) * Math.pow(x - 1, 3) + C1 * Math.pow(x - 1, 2);
const easeOutBackD = x => 3 * (C1 + 1) * Math.pow(x - 1, 2) + 2 * C1 * (x - 1);
let pendingMatrix = null, landCount = { scatter:0, clover:0, diamond:0 }, quickStopped = false;

export function startReels(matrix, held = []){
  pendingMatrix = matrix; quickStopped = false; landCount = { scatter:0, clover:0, diamond:0 };
  const t = now();
  const base = S.turbo ? 280 : REDUCED ? 380 : 820, gap = S.turbo ? 95 : REDUCED ? 130 : 270;
  reels.forEach((reel, c) => {
    reel.held = !!held[c];
    if (reel.held){ reel.s = Math.round(reel.s); reel.phase = 'idle'; reel.tense = false; for (let r = 0; r < ROWS; r++) setSlot(reel, reel.s + 1 - r, matrix[r][c]); return; }
    reel.s = Math.round(reel.s); reel.s0 = reel.s; reel.phase = 'windup'; reel.t0 = t + c * (S.turbo ? 20 : 60); reel.wind = S.turbo ? 90 : WIND;
    reel.stopAt = t + base + c * gap; reel.tense = false; reel.v = 0; reel.lastT = t; reel.bounce = 0;
    reel.slots.forEach((sl, k) => {
      sl.landFlash = 0;
      const ang = Math.abs(Math.atan2(Math.sin((k + 0.5) * STEP - reel.s * STEP), Math.cos((k + 0.5) * STEP - reel.s * STEP)));
      if (ang > STEP * 2.6){ sl.sid = sampleSymbol(); applySlot(sl); }
    });
  });
}
export function quickStop(){
  quickStopped = true;
  const t = now();
  reels.forEach(r => { if (r.phase !== 'idle' && r.phase !== 'decel') r.stopAt = Math.min(r.stopAt, t); r.tense = false; });
}
export function updateReels(t){
  let moving = false, speedSum = 0;
  reels.forEach((reel, c) => {
    const dtS = Math.min(0.05, Math.max(0, (t - (reel.lastT || t)) / 1000)); reel.lastT = t;
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
      if (e >= 1){ reel.phase = 'accel'; reel.tA = t; reel.s = reel.s0; }
    } else if (reel.phase === 'accel'){
      const x = Math.min(1, (t - reel.tA) / (ACC_T * 1000 * (S.turbo ? 0.6 : 1)));
      v = VMAX * x * x * (3 - 2 * x);
      reel.s += v * dtS;
      if (x >= 1) reel.phase = 'cruise';
    } else if (reel.phase === 'cruise'){
      const target = reel.tense ? VMAX * 0.45 : VMAX;
      v += (target - v) * Math.min(1, dtS * 3);
      reel.s += v * dtS;
      if (t >= reel.stopAt) beginDecel(reel, c, t, v);
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
    reel.blurU.value = REDUCED ? 0 : Math.min(0.6, Math.max(0, (v - 2.5) / VMAX) * 0.65);
    reel.group.rotation.x = reel.s * STEP;
    speedSum += v;
  });
  if (moving || Snd.loop) Snd.spinLoop(moving ? speedSum / (VMAX * COLS) : 0);
  return moving;
}
function beginDecel(reel, c, t, v){
  reel.sD = reel.s; reel.j = Math.ceil(reel.sD + (reel.tense ? 8.2 : 6.2)); reel.dist = reel.j - reel.sD;
  reel.TD = reel.dist * (C1 + 3) / Math.max(4, v); reel.tD = t; reel.phase = 'decel';
  // Zielsymbole landen auf Feldern, die gerade hinter der Walze sind → unsichtbarer Tausch
  for (let r = 0; r < ROWS; r++) setSlot(reel, reel.j + 1 - r, pendingMatrix[r][c]);
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
function onReelStop(c){
  Snd.stop(c);
  for (let r = 0; r < ROWS; r++){
    const sid = pendingMatrix[r][c];
    const kind = sid === SCATTER ? 'scatter' : sid === CLOVER ? 'clover' : sid === DIAMOND ? 'diamond' : null;
    if (!kind) continue;
    Snd.land(kind, landCount[kind]++, c);
    slotFor(c, r).landFlash = 1;
  }
  // Spannung: 2 Bonus-Symbole auf den bisherigen Walzen → restliche Walzen kriechen länger
  if (c < COLS - 1 && !REDUCED){
    let sc = 0; for (let cc = 0; cc <= c; cc++) if (!reels[cc].held) for (let r = 0; r < ROWS; r++) if (pendingMatrix[r][cc] === SCATTER) sc++;
    if (sc >= 2 && !quickStopped){
      const t = now(); let k = 0;
      reels.forEach((rl, i) => { if (i > c && rl.phase !== 'idle' && rl.phase !== 'decel'){ rl.stopAt = Math.max(rl.stopAt, t + 900 + k * 750); rl.tense = true; k++; } });
      if (k) Snd.tension();
    }
  }
  if (reels.every(r => r.phase === 'idle')){ rt.shake = Math.max(rt.shake, 0.03); buzz(10); settle(); }
}
