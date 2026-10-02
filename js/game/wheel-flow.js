/** Ablauf des Glücksrads (Start, Ergebnis, Gutschrift). */
import { Snd } from '../audio/sound.js';
import { WHEEL } from '../core/config.js';
import { rand } from '../core/rng.js';
import { rt } from '../core/runtime.js';
import { S, saveState } from '../core/state.js';
import { fmt, now } from '../core/util.js';
import { wheelIndexAt, wheelTarget } from '../core/wheel-math.js';
import { buzz } from '../dom.js';
import { showBanner } from './banner.js';
import { animateCount } from './effects.js';
import { LCD } from '../gfx/lcd.js';
import { Ticker } from '../gfx/ticker.js';
import { burstCoins } from '../scene/coins.js';
import { world } from '../scene/context.js';
import { say } from '../ui/controls.js';
import { syncUI } from '../ui/sync.js';

/* ----- Glücksrad-Ablauf ----- */
export function runWheel(stake, clovers){
  return new Promise(resolve => {
    if (!world.wheel){ resolve(0); return; }
    Object.assign(world.wheel, { state:'in', idx: Math.floor(rand() * WHEEL.length), stake, resolve });
    S.wheelPending = { stake }; saveState();
    world.wheel.g.visible = true;
    Ticker.set('GLÜCKSRAD!', '#7dff9b', 99999);
    say(`${clovers}× Klee: Das Glücksrad dreht sich!`, 'good');
    Snd.bonus(); buzz([20, 30, 20]);
    setTimeout(() => {
      const seg = Math.PI * 2 / WHEEL.length;
      world.wheel.from = world.wheel.phi;
      world.wheel.to = wheelTarget(world.wheel.phi, world.wheel.idx, (rand() - 0.5) * seg * 0.7, S.turbo ? 4 : 6);
      world.wheel.dur = S.turbo ? 3000 : 5600; world.wheel.ts = now(); world.wheel.state = 'spin';
    }, S.turbo ? 500 : 1200);
  });
}
export async function finishWheel(){
  world.wheel.state = 'result';
  let prize = 0;
  try { prize = await finishWheelInner(); }
  catch(e){ console.error(e); }
  finally {
    world.wheel.state = 'out';
    setTimeout(() => { const r = world.wheel.resolve; world.wheel.resolve = null; if (r) r(prize); }, 450);
  }
}
async function finishWheelInner(){
  const mult = WHEEL[wheelIndexAt(world.wheel.phi)], prize = Math.round(mult * world.wheel.stake * 100) / 100;
  S.credits = +(S.credits + prize).toFixed(4); S.stats.won += prize; S.stats.wheels++; S.wheelPending = null;
  S.stats.biggest = Math.max(S.stats.biggest, rt.lastWin + prize);
  rt.lastWin += prize; animateCount(LCD.win, rt.lastWin);
  if (S.history[0]) S.history[0].w = rt.lastWin;
  Snd.win(mult >= 15 ? 2 : 1); burstCoins(mult >= 15 ? 3000 : 1500, mult >= 15 ? 50 : 30); buzz([20, 30, 20]);
  if (mult >= 15) rt.shake = 0.12;
  if (mult >= 15 && rt.autoOn){ rt.autoOn = false; clearTimeout(rt.autoTimer); }
  Ticker.set(`GLÜCKSRAD ${mult}× = ${fmt(prize)}`, '#7dff9b', 3000);
  say(`Glücksrad: ${mult}× Gesamteinsatz = ${fmt(prize)} Credits.${mult >= 15 ? ' Auto gestoppt.' : ''}`, 'good');
  syncUI(); saveState();
  await showBanner(`${mult}× GLÜCKSRAD`, prize, 'auf deinen Gesamteinsatz', { celebrate: mult >= 15, dur:4500 });
  return prize;
}
