/**
 * Risiko-Leiter: Rot/Schwarz, Buchung, Anzeige.
 * gambleCollect() stößt über game/flow.scheduleNext() den Auto-Weiterlauf an – ein bewusster Funktions-Zyklus
 * mit game/flow.js (beim Laden der Module wird davon nichts benutzt).
 */
import { Snd } from '../audio/sound.js';
import { GAMBLE_CAP, GAMBLE_MAX_STEPS } from '../core/config.js';
import { rand } from '../core/rng.js';
import { rt } from '../core/runtime.js';
import { S, saveState } from '../core/state.js';
import { fmt } from '../core/util.js';
import { $, buzz } from '../dom.js';
import { animateCount } from './effects.js';
import { scheduleNext } from './flow.js';
import { LCD } from '../gfx/lcd.js';
import { Ticker } from '../gfx/ticker.js';
import { drawCardFace } from '../scene/card.js';
import { burstCoins } from '../scene/coins.js';
import { world } from '../scene/context.js';
import { say } from '../ui/controls.js';
import { syncUI } from '../ui/sync.js';

/* ----- Risiko-Leiter ----- */
const SUITS = [['♥', true], ['♦', true], ['♠', false], ['♣', false]];
const RANKS = ['A', 'K', 'D', 'B', '10', '9', '8', '7'];
export function offerGamble(amount){
  if (!world.card) return;
  rt.gamble = { amount, step:0, busy:false, cards:[] };
  world.card.g.visible = true; world.card.target = 1;
  if (world.card.faceUp){ world.card.rotTarget += Math.PI; world.card.faceUp = false; }
  $('gamble').hidden = false; $('stageHint').hidden = true;
  renderGamble();
  Ticker.set('RISIKO? ROT ODER SCHWARZ', '#ff3d9a', 4000);
}
export function gamblePick(red){
  if (!rt.gamble || rt.gamble.busy) return;
  Snd.ensure();
  rt.gamble.busy = true;
  S.credits = +(S.credits - rt.gamble.amount).toFixed(4); S.gambleRefund = rt.gamble.amount; saveState(); syncUI();
  renderGamble();
  const reveal = () => {
    const [suit, isRed] = SUITS[Math.floor(rand() * 4)], rank = RANKS[Math.floor(rand() * RANKS.length)];
    drawCardFace(suit, rank, isRed);
    world.card.rotTarget += Math.PI; world.card.faceUp = true; Snd.flip();
    setTimeout(() => resolveGamble(isRed === red, suit, isRed), S.turbo ? 300 : 560);
  };
  if (world.card.faceUp){ world.card.rotTarget += Math.PI; world.card.faceUp = false; Snd.flip(); setTimeout(reveal, S.turbo ? 220 : 380); }
  else reveal();
}
function resolveGamble(ok, suit, isRed){
  if (!rt.gamble) return;
  S.gambleRefund = 0;
  rt.gamble.cards.push({ suit, isRed });
  const a = rt.gamble.amount;
  if (ok){
    S.credits = +(S.credits + 2 * a).toFixed(4); S.stats.won += a; S.stats.gambleNet += a;
    rt.gamble.amount = a * 2; rt.gamble.step++; rt.lastWin = rt.gamble.amount; animateCount(LCD.win, rt.lastWin);
    S.stats.biggest = Math.max(S.stats.biggest, rt.gamble.amount);
    if (S.history[0]){ S.history[0].w = rt.gamble.amount; S.history[0].k = 'risk'; }
    Snd.right(); buzz(20); burstCoins(400, 25);
    Ticker.set(`RICHTIG! ${fmt(rt.gamble.amount)}`, '#7dff9b', 2000);
    say(`Richtig, ${suit} ist ${isRed ? 'rot' : 'schwarz'}! Dein Gewinn: ${fmt(rt.gamble.amount)}.`, 'good');
    rt.gamble.busy = false;
    if (rt.gamble.step >= GAMBLE_MAX_STEPS || rt.gamble.amount * 2 > GAMBLE_CAP){
      rt.gamble.busy = true;
      say(`Oberste Stufe erreicht, ${fmt(rt.gamble.amount)} sind gesichert.`, 'good');
      setTimeout(() => gambleCollect(true), 1100);
    }
  } else {
    S.stats.won -= a; S.stats.gambleNet -= a;
    rt.lastWin = 0; LCD.win._anim = (LCD.win._anim || 0) + 1; LCD.win.set(fmt(0)); $('lastWin').textContent = fmt(0);
    if (S.history[0]){ S.history[0].w = 0; S.history[0].k = ''; }
    Snd.wrong(); buzz([40, 30, 40]); rt.shake = 0.08;
    Ticker.set('LEIDER DANEBEN', '#ff7070', 2000);
    say(`Daneben, ${suit} ist ${isRed ? 'rot' : 'schwarz'}. ${fmt(a)} verloren.`, 'bad');
    rt.gamble.amount = 0;
    setTimeout(() => gambleCollect(true), 1300);
  }
  renderGamble(); syncUI(); saveState();
}
export function gambleCollect(silent){
  if (!rt.gamble) return;
  if (!silent && rt.gamble.amount > 0){ say(`${fmt(rt.gamble.amount)} gesichert.`, 'good'); Snd.tone(990, 0.09, { type:'triangle', vol:0.1 }); }
  rt.gamble = null;
  if (world.card) world.card.target = 0;
  $('gamble').hidden = true; $('stageHint').hidden = false;
  syncUI(); saveState();
  if (rt.autoOn && !rt.spinning && !rt.busy) scheduleNext(0);
}
function renderGamble(){
  if (!rt.gamble) return;
  $('gAmt').textContent = fmt(rt.gamble.amount);
  $('gNext').textContent = rt.gamble.amount > 0 ? `Treffer → ${fmt(rt.gamble.amount * 2)} · Stufe ${rt.gamble.step}/${GAMBLE_MAX_STEPS}` : 'Verloren';
  const steps = $('gSteps'); steps.innerHTML = '';
  for (let i = 0; i < GAMBLE_MAX_STEPS; i++){ const d = document.createElement('i'); if (i < rt.gamble.step) d.className = 'on'; steps.appendChild(d); }
  const h = $('gHist'); h.innerHTML = '';
  rt.gamble.cards.slice(-8).forEach(cd => { const sp = document.createElement('span'); sp.textContent = cd.suit; if (cd.isRed) sp.className = 'red'; h.appendChild(sp); });
  ['gRed', 'gBlack', 'gTake'].forEach(id => $(id).disabled = rt.gamble.busy);
}
