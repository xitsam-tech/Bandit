/** Spielablauf: Drehen, Auswerten, Ablaufkette, Auto-Spiel, Gewinnzähler. */
import { Music } from '../audio/music.js';
import { Snd } from '../audio/sound.js';
import { BET_STEPS, COLS, FS_AWARD, FS_MULT, GAMBLE_CAP, JOKER, JP_FEED, JP_MAX, JP_SEED, SCATTER, SYMBOLS, WHEEL_MIN } from '../core/config.js';
import { activeLines, betValue, buildLines, evaluate, heldReels, spinCost } from '../core/lines.js';
import { xpNeed } from '../core/progression.js';
import { nextStops } from '../core/rng.js';
import { rt } from '../core/runtime.js';
import { S, saveState, setStops } from '../core/state.js';
import { fmt } from '../core/util.js';
import { buzz } from '../dom.js';
import { closeBanner, showBanner } from './banner.js';
import { animateCount } from './effects.js';
import { gambleCollect, offerGamble } from './gamble.js';
import { clearPresentation, startPresentation } from './presentation.js';
import { runWheel } from './wheel-flow.js';
import { LCD } from '../gfx/lcd.js';
import { Ticker } from '../gfx/ticker.js';
import { burstCoins, clearTray } from '../scene/coins.js';
import { world } from '../scene/context.js';
import { startCoinRun } from '../scene/mechanics.js';
import { quickStop, startReels } from '../scene/reel-motion.js';
import { readStops, readVisibleMatrix } from '../scene/reels.js';
import { updateSticky } from '../scene/sticky.js';
import { say } from '../ui/controls.js';
import { syncUI } from '../ui/sync.js';

export function spin(){
  Snd.ensure(); Music.sync();
  if (!rt.glOK) return;
  if (rt.spinning){ quickStop(); return; }
  if (rt.busy){ if (rt.bannerState) closeBanner(); return; }
  if (rt.gamble){ if (rt.gamble.busy) return; gambleCollect(); }
  if (rt.bannerState) closeBanner();
  const free = S.freeSpins > 0;
  const lines = activeLines();
  if (!lines.length){ say('Wähle mindestens eine Reihe oder ein Paar.', 'bad'); Ticker.set('BITTE LINIEN WÄHLEN', '#ff3d9a'); return; }
  const cost = betValue() * lines.length;
  if (!free){
    if (S.credits + 1e-9 < cost){
      say(`Zu wenig Credits für ${fmt(cost)}. Senke den Einsatz oder wähle weniger Linien.`, 'bad');
      Ticker.set('ZU WENIG CREDITS', '#ff3d9a'); stopAuto(); return;
    }
    S.credits = +(S.credits - cost).toFixed(4);
    S.jackpot = Math.min(JP_MAX, +(S.jackpot + cost * JP_FEED).toFixed(4));
    S.stats.wagered += cost;
    S.xp += cost;
  } else {
    S.freeSpins--;
  }
  S.stats.spins++;
  clearTray();
  if (!free) startCoinRun();
  const held = free ? heldReels(S.sticky) : [false,false,false,false,false];
  // Der Zufall wählt nur Stopppositionen; gehaltene Walzen bleiben, wo sie sind (ihr Joker steht dort auf dem Streifen)
  const cur = readStops(), drawn = nextStops();
  const stops = drawn.map((p, c) => held[c] ? cur[c] : p);
  rt.spinCtx = { free, lines, betIdx: free ? S.fsBetIdx : S.betIdx, held, stops };
  rt.hoverBand = null;
  clearPresentation();
  rt.spinning = true; rt.lastWin = 0; LCD.win._anim = (LCD.win._anim || 0) + 1; LCD.win.set(fmt(0));
  if (world.lever && !world.lever.drag && world.lever.angle < 0.3) world.lever.auto = 1;
  Snd.lever(); buzz(12);
  setStops(stops);
  S.pending = rt.spinCtx;
  startReels(stops, held);
  if (held.every(Boolean)) setTimeout(() => { if (rt.spinning) settle(); }, 700);
  Ticker.set(free ? `FREISPIEL · NOCH ${S.freeSpins}` : 'VIEL GLÜCK', free ? '#35e2ff' : '#ffc83a', 99999);
  say(free ? `Freispiel läuft, danach noch ${S.freeSpins}.${held.some(Boolean) ? ' Gehalten: Walze ' + held.map((h, c) => h ? c + 1 : 0).filter(Boolean).join(', ') + '.' : ''}` : `Einsatz ${fmt(cost)} gesetzt.`);
  syncUI(); saveState();
}

