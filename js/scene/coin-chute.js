/**
 * Münzweg aus Blech: Einlaufrinne (Einwurf → Münzprüfer), Fallkanal mit Schrägrinne zum Hopper und die
 * breite Auszahlrutsche vom Hopper zur Auswurföffnung. U-Profil aus gebürstetem Stahl, entlang eines Pfades
 * gezogen, mit Haltelaschen und Schrauben. Die eingeworfene Münze rollt sichtbar in der Rinne.
 */
import { S } from '../core/state.js';
import { now } from '../core/util.js';
import { world } from './context.js';
import { Batch, V, alignY, brushedTexture } from './geo.js';

const COIN_R = 0.13;
/** Pfade (Mittelpunkt der rollenden Münze bzw. Boden der Auszahlrutsche) – auch für die Kabelprüfung. */
export const CHUTE = {
  entry:   [V(3.55, 2.2, 0.36), V(3.55, 2.13, 0.0), V(3.55, 2.06, -0.36)],
  drop:    [V(3.55, 1.64, -0.6), V(3.55, -2.45, -0.6), V(3.12, -3.72, -1.92)],
  payout:  [V(1.92, -4.6, -1.5), V(1.05, -4.83, -0.72), V(0, -5.08, 0.3)],
  dropSide: V(-0.32, 0, -0.95).normalize(),
  hopperDrop: V(2.7, -4.12, -2.25)
};

/** Rahmen entlang der Kurve: T Tangente, U Öffnungsrichtung der Rinne, Sd = T × U (Normale der Seitenwände). */
function frames(curve, N, side, k = 0.25){
  const out = [], up = V(0, 1, 0);
  for (let i = 0; i <= N; i++){
    const u = i / N, T = curve.getTangentAt(u).normalize();
    const a = up.clone().addScaledVector(T, -T.y), b = side.clone().addScaledVector(T, -side.dot(T));
    const U = a.add(b.multiplyScalar(k)).normalize();
    out.push({ p:curve.getPointAt(u), T, U, Sd:new THREE.Vector3().crossVectors(T, U).normalize() });
  }
  return out;
}

/**
 * U-Profil entlang der Rahmen. Profil relativ zur Bodenmitte (Sd, U): Innenbreite w(u), Wandhöhe h, Blechstärke th,
 * gerundete Innenkanten. offset: Abstand Pfad → Boden (bei rollender Münze = Münzradius).
 */
