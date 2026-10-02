/** Ereignisse des Bedienpults, Tastatur und Dialoge binden. */
import { Music } from '../audio/music.js';
import { Snd } from '../audio/sound.js';
import { BET_STEPS, START_CREDITS } from '../core/config.js';
import { rt } from '../core/runtime.js';
import { S, saveState } from '../core/state.js';
import { now } from '../core/util.js';
import { $ } from '../dom.js';
import { closeBanner } from '../game/banner.js';
import { spin } from '../game/flow.js';
import { gambleCollect, gamblePick } from '../game/gamble.js';
import { Ticker } from '../gfx/ticker.js';
import { orbit, resetView } from '../scene/camera.js';
import { CAB_STYLES, applyBrightness, applyCabinetStyle } from '../scene/styles.js';
import { changeBet, say, togglePair, toggleRow } from './controls.js';
import { renderDebug, runSelfTests } from './debug.js';
import { renderPaytable } from './paytable.js';
import { syncUI } from './sync.js';

export function bindUI(){
  $('spinBtn').addEventListener('click', spin);
  $('betDown').addEventListener('click', () => changeBet(-1));
  $('betUp').addEventListener('click', () => changeBet(1));
  $('maxBtn').addEventListener('click', () => changeBet(BET_STEPS.length));
  for (let r = 0; r < 4; r++){
    const b = $('row' + r);
    b.addEventListener('click', () => toggleRow(r));
    b.addEventListener('mouseenter', () => rt.hoverBand = [r]); b.addEventListener('mouseleave', () => rt.hoverBand = null);
  }
  for (let i = 0; i < 3; i++){
    const b = $('pair' + i);
    b.addEventListener('click', () => togglePair(i));
    b.addEventListener('mouseenter', () => rt.hoverBand = [i, i + 1]); b.addEventListener('mouseleave', () => rt.hoverBand = null);
  }
  $('autoBtn').addEventListener('click', () => {
    rt.autoOn = !rt.autoOn; syncUI();
    if (rt.autoOn && !rt.spinning && !rt.busy && !(rt.gamble && rt.gamble.busy)) spin();
    else if (!rt.autoOn && S.freeSpins <= 0) clearTimeout(rt.autoTimer);
  });
  $('soundBtn').addEventListener('click', () => { S.sound = !S.sound; Music.sync(); syncUI(); saveState(); Snd.tone(660, 0.06, { type:'square', vol:0.06 }); });
  $('linesBtn').addEventListener('click', () => { S.showLines = !S.showLines; syncUI(); saveState(); });
  $('musicBtn').addEventListener('click', () => { S.music = !S.music; if (S.music && !S.sound){ S.sound = true; } Music.sync(); syncUI(); saveState(); });
  $('brightRange').addEventListener('input', e => { S.brightness = (+e.target.value) / 100; applyBrightness(); $('brightVal').textContent = Math.round(S.brightness * 100) + ' %'; saveState(); });
  document.querySelectorAll('.cabopt').forEach(b => b.addEventListener('click', () => {
    S.cabinet = b.dataset.cab; applyCabinetStyle(S.cabinet);
    say(`Gehäuse: ${CAB_STYLES[S.cabinet].name}.`); syncUI(); saveState();
  }));
  $('viewBtn').addEventListener('click', () => { S.view = { '3d':'front', front:'turn', turn:'3d' }[S.view] || '3d'; resetView(); syncUI(); saveState(); });
  $('turboBtn').addEventListener('click', () => {
    S.turbo = !S.turbo; Snd.tone(S.turbo ? 1200 : 700, 0.06, { type:'square', vol:0.05 });
    say(S.turbo ? 'Turbo an: Walzen und Animationen laufen schneller.' : 'Turbo aus.'); syncUI(); saveState();
  });
  $('gRed').addEventListener('click', () => gamblePick(true));
  $('gBlack').addEventListener('click', () => gamblePick(false));
  $('gTake').addEventListener('click', () => gambleCollect());
  $('refillBtn').addEventListener('click', () => {
    S.credits = START_CREDITS; rt.lastWin = 0; say('Neues Spiel: 100 Credits. Viel Glück!', 'good');
    Ticker.set('NEUES SPIEL · 100 CREDITS', '#7dff9b', 2400); syncUI(); saveState();
  });
  const openModal = id => { $(id).hidden = false; $(id).querySelector('button').focus(); };
  const closeModal = id => { $(id).hidden = true; };
  $('payBtn').addEventListener('click', () => { renderPaytable(); openModal('payModal'); });
  $('payClose').addEventListener('click', () => closeModal('payModal'));
  $('debugBtn').addEventListener('click', () => { renderDebug(); openModal('dbgModal'); });
  $('dbgClose').addEventListener('click', () => closeModal('dbgModal'));
  $('testBtn').addEventListener('click', runSelfTests);
  ['payModal', 'dbgModal'].forEach(id => $(id).addEventListener('click', e => { if (e.target.id === id) closeModal(id); }));

  const firstGesture = () => { Snd.ensure(); Music.sync(); window.removeEventListener('pointerdown', firstGesture); window.removeEventListener('keydown', firstGesture); };
  window.addEventListener('pointerdown', firstGesture); window.addEventListener('keydown', firstGesture);
  // Mausklicks hinterlassen keinen Fokusring; Klick-Geräusch für alle Knöpfe außer DREHEN (hat eigenen Hebel-Sound)
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button');
    if (b && e.detail > 0 && b.id !== 'payClose' && b.id !== 'dbgClose') b.blur();
    if (b && b.id !== 'spinBtn' && !b.disabled) Snd.ui();
  });
  document.addEventListener('keydown', e => {
    const modalOpen = !$('payModal').hidden || !$('dbgModal').hidden;
    if (e.key === 'Escape'){ closeModal('payModal'); closeModal('dbgModal'); closeBanner(); return; }
    if (modalOpen) return;
    const tag = (e.target && e.target.tagName) || '';
    if (e.repeat) return;
    orbit.lastInput = now();
    if (rt.gamble && !rt.gamble.busy){
      const k = e.key.toLowerCase();
      if (k === 'r'){ gamblePick(true); return; }
      if (k === 's'){ gamblePick(false); return; }
      if (k === 'n'){ gambleCollect(); return; }
    }
    if ((e.code === 'Space' || e.key === ' ') && tag !== 'BUTTON' && tag !== 'INPUT'){ e.preventDefault(); spin(); }
  });
}
