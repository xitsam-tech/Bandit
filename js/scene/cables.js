/**
 * Verkabelung: Anschlusspunkte (Ports), Kabel (Litzenbündel, Flachband), Direktverbindungen, Kabelbinder, Clips
 * und die Prüfung `checkWiring()` (Kabelenden an Ports, nichts durch Walzen/Bauteile, alles im Gehäuse, Abdeckung).
 * Kabel verlaufen als Polylinien mit gerundeten Ecken (Gerade + quadratischer Bogen) entlang von Rahmen und Wänden.
 */
import { CELL_W, R, reelX } from './constants.js';
import { Batch, V, alignY, mergeGeometries } from './geo.js';

/** Datenstruktur der Verkabelung (für Prüfung und Tests über __bandit.mech.wiring). */
export const wiring = { ports:new Map(), cables:[], links:[], solids:[], required:[], ties:0, clips:0 };
const geoQueue = [];   // { geo, mat } – wird in flushCables zusammengefasst

/**
 * Anschluss registrieren.
 * @param {string} id  eindeutiger Name
 * @param {{pos:any, dir:any, part:string, plug?:any, quat?:any, kind?:string}} p
 */
export function registerPort(id, p){
  if (wiring.ports.has(id)) throw new Error('Port doppelt: ' + id);
  wiring.ports.set(id, { id, pos:p.pos.clone(), dir:(p.dir || V(0, 1, 0)).clone().normalize(), part:p.part, plug:p.plug || null, quat:p.quat || null, kind:p.kind || 'pin' });
}
/** Platinen-Ports (aus pcb.worldPorts) übernehmen. */
export function registerBoardPorts(list){ list.forEach(p => registerPort(p.id, { pos:p.pos, dir:p.dirW, part:p.part, plug:p.plug, quat:p.quat, kind:p.kind })); }
/** Großes Bauteil als Hindernis (Box3) bzw. als Kanal (Polylinie mit Radius). */
export function registerSolid(name, box){ wiring.solids.push({ name, box }); }
export function registerChannel(name, pts, r){ wiring.solids.push({ name, path:pts, r }); }
/** Bauteil-Anschluss, der direkt (gesteckt/gelötet, ohne freies Kabel) mit einem Port verbunden ist. */
export function link(from, to, note = ''){ wiring.links.push({ from, to, note }); }
/** Diese Ports müssen verbunden sein (Lampen, Tasten, Pflichtbaugruppen). */
export function requirePorts(...ids){ wiring.required.push(...ids); }

/** Polylinie mit gerundeten Ecken als Kurve. */
export function roundedPath(pts, rad = 0.12){
  const cp = new THREE.CurvePath(); let prev = pts[0];
  for (let i = 1; i < pts.length - 1; i++){
    const a = pts[i - 1], c = pts[i], b = pts[i + 1];
    const da = c.distanceTo(a), db = b.distanceTo(c);
    const r = Math.min(rad, da * (i === 1 ? 0.9 : 0.5), db * (i === pts.length - 2 ? 0.9 : 0.5));
    const p1 = c.clone().add(a.clone().sub(c).setLength(r)), p2 = c.clone().add(b.clone().sub(c).setLength(r));
    if (prev.distanceTo(p1) > 1e-4) cp.add(new THREE.LineCurve3(prev.clone(), p1));
    cp.add(new THREE.QuadraticBezierCurve3(p1, c.clone(), p2)); prev = p2;
  }
  cp.add(new THREE.LineCurve3(prev.clone(), pts[pts.length - 1].clone()));
  return cp;
}

const PLUG_MATS = {};
function plugMat(hex){ return PLUG_MATS[hex] || (PLUG_MATS[hex] = new THREE.MeshStandardMaterial({ color:hex, roughness:0.55 })); }
const WIRE_MATS = {};
function wireMat(hex){ return WIRE_MATS[hex] || (WIRE_MATS[hex] = new THREE.MeshStandardMaterial({ color:hex, roughness:0.45, metalness:0.05 })); }
let ribbonMat = null;
function getRibbonMat(){
  if (ribbonMat) return ribbonMat;
  const c = document.createElement('canvas'); c.width = 128; c.height = 4; const x = c.getContext('2d');
  for (let i = 0; i < 16; i++){ x.fillStyle = i === 0 ? '#b83030' : (i % 2 ? '#9a9ca3' : '#a9abb2'); x.fillRect(i * 8, 0, 8, 4); x.fillStyle = '#6e7076'; x.fillRect(i * 8 + 7, 0, 1, 4); }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  ribbonMat = new THREE.MeshStandardMaterial({ map:t, roughness:0.6, side:THREE.DoubleSide });
  return ribbonMat;
}
const steel = window.THREE ? new THREE.MeshStandardMaterial({ color:0x9aa0a8, metalness:0.85, roughness:0.4 }) : null;
const tieMat = window.THREE ? new THREE.MeshStandardMaterial({ color:0x1a1a1c, roughness:0.6 }) : null;
const extras = window.THREE ? new Batch() : null;

