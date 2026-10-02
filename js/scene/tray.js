/**
 * Münzschale: tiefgezogene Edelstahlmulde mit gerundeten Innenkanten und zur Auswurföffnung hin abfallendem Rand,
 * Gummimatte, verchromter Bördelrand mit Griffkante vorne, Blende mit Pendelklappe über der Auswurföffnung,
 * kleine Schalenbeleuchtung, Haltekonsole. Maße kommen aus TRAY (lower-cabinet.js), die Münzphysik nutzt dieselben.
 */
import { now } from '../core/util.js';
import { world } from './context.js';
import { V, brushedTexture } from './geo.js';

/** Abgerundetes Rechteck mit fester Punktzahl (gleiche Reihenfolge für alle Ringe). */
function rrPoints(hw, hd, r, n = 10){
  r = Math.max(0.005, Math.min(r, hw - 0.001, hd - 0.001));
  const pts = [], corners = [[hw - r, hd - r, 0], [-hw + r, hd - r, 1], [-hw + r, -hd + r, 2], [hw - r, -hd + r, 3]];
  corners.forEach(([cx, cz, k]) => { for (let i = 0; i <= n; i++){ const a = (k + i / n) * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } });
  return pts;
}

/**
 * @param {{x0:number,x1:number,z0:number,z1:number,floor:number,top:number,back:number,r:number,fillet:number,mat:number}} T
 * @param {any} chrome
 */
export function buildTray(T, chrome){
  const cx = (T.x0 + T.x1) / 2, cz = (T.z0 + T.z1) / 2, hw = (T.x1 - T.x0) / 2, hd = (T.z1 - T.z0) / 2;
  const f = T.fillet, draft = 0.03, th = 0.022;
  // Randhöhe: hinten niedrig (Auswurföffnung), vorne hoch – weicher Übergang
  const yTop = z => { const u = Math.min(1, Math.max(0, (z - T.z0) / (T.z1 - T.z0))); const s = u * u * (3 - 2 * u); return T.back + (T.top - T.back) * Math.min(1, s * 1.6); };
  // Profil je Umfangspunkt: (Einzug, Höhe) – Wand mit leichter Schräge, Bodenrundung, Boden
  const rings = [];
  const WALL = 5, FIL = 5;
  for (let k = 0; k <= WALL; k++) rings.push({ inset:draft * k / WALL, y:t => yTop(t) + (T.floor + f - yTop(t)) * k / WALL });
  for (let k = 1; k <= FIL; k++){ const a = k / FIL * Math.PI / 2; rings.push({ inset:draft + f * (1 - Math.cos(a)), y:() => T.floor + f - f * Math.sin(a) }); }
  const base = rrPoints(hw, hd, T.r), M = base.length;
  const shell = (sign) => {
    const pos = [], idx = [];
    rings.forEach(rg => {
      const ins = rg.inset - (sign < 0 ? th : 0), pts = rrPoints(hw - ins, hd - ins, T.r - ins);
      pts.forEach(([x, z], i) => { const zw = cz + base[i][1]; pos.push(cx + x, rg.y(zw) - (sign < 0 ? th : 0), cz + z); });
    });
    for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < M; i++){
      const a = k * M + i, b = k * M + (i + 1) % M, c = a + M, d = b + M;
      if (sign > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
    // Boden als Fächer
    const last = (rings.length - 1) * M, ctr = pos.length / 3;
    pos.push(cx, T.floor - (sign < 0 ? th : 0), cz);
    for (let i = 0; i < M; i++){ const a = last + i, b = last + (i + 1) % M; if (sign > 0) idx.push(ctr, b, a); else idx.push(ctr, a, b); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    // UV: Umfang × Höhe (für die Schliffrichtung)
    const uv = []; for (let i = 0; i < pos.length / 3; i++) uv.push(pos[i * 3] * 0.6, (pos[i * 3 + 1] + pos[i * 3 + 2]) * 0.6);
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  };
  const tex = brushedTexture().clone(); tex.needsUpdate = true; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const steel = new THREE.MeshStandardMaterial({ color:0xd5d9df, map:tex, metalness:0.88, roughness:0.3, envMapIntensity:1.25, side:THREE.DoubleSide });
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(shell(1), steel), new THREE.Mesh(shell(-1), steel));
  // Bördelrand (Rolle) entlang der Oberkante, vorne dickere Griffkante
  const rim = base.map(([x, z]) => V(cx + x * (1 + 0.012 / hw), yTop(cz + z) + 0.008, cz + z * (1 + 0.012 / hd)));
  grp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 240, 0.024, 10, true), chrome));
  const grip = new THREE.CatmullRomCurve3([V(T.x0 + 0.12, T.top - 0.03, T.z1 + 0.035), V(cx, T.top - 0.02, T.z1 + 0.055), V(T.x1 - 0.12, T.top - 0.03, T.z1 + 0.035)]);
  grp.add(new THREE.Mesh(new THREE.TubeGeometry(grip, 48, 0.045, 14, false), chrome));
  [T.x0 + 0.12, T.x1 - 0.12].forEach(x => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), chrome); s.position.set(x, T.top - 0.03, T.z1 + 0.035); grp.add(s); });
  // Gummimatte mit Noppen
  const mc = document.createElement('canvas'); mc.width = mc.height = 128; const mx = mc.getContext('2d');
  mx.fillStyle = '#17171a'; mx.fillRect(0, 0, 128, 128);
  for (let y = 8; y < 128; y += 16) for (let x = (y / 16 % 2) * 8 + 4; x < 128; x += 16){ const gr = mx.createRadialGradient(x - 1, y - 1, 0, x, y, 5); gr.addColorStop(0, '#4a4a52'); gr.addColorStop(1, '#1d1d21'); mx.fillStyle = gr; mx.beginPath(); mx.arc(x, y, 4.5, 0, 7); mx.fill(); }
  const mt = new THREE.CanvasTexture(mc); mt.wrapS = mt.wrapT = THREE.RepeatWrapping; mt.repeat.set(7, 3); mt.encoding = THREE.sRGBEncoding;
  const inset = draft + f + 0.01, mshape = new THREE.Shape(rrPoints(hw - inset, hd - inset, T.r - inset).map(([x, z]) => new THREE.Vector2(x, -z)));
  const matGeo = new THREE.ExtrudeGeometry(mshape, { depth:T.mat, bevelEnabled:true, bevelThickness:0.004, bevelSize:0.006, bevelSegments:1 });
  matGeo.rotateX(-Math.PI / 2);
  const uvA = matGeo.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) / (hw * 2), uvA.getY(i) / (hd * 2));
  const mat = new THREE.Mesh(matGeo, new THREE.MeshStandardMaterial({ map:mt, roughness:0.92, metalness:0 }));
  mat.position.set(cx, T.floor + 0.002, cz); grp.add(mat);
  // weicher Lichtschein der Schalenlampe auf der Matte
  const lc = document.createElement('canvas'); lc.width = lc.height = 64; const lx = lc.getContext('2d');
  const lg = lx.createRadialGradient(32, 32, 0, 32, 32, 32); lg.addColorStop(0, 'rgba(255,214,150,0.32)'); lg.addColorStop(1, 'rgba(255,214,150,0)');
  lx.fillStyle = lg; lx.fillRect(0, 0, 64, 64);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.0), new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(lc), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
  glow.rotation.x = -Math.PI / 2; glow.position.set(cx, T.floor + T.mat + 0.01, T.z0 + 0.42); grp.add(glow);
  // Haltekonsole: Flansch an der Front, zwei Streben zum Sockelfuß
  const flange = new THREE.Mesh(new THREE.BoxGeometry(T.x1 - T.x0 + 0.1, 0.16, 0.03), chrome); flange.position.set(cx, T.floor - 0.02, T.z0 - 0.04); grp.add(flange);
  [-1, 1].forEach(s => {
    const a = V(cx + s * (hw - 0.4), T.floor - th - 0.01, T.z0 + 0.95), b = V(cx + s * (hw - 0.4), -5.51, T.z0 + 0.12), d = b.clone().sub(a);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.06, d.length(), 0.03), chrome);
    st.position.copy(a).add(b).multiplyScalar(0.5); st.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); grp.add(st);
    [-0.6, 0.6].forEach(o => { const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 12), chrome); sc.rotation.x = Math.PI / 2; sc.position.set(cx + s * 0.25 + o * hw * 0.9, T.floor - 0.02, T.z0 - 0.022); grp.add(sc); });
  });
  world.scene.add(grp);
  return grp;
}

