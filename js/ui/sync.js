/** Bedienpult mit dem Zustand abgleichen. */
import { BET_STEPS, JP_MAX } from '../core/config.js';
import { activeLines, betValue, coveredRows } from '../core/lines.js';
import { xpNeed } from '../core/progression.js';
import { rt, selectionLocked } from '../core/runtime.js';
import { S } from '../core/state.js';
import { fmt } from '../core/util.js';
import { $, reducedMotion } from '../dom.js';
import { LCD } from '../gfx/lcd.js';
import { updateLamps } from '../scene/lamps.js';
import { updateSticky } from '../scene/sticky.js';
import { renderDebug } from './debug.js';

export function syncUI(){
  const lines = activeLines(), bet = betValue(), cost = bet * lines.length, free = S.freeSpins > 0;
  $('credits').textContent = fmt(S.credits);
  $('bet').textContent = fmt(bet);
  $('cost').textContent = free ? 'FREI' : fmt(cost);
  $('lineCount').textContent = `${lines.length} ${lines.length === 1 ? 'Linie' : 'Linien'}`;
  $('jpVal').textContent = fmt(S.jackpot);
  $('jpBar').style.width = (S.jackpot / JP_MAX * 100).toFixed(1) + '%';
  if (!rt.spinning && !rt.present) $('lastWin').textContent = fmt(rt.lastWin);
  LCD.lines.set(String(lines.length)); LCD.bet.set(free ? 'FREI' : fmt(cost));

  const cov = coveredRows(), lock = selectionLocked();
  for (let r = 0; r < 4; r++){
    const b = $('row' + r);
    b.setAttribute('aria-pressed', String(!!S.singles[r] || cov[r]));
    b.classList.toggle('covered', cov[r]); b.disabled = lock;
  }
  for (let i = 0; i < 3; i++){ const b = $('pair' + i); b.setAttribute('aria-pressed', String(!!S.pairs[i])); b.disabled = lock; }
  $('betDown').disabled = lock || S.betIdx === 0;
  $('betUp').disabled = lock || S.betIdx === BET_STEPS.length - 1;
  $('maxBtn').disabled = lock || S.betIdx === BET_STEPS.length - 1;

  const sb = $('spinBtn');
  const broke = !free && S.credits + 1e-9 < BET_STEPS[0] * Math.max(1, lines.length) && !rt.spinning && !rt.busy && !rt.gamble;
  sb.classList.toggle('stopping', rt.spinning); sb.classList.toggle('free', free && !rt.spinning);
  sb.textContent = rt.spinning ? 'STOPP' : rt.busy ? 'WEITER' : rt.gamble ? 'NEHMEN & DREHEN' : free ? `FREISPIEL (${S.freeSpins})` : 'DREHEN';
  sb.style.fontSize = rt.gamble && !rt.spinning && !rt.busy ? '17px' : '';
  sb.disabled = !rt.glOK || (rt.busy && !rt.bannerState) || (!rt.spinning && !rt.busy && (broke || (!free && !lines.length)));
  // Neues Spiel liegt im Einstellungsmenü: Knopf hervorheben, wenn die Credits nicht mehr reichen
  const out = broke && !S.freeSpins;
  $('settingsBtn').classList.toggle('attn', out); $('refillBtn').classList.toggle('broke', out);
  $('lvl').textContent = S.level;
  $('xpBar').style.width = Math.min(100, S.xp / xpNeed(S.level) * 100).toFixed(1) + '%';
  $('xpTxt').textContent = `${Math.floor(S.xp)} / ${xpNeed(S.level)} XP`;
  $('musicBtn').setAttribute('aria-pressed', String(S.music)); $('musicBtn').textContent = S.music ? 'Musik an' : 'Musik';
  $('turboBtn').setAttribute('aria-pressed', String(S.turbo));
  $('viewBtn').textContent = 'Ansicht: ' + ({ '3d':'3D', front:'Frontal', turn:'Drehteller' }[S.view] || '3D');
  document.querySelectorAll('.cabopt').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cab === S.cabinet)));
  $('brightRange').value = Math.round(S.brightness * 100); $('brightVal').textContent = Math.round(S.brightness * 100) + ' %';
  const hist = $('hist'); hist.innerHTML = '';
  if (!S.history.length){ const e = document.createElement('span'); e.textContent = 'noch keine Runde'; hist.appendChild(e); }
  S.history.forEach(h => {
    const e = document.createElement('span');
    e.className = h.k || (h.w > 0 ? 'w' : '');
    const icon = h.k === 'jp' ? '💎 ' : h.k === 'fs' ? '💥 ' : h.k === 'wheel' ? '🍀 ' : h.k === 'risk' ? '♦ ' : '';
    e.textContent = h.w > 0 ? icon + fmt(h.w) : (icon ? icon.trim() : '–');
    hist.appendChild(e);
  });
  const ab = $('autoBtn'); ab.setAttribute('aria-pressed', String(rt.autoOn)); ab.textContent = rt.autoOn ? 'Auto an' : 'Auto';
  $('soundBtn').setAttribute('aria-pressed', String(S.sound)); $('soundBtn').textContent = S.sound ? 'Ton an' : 'Ton aus';
  $('linesBtn').setAttribute('aria-pressed', String(S.showLines));
  $('reducedBtn').setAttribute('aria-pressed', String(reducedMotion()));
  $('volRange').value = S.volume; $('volVal').textContent = S.volume + ' %';
  updateLamps();
  if (rt.glOK) updateSticky();
  if (!$('dbgModal').hidden) renderDebug();
}
