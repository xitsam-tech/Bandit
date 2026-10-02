/** Gewinnplan-Dialog. */
import { CLOVER, DIAMOND, JOKER, PAY, SCATTER, SYMBOLS } from '../core/config.js';
import { $ } from '../dom.js';
import { SYM } from '../gfx/symbols.js';

export function renderPaytable(){
  const grid = $('ptGrid'); grid.innerHTML = '';
  const order = [DIAMOND, JOKER, SCATTER, 8, 7, 12, 6, 5, 4, 2, 3, 0, 1];
  order.forEach(sid => {
    const s = SYMBOLS[sid], item = document.createElement('div'); item.className = 'pt-item';
    const img = document.createElement('img'); img.alt = s.name; img.src = SYM[sid].canvas.toDataURL('image/png');
    const dl = document.createElement('dl');
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = s.name; dl.appendChild(nm);
    const rows = sid === SCATTER ? [['3×', '3 FS'], ['4×', '5 FS'], ['5×', '8 FS']]
      : sid === CLOVER ? [['3×', PAY[sid][0] + '×'], ['4×', PAY[sid][1] + '×'], ['5×', PAY[sid][2] + '×'], ['4 überall', 'Rad']]
      : sid === DIAMOND ? [['3×', PAY[sid][0] + '×'], ['4×', PAY[sid][1] + '×'], ['5×', 'JACKPOT']]
      : [['3×', PAY[sid][0] + '×'], ['4×', PAY[sid][1] + '×'], ['5×', PAY[sid][2] + '×']];
    rows.forEach(([a, b]) => { const dt = document.createElement('dt'); dt.textContent = a; const dd = document.createElement('dd'); dd.textContent = b; dl.append(dt, dd); });
    item.append(img, dl); grid.appendChild(item);
  });
}
