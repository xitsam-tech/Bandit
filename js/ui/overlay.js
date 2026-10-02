/** Overlay: Gewinnlinien und Hover-Bänder in Bildschirmkoordinaten. */
import { activeLines } from '../core/lines.js';
import { rt } from '../core/runtime.js';
import { S } from '../core/state.js';
import { fx, fxCanvas } from '../dom.js';
import { world } from '../scene/context.js';
import { cellWorld } from '../scene/reels.js';

/* =========================================================
   Overlay: Gewinnlinien in Bildschirmkoordinaten
   ========================================================= */
/* Linienpunkte sind die 3D-Mittelpunkte der Felder auf dem Walzenband, projiziert mit der aktuellen Kamera.
   Gezeichnet wird nur innerhalb der projizierten Fensteröffnung (der Rahmen verdeckt die Walzen am Rand);
   bei schrägem Blick werden die Linien weich ausgeblendet. */
const WIN = { w:5.9, h:3.5, z:0.38 };
const _v = window.THREE ? new THREE.Vector3() : null;
function toScreen(v){ v.project(world.camera); return [(v.x * 0.5 + 0.5) * fxCanvas._w, (-v.y * 0.5 + 0.5) * fxCanvas._h]; }
function project(c, r){ return toScreen(cellWorld(c, r, 0.05)); }
/** Sichtbarkeit 0…1: Blick möglichst senkrecht durchs Walzenfenster. */
export function overlayFade(){
  const p = world.camera.position, d = _v.set(p.x, p.y, p.z - WIN.z).normalize();
  if (p.z < WIN.z + 0.5) return 0;
  const t = Math.min(1, Math.max(0, (d.z - 0.55) / 0.2));
  return t * t * (3 - 2 * t);
}
function clipWindow(){
  const hw = WIN.w / 2 - 0.04, hh = WIN.h / 2 - 0.04, n = 8;
  fx.beginPath();
  // Rand der Öffnung abtasten (gerade Kanten bleiben in der Projektion gerade)
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([-hw + 2 * hw * i / n, -hh]);
  for (let i = 0; i < n; i++) pts.push([hw, -hh + 2 * hh * i / n]);
  for (let i = 0; i < n; i++) pts.push([hw - 2 * hw * i / n, hh]);
  for (let i = 0; i < n; i++) pts.push([-hw, hh - 2 * hh * i / n]);
  pts.forEach(([x, y], i) => { const [sx, sy] = toScreen(_v.set(x, y, WIN.z)); i ? fx.lineTo(sx, sy) : fx.moveTo(sx, sy); });
  fx.closePath(); fx.clip();
}
let fade = 1;
function drawLine(L, color, width, alpha, cells = 5){
  fx.globalAlpha = alpha * fade; fx.strokeStyle = color; fx.lineWidth = width; fx.lineJoin = fx.lineCap = 'round';
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
  // 2D-Linien nur bei Blick durchs Fenster; schräg weich ausblenden, am Fensterrahmen abschneiden
  fade = overlayFade();
  if (fade < 0.01) return;
  fx.save(); clipWindow();
  if (rt.hoverBand){
    fx.globalAlpha = fade;
    rt.hoverBand.forEach(r => {
      const [x0, y0] = project(0, r), [x1] = project(4, r), ch = Math.abs(project(0, 1)[1] - project(0, 2)[1]);
      fx.fillStyle = '#ffc83a22'; fx.strokeStyle = '#ffc83a99'; fx.lineWidth = 2; fx.setLineDash([8, 6]);
      const pad = (x1 - x0) / 8;
      fx.fillRect(x0 - pad, y0 - ch / 2, x1 - x0 + pad * 2, ch); fx.strokeRect(x0 - pad, y0 - ch / 2, x1 - x0 + pad * 2, ch);
      fx.setLineDash([]);
    });
    fx.globalAlpha = 1;
  }
  if (S.showLines && !rt.present){
    activeLines().forEach(L => drawLine(L, L.color, 3, 0.75));
  }
  if (rt.present && rt.present.res.wins.length && !rt.spinning){
    const wins = rt.present.res.wins;
    if (rt.present.idx < 0) wins.forEach(wn => drawLine(wn.line, wn.line.color, 5, 0.95, wn.count));
    else { const wn = wins[rt.present.idx % wins.length]; drawLine(wn.line, wn.line.color, 6, 1, wn.count); }
  }
  fx.restore();
}
