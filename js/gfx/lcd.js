/** 7-Segment-LCD-Anzeigen am Automaten (Linien, Gewinn, Einsatz). */
import { segH, segV } from './canvas2d.js';

/* =========================================================
   LCD-Anzeigen am Automaten
   ========================================================= */
function makeLCD(label, color, w, h){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const o = { canvas:c, ctx:c.getContext('2d'), label, color, value:null, tex:null };
  o.set = v => { if (v === o.value) return; o.value = v; drawLCD(o); if (o.tex) o.tex.needsUpdate = true; };
  return o;
}
const SEG7 = { '0':'abcdef', '1':'bc', '2':'abged', '3':'abgcd', '4':'fgbc', '5':'afgcd', '6':'afgedc', '7':'abc', '8':'abcdefg', '9':'abcdfg', '-':'g', ' ':'' };
function seg7(ctx, ch, x, y, w, h){
  const t = w * 0.17, gp = t * 0.12, hl = w - t - 2 * gp, vl = h / 2 - t / 2 - 2 * gp;
  const H = (sx, sy) => segH(ctx, sx, sy, hl, t);
  const V = (sx, sy) => segV(ctx, sx, sy, vl, t);
  const segs = SEG7[ch] || '';
  const P = { a:() => H(x + t / 2 + gp, y), g:() => H(x + t / 2 + gp, y + h / 2 - t / 2), d:() => H(x + t / 2 + gp, y + h - t),
              f:() => V(x, y + t / 2 + gp), b:() => V(x + w - t, y + t / 2 + gp), e:() => V(x, y + h / 2 + gp), c:() => V(x + w - t, y + h / 2 + gp) };
  for (const k of segs) P[k]();
}
export function drawLCD(o){
  const { ctx, canvas:c } = o;
  const g = ctx.createLinearGradient(0, 0, 0, c.height); g.addColorStop(0, '#0a0306'); g.addColorStop(1, '#14070c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = `700 ${Math.round(c.height * 0.15)}px "Chakra Petch", system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = o.color + 'aa'; ctx.fillText(o.label, 18, 10);
  const val = String(o.value ?? ''), h = c.height * 0.56, w = h * 0.52, sp = w * 0.28, top = c.height * 0.33;
  if (/[^0-9.\- ]/.test(val)){
    ctx.font = `800 ${Math.round(h * 0.95)}px Orbitron, ui-monospace, monospace`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = o.color; ctx.shadowBlur = 16; ctx.fillStyle = o.color; ctx.fillText(val, c.width - 20, top + h); ctx.shadowBlur = 0;
    return;
  }
  // Ziffernplätze von rechts belegen; Punkt hängt an der Ziffer davor
  const cells = []; for (const ch of val){ if (ch === '.' && cells.length) cells[cells.length - 1].dot = true; else cells.push({ ch, dot:false }); }
  const slots = Math.max(cells.length, Math.floor((c.width - 30) / (w + sp)));
  ctx.save(); ctx.transform(1, 0, -0.08, 1, top * 0.08, 0);
  for (let k = 0; k < slots; k++){
    const x = c.width - 22 - (k + 1) * (w + sp) + sp, cell = cells[cells.length - 1 - k];
    ctx.fillStyle = o.color + '14'; seg7(ctx, '8', x, top, w, h);
    ctx.fillRect(x + w + sp * 0.2, top + h - w * 0.17, w * 0.17, w * 0.17);
    if (!cell) continue;
    ctx.fillStyle = o.color; ctx.shadowColor = o.color; ctx.shadowBlur = 14;
    seg7(ctx, cell.ch, x, top, w, h);
    if (cell.dot) ctx.fillRect(x + w + sp * 0.2, top + h - w * 0.17, w * 0.17, w * 0.17);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}
export const LCD = { lines: makeLCD('LINIEN', '#35e2ff', 384, 170), win: makeLCD('GEWINN', '#ffc83a', 680, 170), bet: makeLCD('EINSATZ', '#ff3d9a', 384, 170) };