/**
 * Blende über der Auswurföffnung mit Pendelklappe (öffnet, solange Münzen kommen) und Schalenlampe.
 * @returns {{ flap:any, lamp:any }}
 */
export function buildMouth(x, y, z, w, chrome){
  const g = new THREE.Group(); g.position.set(x, y, z);
  const hoodShape = new THREE.Shape(); hoodShape.moveTo(0, 0); hoodShape.lineTo(0.26, -0.02); hoodShape.quadraticCurveTo(0.3, -0.03, 0.29, -0.07); hoodShape.lineTo(0.26, -0.08); hoodShape.quadraticCurveTo(0.25, -0.04, 0, -0.035); hoodShape.closePath();
  const hood = new THREE.Mesh(new THREE.ExtrudeGeometry(hoodShape, { depth:w + 0.16, bevelEnabled:false, curveSegments:8 }), chrome);
  hood.rotation.y = -Math.PI / 2; hood.position.set((w + 0.16) / 2, 0.14, 0); g.add(hood);
  [-1, 1].forEach(s => { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.26), chrome); ch.position.set(s * (w / 2 + 0.065), 0.05, 0.13); g.add(ch); });
  // Lampe unter der Blende (Lichtleiste)
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.018, 0.03), new THREE.MeshBasicMaterial({ color:0xffd9a0, toneMapped:false }));
  lamp.position.set(0, 0.09, 0.2); g.add(lamp);
  // Pendelklappe aus getöntem Kunststoff, am vorderen Rand der Blende angeschlagen
  const flap = new THREE.Group(); flap.position.set(0, 0.075, 0.24); g.add(flap);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, 0.012), new THREE.MeshPhysicalMaterial({ color:0x2a1c10, roughness:0.15, transparent:true, opacity:0.55, clearcoat:1 }));
  plate.position.y = -0.1; flap.add(plate);
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, w + 0.08, 10), chrome); hinge.rotation.z = Math.PI / 2; flap.add(hinge);
  flap.userData.open = 0;
  world.scene.add(g);
  return { flap, lamp, group:g };
}

/** Klappe öffnet sich, solange der Hopper auszahlt, und pendelt danach zurück. */
export function updateMouth(m, dt){
  if (!m) return;
  const want = world.coins && now() < world.coins.emitUntil + 150 ? 1 : 0;
  m.flap.userData.open += (want - m.flap.userData.open) * Math.min(1, dt * (want ? 12 : 3));
  m.flap.rotation.x = -m.flap.userData.open * 1.15 - Math.sin(now() / 90) * 0.04 * m.flap.userData.open;
}
