/** Three.js-Hilfen: Canvas-Texturen, Formen, Rahmen, Neonröhren, Lampen-Texturen. */
import { world } from './context.js';

export function canvasTex(canvas){
  const t = new THREE.CanvasTexture(canvas);
  t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  return t;
}
export function rrShape(w, h, r, cx = 0, cy = 0, PathType = THREE.Shape){
  const s = new PathType(), x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
export function frameMesh(ow, oh, iw, ih, r, depth, mat){
  const sh = rrShape(ow, oh, r); sh.holes.push(rrShape(iw, ih, Math.max(0.02, r * 0.6), 0, 0, THREE.Path));
  const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled:true, bevelThickness:0.03, bevelSize:0.03, bevelSegments:3, curveSegments:12 });
  return new THREE.Mesh(geo, mat);
}
export function archShape(w, h, rise){
  const s = new THREE.Shape(), x = w / 2, y = h / 2;
  s.moveTo(-x + 0.3, -y); s.lineTo(x - 0.3, -y); s.quadraticCurveTo(x, -y, x, -y + 0.3);
  s.lineTo(x, y - 0.25); s.quadraticCurveTo(0, y + rise, -x, y - 0.25);
  s.lineTo(-x, -y + 0.3); s.quadraticCurveTo(-x, -y, -x + 0.3, -y);
  return s;
}
export function neonTube(w, h, r, radius, color, shape){
  const pts = (shape || rrShape(w, h, r)).getSpacedPoints(160).map(p => new THREE.Vector3(p.x, p.y, 0)); pts.pop();
  const curve = new THREE.CatmullRomCurve3(pts, true);
  const mat = new THREE.MeshBasicMaterial({ color, toneMapped:false });
  world.neonMats.push({ mat, base: new THREE.Color(color) });
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 320, radius, 8, true), mat);
}
export function circleTex(text, lit){
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(54, 50, 6, 64, 64, 64);
  if (lit){ g.addColorStop(0, '#fff6c8'); g.addColorStop(0.5, '#ffc83a'); g.addColorStop(1, '#a8680a'); }
  else { g.addColorStop(0, '#3a2c55'); g.addColorStop(1, '#130c22'); }
  x.fillStyle = g; x.beginPath(); x.arc(64, 64, 64, 0, 7); x.fill();
  x.font = `400 ${text.length > 1 ? 34 : 56}px Bungee, Impact, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = lit ? '#3a1d00' : '#8f7cc0'; x.fillText(text, 64, 68);
  return canvasTex(c);
}