/**
 * Kabel von Port `from` zu Port `to` über Wegpunkte `via` (Weltkoordinaten).
 * opts.wires: Aderfarben (Litzenbündel) | opts.ribbon: Breite (Flachbandkabel); opts.r: Aderradius; opts.lead: gerades Stück am Stecker.
 */
export function cable(id, from, to, via = [], opts = {}){
  const A = wiring.ports.get(from), B = wiring.ports.get(to);
  if (!A || !B) throw new Error(`Kabel ${id}: Port fehlt (${!A ? from : to})`);
  const lead = opts.lead ?? 0.1, leadB = opts.leadB ?? lead;
  const pts = [A.pos.clone(), A.pos.clone().addScaledVector(A.dir, lead), ...via.map(p => Array.isArray(p) ? V(p[0], p[1], p[2]) : p), B.pos.clone().addScaledVector(B.dir, leadB), B.pos.clone()];
  const curve = roundedPath(pts.filter((p, i) => !i || p.distanceTo(pts[i - 1]) > 1e-4), opts.bend ?? 0.12);
  const len = curve.getLength(), N = Math.max(12, Math.ceil(len / 0.06));
  const ribbon = opts.ribbon || 0, wires = opts.wires || ['#202024', '#b02020'], wr = opts.r || 0.011;
  let radius;
  if (ribbon){
    geoQueue.push({ geo:ribbonGeometry(curve, N, ribbon, opts.normal || V(1, 0, 0), opts.normal0), mat:getRibbonMat() });
    radius = ribbon / 2;
  } else {
    const k = wires.length, rb = k > 1 ? wr * (k <= 3 ? 1.05 : 1.6) : 0;
    const frames = curve.computeFrenetFrames(N, false);
    wires.forEach((col, j) => {
      const th = j / k * Math.PI * 2 + (opts.phase || 0), wpts = [];
      for (let i = 0; i <= N; i++){
        const u = i / N, p = curve.getPointAt(u);
        // am Stecker liegen die Adern nebeneinander, im Verlauf gebündelt
        wpts.push(p.addScaledVector(frames.normals[i], Math.cos(th) * rb).addScaledVector(frames.binormals[i], Math.sin(th) * rb));
      }
      geoQueue.push({ geo:new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wpts), N, wr, 5, false), mat:wireMat(col) });
    });
    radius = rb + wr;
    // Kabelbinder am eigenen Bündel (nicht direkt am Stecker)
    if (k > 1 && opts.ties !== false) for (let s = 0.3; s < len - 0.25; s += opts.tieStep || 0.55){
      const u = s / len; addTie(curve.getPointAt(u), curve.getTangentAt(u), radius + 0.006);
    }
  }
  // Gegenstecker an beiden Enden (Teil des Kabels)
  [A, B].forEach(P => {
    if (!P.plug) return;
    const pl = P.plug, m = new THREE.Matrix4().compose(P.pos.clone().addScaledVector(P.dir, -pl.h / 2), P.quat || new THREE.Quaternion(), V(1, 1, 1));
    extras.add(new THREE.BoxGeometry(pl.w, pl.h, pl.d), plugMat(ribbon ? 0x3a3b40 : 0xefece2), m);
  });
  const samples = curve.getSpacedPoints(Math.max(20, Math.ceil(len / 0.02)));
  wiring.cables.push({ id, from, to, kind:ribbon ? 'ribbon' : 'wire', wires:ribbon ? 16 : wires.length, r:radius, len, samples, curve });
  return curve;
}