function channelGeometry(fr, { w, h, th = 0.014, offset = 0 }){
  const pos = [], nor = [], uv = [], idx = [];
  const N = fr.length - 1;
  const profile = u => {
    const a = w(u) / 2, f = Math.min(0.035, a * 0.4), F = f + th, pts = [[-a - th, h], [-a, h], [-a, f]];
    for (let k = 1; k < 4; k++){ const t = k / 4 * Math.PI / 2; pts.push([-a + f - f * Math.cos(t), f - f * Math.sin(t)]); }
    pts.push([-a + f, 0], [a - f, 0]);
    for (let k = 1; k < 4; k++){ const t = k / 4 * Math.PI / 2; pts.push([a - f + f * Math.sin(t), f - f * Math.cos(t)]); }
    pts.push([a, f], [a, h], [a + th, h], [a + th, f]);
    for (let k = 1; k < 4; k++){ const t = k / 4 * Math.PI / 2; pts.push([a - f + F * Math.cos(t), f - F * Math.sin(t)]); }
    pts.push([a - f, -th], [-a + f, -th]);
    for (let k = 1; k < 4; k++){ const t = k / 4 * Math.PI / 2; pts.push([-a + f - F * Math.sin(t), f - F * Math.cos(t)]); }
    pts.push([-a - th, f], [-a - th, h]);
    return pts;
  };
  let vlen = 0;
  const M = profile(0).length;
  for (let s = 0; s < M - 1; s++){
    const base = pos.length / 3; vlen = 0;
    for (let i = 0; i <= N; i++){
      const F = fr[i], pr = profile(i / N), p0 = pr[s], p1 = pr[s + 1];
      if (i) vlen += F.p.distanceTo(fr[i - 1].p);
      const floor = F.p.clone().addScaledVector(F.U, -offset);
      // Kantennormale im Profil: (dy, -dx) gedreht in (Sd, U)
      const ex = p1[0] - p0[0], ey = p1[1] - p0[1], el = Math.hypot(ex, ey) || 1;
      const n = F.Sd.clone().multiplyScalar(-ey / el).addScaledVector(F.U, ex / el);
      [p0, p1].forEach((q, j) => {
        const v = floor.clone().addScaledVector(F.Sd, q[0]).addScaledVector(F.U, q[1]);
        pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); uv.push((s + j) / (M - 1) * 2, vlen * 2);
      });
    }
    for (let i = 0; i < N; i++){ const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

let coinTrack = null;   // [{ p, Sd, d }] – Bahn der eingeworfenen Münze

/**
 * Baut alle Rinnen; `add` hängt Meshes ins Innenleben (nur im Glas-Gehäuse sichtbar).
 * @returns {{ channels: {name:string, path:any[], r:number}[] }}
 */
export function buildCoinChutes(add){
  const tex = brushedTexture().clone(); tex.needsUpdate = true; tex.repeat.set(1, 1);
  const sheet = new THREE.MeshStandardMaterial({ color:0xc9ced6, map:tex, metalness:0.85, roughness:0.38, envMapIntensity:1.0, side:THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({ color:0x9aa0a8, metalness:0.85, roughness:0.4 });
  const b = new Batch();
  const curve = (pts, r) => roundedCurve(pts, r);

  // Einlaufrinne: Einwurfschlitz → Münzprüfer (oben offen)
  const cE = curve(CHUTE.entry, 0.2), fE = frames(cE, 16, V(1, 0, 0), 0);
  add(new THREE.Mesh(channelGeometry(fE, { w:() => 0.075, h:0.3, offset:COIN_R }), sheet));
  // Fallkanal + Schrägrinne zum Hopper (Öffnung zeigt in Laufrichtung der Schräge bzw. nach oben)
  const cD = curve(CHUTE.drop, 0.55), fD = frames(cD, 90, CHUTE.dropSide);
  add(new THREE.Mesh(channelGeometry(fD, { w:() => 0.075, h:0.3, offset:COIN_R }), sheet));
  // Auszahlrutsche: flach, weitet sich zur Auswurföffnung hin trichterförmig auf
  const cP = curve(CHUTE.payout, 0.6), fP = frames(cP, 40, V(0, 1, 0));
  const widen = u => 0.4 + (1.36 - 0.4) * smooth(Math.max(0, (u - 0.45) / 0.55));
  add(new THREE.Mesh(channelGeometry(fP, { w:widen, h:0.1, offset:0 }), sheet));

  // Haltelaschen am Fallkanal (zur rechten Gehäusewand) mit Schrauben
  [1.2, -0.2, -1.6].forEach(y => strap(b, steel, V(3.55 + 0.052, y, -0.6 + 0.02), V(3.955, y, -0.6 + 0.02)));
  // Schrägrinne: Winkel zur Wand, Auslauf über dem Hopper mit Stütze
  const pm = cD.getPointAt(0.86), pe = cD.getPointAt(0.97);
  strap(b, steel, V(pm.x + 0.06, pm.y - 0.14, pm.z), V(3.955, pm.y - 0.14, pm.z));
  strut(b, steel, V(pe.x, pe.y - 0.2, pe.z), V(pe.x + 0.4, -5.17, pe.z + 0.1));
  // Einlaufrinne: Lasche am Münzprüfer
  b.box(0.12, 0.012, 0.08, steel, [3.55, 1.92, -0.33]);
  // Auszahlrutsche: zwei Füße zum Boden und Flansch an der Auswurföffnung
  [0.3, 0.62].forEach(u => { const p = cP.getPointAt(u); strut(b, steel, V(p.x, p.y - 0.02, p.z), V(p.x, -5.17, p.z)); });
  b.box(1.5, 0.012, 0.06, steel, [0, -5.1, 0.33]);
  b.flush(add);

  // Bahn der eingeworfenen Münze: vor dem Schlitz → Einlauf → Münzprüfer (verdeckt) → Fallkanal → Schräge → Hopper
  const track = [];
  const push = (p, Sd) => { const d = track.length ? track[track.length - 1].d + p.distanceTo(track[track.length - 1].p) : 0; track.push({ p:p.clone(), Sd:Sd.clone(), d }); };
  push(V(3.55, 2.24, 0.75), V(1, 0, 0)); push(V(3.55, 2.22, 0.42), V(1, 0, 0));
  fE.forEach(F => push(F.p, F.Sd));
  push(V(3.55, 2.0, -0.6), fD[0].Sd); push(V(3.55, 1.72, -0.6), fD[0].Sd);
  fD.forEach(F => push(F.p, F.Sd));
  const last = fD[fD.length - 1], fall = CHUTE.hopperDrop;
  for (let k = 1; k <= 6; k++){ const t = k / 6; push(last.p.clone().lerp(fall, t).add(V(0, 0.25 * Math.sin(t * Math.PI) * (1 - t), 0)), last.Sd); }
  coinTrack = track;
  return { channels:[
    { name:'Einlaufrinne', path:fE.map(F => F.p), r:0.16 },
    { name:'Fallkanal', path:fD.map(F => F.p), r:0.16 },
    { name:'Auszahlrutsche', path:fP.map((F, i) => F.p.clone().addScaledVector(F.U, 0.05)), r:0.25 }
  ] };
}
const smooth = t => t * t * (3 - 2 * t);
function roundedCurve(pts, r){
  // Polylinie mit Bögen (wie bei Kabeln), aber als glatte CatmullRom-Kurve durch dicht gesetzte Punkte
  const cp = new THREE.CurvePath(); let prev = pts[0];
  for (let i = 1; i < pts.length - 1; i++){
    const a = pts[i - 1], c = pts[i], b = pts[i + 1], rr = Math.min(r, c.distanceTo(a) * 0.5, b.distanceTo(c) * 0.5);
    const p1 = c.clone().add(a.clone().sub(c).setLength(rr)), p2 = c.clone().add(b.clone().sub(c).setLength(rr));
    cp.add(new THREE.LineCurve3(prev.clone(), p1)); cp.add(new THREE.QuadraticBezierCurve3(p1, c.clone(), p2)); prev = p2;
  }
  cp.add(new THREE.LineCurve3(prev.clone(), pts[pts.length - 1].clone()));
  return cp;
}
/** Haltelasche (Blechstreifen) von a nach b mit Niet am Kanal und Schraube an der Wand. */
function strap(b, mat, a, w){
  const d = w.clone().sub(a), len = d.length(), mid = a.clone().add(w).multiplyScalar(0.5);
  b.add(new THREE.BoxGeometry(0.05, len, 0.012), mat, alignY(mid, d));
  b.add(new THREE.BoxGeometry(0.012, 0.09, 0.07), mat, alignY(w.clone().addScaledVector(d, -0.006 / len), V(0, 1, 0)));
  b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 10), mat, alignY(w.clone().addScaledVector(d, -0.016 / len), d));
  b.add(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8), mat, alignY(a, d));
}
/** Stütze (Vierkantrohr) von a nach b mit Fußplatte. */
function strut(b, mat, a, w){
  const d = w.clone().sub(a), mid = a.clone().add(w).multiplyScalar(0.5);
  b.add(new THREE.BoxGeometry(0.035, d.length(), 0.035), mat, alignY(mid, d));
  b.add(new THREE.BoxGeometry(0.12, 0.012, 0.12), mat, alignY(w.clone().add(V(0, 0.006, 0)), V(0, 1, 0)));
}

/* ----- eingeworfene Münze ----- */
let coinRun = null;
const _q = window.THREE ? new THREE.Quaternion() : null, _q2 = window.THREE ? new THREE.Quaternion() : null, _y = window.THREE ? V(0, 1, 0) : null;
export function startCoinRun(){
  if (!world.scene || !coinTrack) return;
  if (!coinRun){
    coinRun = new THREE.Mesh(new THREE.CylinderGeometry(COIN_R, COIN_R, 0.03, 24), new THREE.MeshStandardMaterial({ color:0xd8b25a, metalness:1, roughness:0.25 }));
    world.scene.add(coinRun);
  }
  coinRun.visible = true; coinRun.userData.t0 = now();
}
export function updateCoinRun(t){
  if (!coinRun || !coinRun.visible) return;
  const x = (t - coinRun.userData.t0) / (S.turbo ? 850 : 1700);
  if (x >= 1){ coinRun.visible = false; return; }
  // leicht beschleunigt (Schwerkraft), Lage aus der Rinne, Abrollen um die Münzachse
  const total = coinTrack[coinTrack.length - 1].d, d = total * (0.35 * x + 0.65 * x * x);
  let i = 1; while (i < coinTrack.length - 1 && coinTrack[i].d < d) i++;
  const A = coinTrack[i - 1], B = coinTrack[i], f = Math.min(1, Math.max(0, (d - A.d) / Math.max(1e-6, B.d - A.d)));
  coinRun.position.copy(A.p).lerp(B.p, f);
  const ax = A.Sd.clone().lerp(B.Sd, f).normalize();
  _q.setFromUnitVectors(_y, ax); _q2.setFromAxisAngle(_y, d / COIN_R);
  coinRun.quaternion.copy(_q).multiply(_q2);
}
