/** Gewinnplan-Dialog. */
import { CLOVER, DIAMOND, FS_AWARD, JOKER, PAY, SCATTER, SYMBOLS } from '../core/config.js';
import { REEL_STRIPS } from '../core/strips.js';
import { $ } from '../dom.js';
import { SYM } from '../gfx/symbols.js';

/** Auf welchen Walzen ein Symbol steht (aus den festen Streifen), z. B. „1·3·5“ oder „alle“. @param {number} sid */
function reelsWith(sid){
  const on = REEL_STRIPS.map((st, c) => st.includes(sid) ? c + 1 : 0).filter(Boolean);
  return on.length === REEL_STRIPS.length ? 'alle' : on.join('·');
}

export function renderPaytable(){
  const grid = $('ptGrid'); grid.innerHTML = '';
  const order = [DIAMOND, JOKER, SCATTER, 8, 7, 12, 6, 5, 4, 2, 3, 0, 1];
  order.forEach(sid => {
    const s = SYMBOLS[sid], item = document.createElement('div'); item.className = 'pt-item';
    const img = document.createElement('img'); img.alt = s.name; img.src = SYM[sid].canvas.toDataURL('image/png');
    const dl = document.createElement('dl');
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = s.name; dl.appendChild(nm);
    // Bonus: nur so viele Stufen, wie die Streifen erlauben (je Bonus-Walze höchstens ein Bonus sichtbar)
    const maxBonus = REEL_STRIPS.filter(st => st.includes(SCATTER)).length;
    const rows = sid === SCATTER ? [3, 4, 5].filter(n => n <= maxBonus).map(n => [`${n}×`, `${FS_AWARD(n)} FS`])
      : sid === CLOVER ? [['3×', PAY[sid][0] + '×'], ['4×', PAY[sid][1] + '×'], ['5×', PAY[sid][2] + '×'], ['4 überall', 'Rad']]
      : sid === DIAMOND ? [['3×', PAY[sid][0] + '×'], ['4×', PAY[sid][1] + '×'], ['5×', 'JACKPOT']]
      : [['3×', PAY[sid][0] + '×'], ['4×', PAY[sid][1] + '×'], ['5×', PAY[sid][2] + '×']];
    if ([JOKER, SCATTER, DIAMOND, CLOVER].includes(sid)) rows.push(['Walze', reelsWith(sid)]);
    rows.forEach(([a, b]) => { const dt = document.createElement('dt'); dt.textContent = a; const dd = document.createElement('dd'); dd.textContent = b; dl.append(dt, dd); });
    item.append(img, dl); grid.appendChild(item);
  });
}