/** Flachbandkabel als dünnes Band; die Bandnormale wird entlang der Kurve mitgeführt und sanft zu `hint` gezogen. */
function ribbonGeometry(curve, N, width, hint, normal0){
  const t = 0.012, pos = [], nor = [], uv = [], idx = [];
  let n = null;
  const P = [], S = [], Nn = [];
  for (let i = 0; i <= N; i++){
    const u = i / N, p = curve.getPointAt(u), T = curve.getTangentAt(u).normalize();
    const h = hint.clone().addScaledVector(T, -hint.dot(T));
    if (!n){
      const h0 = normal0 ? normal0.clone().addScaledVector(T, -normal0.dot(T)) : h;
      n = h0.lengthSq() > 1e-4 ? h0.normalize() : V(0, 1, 0).addScaledVector(T, -T.y).normalize();
    }
    else { n.addScaledVector(T, -n.dot(T)); if (h.lengthSq() > 1e-4) n.addScaledVector(h.normalize(), 0.08); n.normalize(); }
    P.push(p); Nn.push(n.clone()); S.push(new THREE.Vector3().crossVectors(T, n).normalize());
  }
  // vier Seiten: oben, unten, zwei Kanten – je eigene Vertices für harte Normalen
  const faces = [[1, 0, 1, 1], [-1, 0, 0, 0], [0, 1, 1, 1], [0, -1, 0, 0]];
  faces.forEach(([sn, ss]) => {
    const base = pos.length / 3;
    for (let i = 0; i <= N; i++){
      const p = P[i], s = S[i], nn = Nn[i], v = i / N * curvelen(curve) * 4;
      for (const side of [-1, 1]){
        let q;
        if (sn) q = p.clone().addScaledVector(s, side * width / 2).addScaledVector(nn, sn * t / 2);
        else q = p.clone().addScaledVector(s, ss * width / 2).addScaledVector(nn, side * t / 2);
        pos.push(q.x, q.y, q.z);
        const fn = sn ? nn.clone().multiplyScalar(sn) : s.clone().multiplyScalar(ss);
        nor.push(fn.x, fn.y, fn.z);
        uv.push(sn ? (side + 1) / 2 : (ss + 1) / 2, v);
      }
    }
    for (let i = 0; i < N; i++){ const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
function curvelen(c){ return c.__len || (c.__len = c.getLength()); }

/** Kabelbinder (schwarzer Ring mit Schloss) um ein Bündel. */
export function addTie(p, dir, r){
  const m = alignY(p, dir);
  extras.add(new THREE.CylinderGeometry(r, r, 0.022, 10, 1, true), tieMat, m);
  extras.add(new THREE.BoxGeometry(0.03, 0.026, 0.03), tieMat, m.clone().multiply(new THREE.Matrix4().makeTranslation(r + 0.01, 0, 0)));
  wiring.ties++;
}
/** P-Clip aus Blech mit Schraube: hält ein Bündel (Radius r) an einer Fläche mit Normale `wall`. */
export function addClip(p, dir, wall, r){
  const d = dir.clone().normalize(), n = wall.clone().normalize();
  const m = alignY(p, d);
  extras.add(new THREE.TorusGeometry(r + 0.012, 0.008, 6, 16), steel, m.clone().multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
  const foot = p.clone().addScaledVector(n, -(r + 0.016));
  const side = new THREE.Vector3().crossVectors(d, n).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, n, d));
  extras.add(new THREE.BoxGeometry(0.16, 0.008, 0.035), steel, new THREE.Matrix4().compose(foot.clone().addScaledVector(side, 0.05), q, V(1, 1, 1)));
  extras.add(new THREE.CylinderGeometry(0.016, 0.016, 0.01, 10), steel, new THREE.Matrix4().compose(foot.clone().addScaledVector(side, 0.09).addScaledVector(n, 0.006), q, V(1, 1, 1)));
  wiring.clips++;
}

/** Alle Kabelgeometrien je Material zusammenfassen und über `addFn` einhängen. */
export function flushCables(addFn){
  const by = new Map();
  geoQueue.forEach(({ geo, mat }) => { if (!by.has(mat)) by.set(mat, []); by.get(mat).push({ geo }); });
  by.forEach((list, mat) => addFn(new THREE.Mesh(mergeGeometries(list), mat)));
  geoQueue.length = 0;
  extras.flush(addFn);
}

/* ----- Gehäuse-Innenraum (Vereinigung von Quadern + Pultkeil) ----- */
const INTERIOR = [
  [-3.97, -3.05, -4.22, 3.97, 3.25, 0.3],    // Oberteil
  [-3.97, -5.17, -4.02, 3.97, -3.0, 0.3],    // Unterteil
  [-3.35, 3.2, -1.95, 3.35, 4.9, 0.1]        // Aufsatz (Schild)
];
export function insideCabinet(p){
  if (INTERIOR.some(b => p.x > b[0] && p.y > b[1] && p.z > b[2] && p.x < b[3] && p.y < b[4] && p.z < b[5])) return true;
  // Tasten-Pult: Keil zwischen z 0.3 und 1.25, unter der Schräge, über dem Boden
  if (Math.abs(p.x) < 3.97 && p.z > 0.25 && p.z < 1.22){
    const f = (p.z - 0.3) / 0.95, yTop = -2.95 - 0.9 * f, yBot = -4.08 + 0.1 * f;
    return p.y < yTop - 0.02 && p.y > yBot + 0.02;
  }
  return false;
}

/**
 * Prüft alle Kabel. Liefert Zähler und Listen der Verstöße (leer = in Ordnung).
 * @returns {{cables:number, ports:number, links:number, ties:number, clips:number, open:string[], reelHits:string[], solidHits:string[], outside:string[], unconnected:string[], unusedPorts:string[], minReelClearance:number}}
 */
export function checkWiring(){
  const res = { cables:wiring.cables.length, ports:wiring.ports.size, links:wiring.links.length, ties:wiring.ties, clips:wiring.clips,
    open:[], reelHits:[], solidHits:[], outside:[], unconnected:[], unusedPorts:[], minReelClearance:Infinity };
  const used = new Set();
  wiring.links.forEach(l => { used.add(l.from); used.add(l.to); if (!wiring.ports.has(l.from) || !wiring.ports.has(l.to)) res.open.push('link ' + l.from + '→' + l.to); });
  const zc = -R, half = CELL_W / 2 + 0.03, rr = R + 0.08;
  wiring.cables.forEach(c => {
    used.add(c.from); used.add(c.to);
    const s = c.samples, A = wiring.ports.get(c.from), B = wiring.ports.get(c.to);
    if (!A || s[0].distanceTo(A.pos) > 0.02) res.open.push(c.id + ':Anfang');
    if (!B || s[s.length - 1].distanceTo(B.pos) > 0.02) res.open.push(c.id + ':Ende');
    let reel = false, solid = '', out = false;
    s.forEach((p, i) => {
      for (let k = 0; k < 5; k++){
        const dx = Math.abs(p.x - reelX(k)) - c.r, dr = Math.hypot(p.y, p.z - zc) - c.r;
        // Abstand zum Walzenzylinder (positiv = außerhalb)
        const clear = Math.max(dx - half, dr - rr);
        res.minReelClearance = Math.min(res.minReelClearance, clear);
        if (clear < 0) reel = true;
      }
      if (!insideCabinet(p)) out = true;
      const nearEnd = p.distanceTo(s[0]) < 0.16 || p.distanceTo(s[s.length - 1]) < 0.16;
      if (!nearEnd) wiring.solids.forEach(o => {
        if (o.box){ if (o.box.distanceToPoint(p) < c.r * 0.6 && !solid) solid = o.name; }
        else if (!solid && distToPath(p, o.path) < o.r + c.r) solid = o.name;
      });
    });
    if (reel) res.reelHits.push(c.id);
    if (solid) res.solidHits.push(c.id + ' ↔ ' + solid);
    if (out) res.outside.push(c.id);
  });
  wiring.required.forEach(id => { if (!used.has(id)) res.unconnected.push(id); });
  wiring.ports.forEach((p, id) => { if (!used.has(id)) res.unusedPorts.push(id); });
  res.minReelClearance = +res.minReelClearance.toFixed(3);
  return res;
}
function distToPath(p, pts){
  let best = Infinity; const ab = new THREE.Vector3(), ap = new THREE.Vector3();
  for (let i = 1; i < pts.length; i++){
    ab.subVectors(pts[i], pts[i - 1]); ap.subVectors(p, pts[i - 1]);
    const t = Math.max(0, Math.min(1, ap.dot(ab) / ab.lengthSq()));
    best = Math.min(best, ap.addScaledVector(ab, -t).length());
  }
  return best;
}
