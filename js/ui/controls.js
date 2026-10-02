/** Bedien-Aktionen: Statuszeile, Linienwahl, Einsatz. */
import { Snd } from '../audio/sound.js';
import { BET_STEPS } from '../core/config.js';
import { buildLines, coveredRows, spinCost } from '../core/lines.js';
import { S, saveState } from '../core/state.js';
import { clamp, fmt } from '../core/util.js';
import { $ } from '../dom.js';
import { clearPresentation } from '../game/presentation.js';
import { Ticker } from '../gfx/ticker.js';
import { selectionLocked, syncUI } from './sync.js';

/* =========================================================
   UI-Bindung
   ========================================================= */
export function say(msg, kind = ''){ const s = $('status'); s.textContent = msg; s.className = 'status' + (kind ? ' ' + kind : ''); }
export function toggleRow(i){
  if (selectionLocked()) return;
  if (coveredRows()[i]){ say(`Reihe ${i + 1} ist schon über ein Paar aktiv.`); return; }
  S.singles[i] = !S.singles[i]; onSelectionChanged();
}
export function togglePair(i){
  if (selectionLocked()) return;
  S.pairs[i] = !S.pairs[i];
  const cov = coveredRows(); S.singles = S.singles.map((v, r) => v && !cov[r]);
  onSelectionChanged();
}
function onSelectionChanged(){
  Snd.tone(880, 0.05, { type:'square', vol:0.05 });
  const n = buildLines().length;
  Ticker.set(n ? `${n} LINIEN × ${fmt(BET_STEPS[S.betIdx])} = ${fmt(spinCost())}` : 'BITTE LINIEN WÄHLEN', n ? '#35e2ff' : '#ff3d9a', 2200);
  say(n ? `${n} ${n === 1 ? 'Linie' : 'Linien'} · Gesamteinsatz ${fmt(spinCost())}.` : 'Wähle mindestens eine Reihe oder ein Paar.', n ? '' : 'bad');
  clearPresentation();
  syncUI(); saveState();
}
export function changeBet(d){
  if (selectionLocked()) return;
  S.betIdx = clamp(S.betIdx + d, 0, BET_STEPS.length - 1);
  Snd.tone(600 + S.betIdx * 90, 0.05, { type:'square', vol:0.05 });
  Ticker.set(`EINSATZ ${fmt(BET_STEPS[S.betIdx])} PRO LINIE`, '#ff3d9a', 1800);
  say(`Einsatz ${fmt(BET_STEPS[S.betIdx])} pro Linie · Gesamteinsatz ${fmt(spinCost())}.`);
  syncUI(); saveState();
}
