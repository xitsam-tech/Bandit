/** Gewinnpräsentation auf den Walzen (Hervorhebung, Linien-Durchlauf). */
import { BET_STEPS, COLS, FS_AWARD, FS_MULT, ROWS, SYMBOLS } from '../core/config.js';
import { rt } from '../core/runtime.js';
import { S } from '../core/state.js';
import { fmt, now } from '../core/util.js';
import { Ticker } from '../gfx/ticker.js';
import { BASE_EMISSIVE, rowAngle } from '../scene/constants.js';
import { reels, winFrames } from '../scene/context.js';
import { cellWorld, slotFor } from '../scene/reels.js';

/* ----- Gewinnpräsentation ----- */
export function startPresentation(res, wheelHit){
  const cells = new Set();
  res.wins.forEach(w => w.cells.forEach(({ r, c }) => cells.add(r * COLS + c)));
  if (FS_AWARD(res.scatter.count)) res.scatter.cells.forEach(({ r, c }) => cells.add(r * COLS + c));
  if (wheelHit) res.clover.cells.forEach(({ r, c }) => cells.add(r * COLS + c));
  if (!cells.size){ rt.present = null; return; }
  rt.present = { res, cells, idx:-1, next: now() + 1500, start: now() };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
    const sl = slotFor(c, r), on = cells.has(r * COLS + c);
    sl.mat.color.setScalar(on ? 1 : 0.32); sl.win = on;
    const f = winFrames[r * COLS + c];
    if (on){ f.visible = true; f.position.copy(cellWorld(c, r, 0.16)); f.rotation.set(-rowAngle(r), 0, 0); } else f.visible = false;
  }
}
export function clearPresentation(){
  rt.present = null;
  reels.forEach(reel => reel.slots.forEach(sl => { sl.mat.color.setScalar(0.88); sl.mat.emissiveIntensity = BASE_EMISSIVE; sl.win = false; }));
  winFrames.forEach(f => f.visible = false);
}
export function updatePresentation(t){
  if (!rt.present) return;
  const pulse = 0.5 + 0.5 * Math.sin(t / 110);
  const focus = rt.present.idx >= 0 && rt.present.res.wins.length ? rt.present.res.wins[rt.present.idx % rt.present.res.wins.length] : null;
  const focusSet = focus ? new Set(focus.cells.map(({ r, c }) => r * COLS + c)) : null;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++){
    const key = r * COLS + c, sl = slotFor(c, r), f = winFrames[key];
    if (!rt.present.cells.has(key)) continue;
    const hot = !focusSet || focusSet.has(key);
    sl.mat.emissiveIntensity = hot ? 0.3 + 0.55 * pulse : BASE_EMISSIVE;
    sl.mat.color.setScalar(hot ? 1 : 0.55);
    f.material.opacity = hot ? 0.55 + 0.45 * pulse : 0.15;
    const sc = hot ? 1 + 0.03 * pulse : 1; f.scale.set(sc, sc, 1);
  }
  if (t > rt.present.next && rt.present.res.wins.length){
    rt.present.idx++; rt.present.next = t + 1800;
    const w = rt.present.res.wins[rt.present.idx % rt.present.res.wins.length];
    if (!rt.spinning && !rt.busy && !rt.gamble && rt.present.idx > 0 && rt.present.res.wins.length > 1 && t - rt.present.start > 3000){
      const amt = w.jackpot ? 'JACKPOT' : fmt(w.pay * betValueForResult());
      Ticker.set(`${w.line.name.toUpperCase()} · ${w.count}× ${SYMBOLS[w.sym].name.toUpperCase()} · ${amt}`, w.line.color, 1750);
    }
  }
}
function betValueForResult(){ return rt.spinCtx ? BET_STEPS[rt.spinCtx.betIdx] * (rt.spinCtx.free ? FS_MULT : 1) : BET_STEPS[S.betIdx]; }