export async function settle(){
  rt.spinning = false; rt.busy = true;
  let winForNext = 0;
  try { winForNext = await settleInner(); }
  catch(e){ console.error(e); }
  finally {
    rt.busy = false;
    if (world.wheel && world.wheel.state !== 'hidden') world.wheel.state = 'out';
    syncUI(); saveState();
    scheduleNext(winForNext);
  }
}
async function settleInner(){
  const m = readVisibleMatrix();
  setStops(readStops());
  const ctx = rt.spinCtx || { free:false, lines:buildLines(), betIdx:S.betIdx };
  S.pending = null;
  const free = ctx.free, lines = ctx.lines, bet = BET_STEPS[ctx.betIdx], cost = bet * lines.length;
  const res = evaluate(m, lines);
  if (ctx.held && ctx.held.some(Boolean)){
    ['scatter', 'clover'].forEach(k => { res[k].cells = res[k].cells.filter(({ c }) => !ctx.held[c]); res[k].count = res[k].cells.length; });
  }
  rt.lastResult = res;
  let win = res.lineTotal * bet * (free ? FS_MULT : 1), jpWin = 0;
  if (res.jackpot){ jpWin = S.jackpot; win += jpWin; S.jackpot = JP_SEED; S.stats.jackpots++; }
  win = Math.round(win * 100) / 100;
  S.credits = +(S.credits + win).toFixed(4);
  S.stats.won += win; S.stats.biggest = Math.max(S.stats.biggest, win);
  if (free) S.fsWon += win;
  rt.lastWin = win;

  // Klebe-Joker sammeln
  const fresh = [];
  if (free) m.forEach((row, r) => row.forEach((v, c) => { const k = r * COLS + c; if (v === JOKER && !S.sticky.includes(k)){ S.sticky.push(k); fresh.push(k); } }));

  const fsNew = FS_AWARD(res.scatter.count);
  if (fsNew){
    if (!free){ S.fsLines = lines; S.fsBetIdx = ctx.betIdx; S.fsWon = 0; S.sticky = []; }
    S.freeSpins += fsNew; S.stats.fsTriggers++;
  }
  const fsEnd = free && S.freeSpins === 0 && !fsNew;
  const wheelHit = res.clover.count >= WHEEL_MIN;
  const ups = [];
  while (S.xp >= xpNeed(S.level)){ S.xp -= xpNeed(S.level); S.level++; ups.push(S.level); S.credits += S.level * 5; }
  const level = res.jackpot ? 3 : win >= cost * 25 ? 2 : win >= cost * 10 ? 1 : win > 0 ? 0 : -1;
  // Wie bei echten Automaten: Auto stoppt bei großen Gewinnen, damit man sie bewusst mitbekommt
  const autoStopMsg = rt.autoOn && level >= 1 ? (res.jackpot ? 'Jackpot' : level === 2 ? 'Mega Win' : 'Big Win') : '';
  if (autoStopMsg){ rt.autoOn = false; clearTimeout(rt.autoTimer); }

  startPresentation(res, wheelHit);
  updateSticky(fresh);
  if (fresh.length) Snd.tone(330, 0.25, { type:'triangle', vol:0.12, to:660 });
  animateCount(LCD.win, win);
  if (level >= 0) Snd.win(level); else if (!wheelHit && !fsNew) Snd.lose();
  if (win > 0) buzz(level >= 1 ? [30, 40, 60] : 15);

  if (fsNew){
    Ticker.set(`${fsNew} FREISPIELE!`, '#ff3d9a', 3000);
    say(`${res.scatter.count}× Bonus: ${fsNew} Freispiele. Jeder Joker bleibt bis zum Ende kleben.`, 'good');
  } else if (win > 0){
    const best = res.wins.slice().sort((a, b) => b.pay - a.pay)[0];
    Ticker.set(`GEWINN ${fmt(win)}`, '#7dff9b', 4200);
    say(res.jackpot ? `JACKPOT! ${fmt(jpWin)} aus dem Topf, insgesamt ${fmt(win)}.` :
        `Gewinn ${fmt(win)} auf ${res.wins.length} ${res.wins.length === 1 ? 'Linie' : 'Linien'}. Bester Treffer: ${best.count}× ${SYMBOLS[best.sym].name}.`, 'good');
  } else if (!wheelHit){
    Ticker.set('KEIN GEWINN', '#a497c8', 1400);
    const staleSc = ctx.held ? m.reduce((n, row) => n + row.filter((v, c) => v === SCATTER && ctx.held[c]).length, 0) : 0;
    if (staleSc && staleSc + res.scatter.count >= 3){
      say(`${staleSc}× Bonus liegt auf einer gehaltenen Walze und zählt nicht – nur neu gelandete Bonus-Symbole zählen.`);
    } else
    say(free && S.sticky.length ? `Kein Gewinn, aber ${S.sticky.length} Joker kleben weiter.` : 'Kein Gewinn. Nächste Runde?');
  }
  S.history.unshift({ w: win, k: res.jackpot ? 'jp' : fsNew ? 'fs' : wheelHit ? 'wheel' : win > 0 ? 'w' : '' });
  S.history.length = Math.min(S.history.length, 14);
  syncUI(); saveState();

  // Ablaufkette: Feiern → Glücksrad → Freispiele → Level-Ups
  if (res.jackpot){ Snd.fanfare(); rt.shake = 0.3; burstCoins(5000, 70); await showBanner('JACKPOT', win, 'Der Topf gehört dir', { celebrate:true, dur:7200 }); }
  else if (level === 2){ rt.shake = 0.15; burstCoins(3600, 55); await showBanner('MEGA WIN', win, `${Math.round(win / cost)}× Einsatz`, { celebrate:true, dur:5800 }); }
  else if (level === 1){ burstCoins(2400, 40); await showBanner('BIG WIN', win, `${Math.round(win / cost)}× Einsatz`, { celebrate:true, dur:5000 }); }
  else if (win > 0) burstCoins(500, 30);
  if (wheelHit) await runWheel(cost, res.clover.count);
  if (fsNew){ Snd.bonus(); await showBanner(`${fsNew} FREISPIELE`, null, free ? 'Zusätzlich – die Joker kleben weiter' : 'Jeder Joker bleibt bis zum Ende kleben', { dur:3600 }); }
  if (fsEnd){
    const total = S.fsWon;
    S.fsLines = null; S.fsWon = 0; S.sticky = []; updateSticky();
    await showBanner('FREISPIELE VORBEI', total, 'Gesamtgewinn der Bonusrunde', { dur:4200 });
  }
  for (const lv of ups){ Snd.levelUp(); burstCoins(900, 30); await showBanner(`LEVEL ${lv}`, lv * 5, 'Level-Bonus gutgeschrieben', { dur:3200 }); }
  rt.busy = false;
  if (autoStopMsg) say(`Auto gestoppt: ${autoStopMsg} über ${fmt(win)}.`, 'good');
  if (win > 0 && !free && !res.jackpot && !fsNew && !wheelHit && !rt.autoOn && win <= GAMBLE_CAP) offerGamble(win);
  return win;
}

export function scheduleNext(win){
  clearTimeout(rt.autoTimer);
  if (!(S.freeSpins > 0 || rt.autoOn)) return;
  const delay = (win > 0 ? 2200 : 600) * (S.turbo ? 0.5 : 1);
  rt.autoTimer = setTimeout(() => {
    if (rt.spinning || rt.busy) return;
    if (rt.gamble) gambleCollect();
    if (S.freeSpins > 0) spin();
    else if (rt.autoOn){
      if (S.credits + 1e-9 < spinCost()){ stopAuto(); say('Auto gestoppt: zu wenig Credits.', 'bad'); return; }
      spin();
    }
  }, delay);
}
function stopAuto(){ rt.autoOn = false; if (S.freeSpins <= 0) clearTimeout(rt.autoTimer); syncUI(); }
