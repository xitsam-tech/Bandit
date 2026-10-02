/** Overlay: Gewinnlinien und Hover-Bänder in Bildschirmkoordinaten. */
import { activeLines } from '../core/lines.js';
import { rt } from '../core/runtime.js';
import { S } from '../core/state.js';
import { fx, fxCanvas } from '../dom.js';
import { VIEW } from '../scene/constants.js';
import { world } from '../scene/context.js';
import { cellWorld } from '../scene/reels.js';

/* =========================================================
   Overlay: Gewinnlinien in Bildschirmkoordinaten
   ========================================================= */
function project(c, r){
  const p = cellWorld(c, r, 0.05).project(world.camera);
  return [(p.x * 0.5 + 0.5) * fxCanvas._w, (-p.y * 0.5 + 0.5) * fxCanvas._h];
}
function drawLine(L, color, width, alpha, cells = 5){
  fx.globalAlpha = alpha; fx.strokeStyle = color; fx.lineWidth = width; fx.lineJoin = fx.lineCap = 'round';
  fx.shadowColor = color; fx.shadowBlur = width * 3;
  fx.beginPath();
  L.pat.forEach((r, c) => { const [x, y] = project(c, r); c ? fx.lineTo(x, y) : fx.moveTo(x, y); });
  fx.stroke();
  fx.shadowBlur = 0;
  if (cells < 5){
    L.pat.slice(0, cells).forEach((r, c) => { const [x, y] = project(c, r); fx.fillStyle = color; fx.beginPath(); fx.arc(x, y, width * 1.6, 0, 7); fx.fill(); });
  }
  fx.globalAlpha = 1;
}
export function drawOverlay(){
  const w = fxCanvas._w, h = fxCanvas._h;
  fx.clearRect(0, 0, w, h);
  if (!rt.glOK) return;
  if ((world.wheel && world.wheel.state !== 'hidden') || (world.card && world.card.show > 0.05)) return;
  // 2D-Linien nur bei Blick von vorne (sonst lägen sie z. B. auf der Rückseite)
  if ((world.camera.position.z + 2.0) / Math.max(0.001, Math.hypot(world.camera.position.x - VIEW.cx, world.camera.position.z + 2.0)) < 0.55) return;
  if (rt.hoverBand){
    rt.hoverBand.forEach(r => {
      const [x0, y0] = project(0, r), [x1] = project(4, r), ch = Math.abs(project(0, 1)[1] - project(0, 2)[1]);
      fx.fillStyle = '#ffc83a22'; fx.strokeStyle = '#ffc83a99'; fx.lineWidth = 2; fx.setLineDash([8, 6]);
      const pad = (x1 - x0) / 8;
      fx.fillRect(x0 - pad, y0 - ch / 2, x1 - x0 + pad * 2, ch); fx.strokeRect(x0 - pad, y0 - ch / 2, x1 - x0 + pad * 2, ch);
      fx.setLineDash([]);
    });
  }
  if (S.showLines && !rt.present){
    activeLines().forEach(L => drawLine(L, L.color, 3, 0.75));
  }
  if (rt.present && rt.present.res.wins.length && !rt.spinning){
    const wins = rt.present.res.wins;
    if (rt.present.idx < 0) wins.forEach(wn => drawLine(wn.line, wn.line.color, 5, 0.95, wn.count));
    else { const wn = wins[rt.present.idx % wins.length]; drawLine(wn.line, wn.line.color, 6, 1, wn.count); }
  }
}
