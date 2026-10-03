/**
 * Platinen: prozedurales Layout (Leiterbahnen nur 0°/45°/90°, Busse, Masseflächen, Pads, Vias, Bestückungsdruck)
 * als CanvasTexture plus 3D-Bauteile (DIP-ICs, Elkos, Widerstände mit Farbringen, Quarz, Stiftleisten, Wannenstecker).
 * Koordinaten der Platine: x nach rechts, z nach „unten“ im Layout, y = Bestückungsseite (oben).
 */
import { Batch, V, mat4 } from './geo.js';

export const PITCH = 0.04, BOARD_T = 0.03;
const COL = { mask:'#0c4426', pour:'#17603a', cu:'#2a8a4c', tin:'#cfd2d6', tinDark:'#8d9299', silk:'#f1f0e8', hole:'#141414', ring:'#c48b3f' };
const RES_COLORS = ['#111', '#7a4a1e', '#d01818', '#f07818', '#f0d020', '#18a030', '#1840d0', '#8030b0', '#888', '#f4f4f4'];
const RES_VALUES = [[1, 0, 2], [4, 7, 1], [2, 2, 2], [1, 0, 3], [3, 3, 1], [4, 7, 3], [6, 8, 1], [1, 0, 4]];

/** Gemeinsame Materialien aller Platinen (einmal erzeugt). */
let MATS = null;
export function pcbMaterials(){
  if (MATS) return MATS;
  MATS = {
    plastic: new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.55, metalness:0.05 }),
    metal:   new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.32, metalness:0.9, envMapIntensity:1.1 }),
    led:     new THREE.MeshBasicMaterial({ color:0xfff4dc, toneMapped:false }),
    edge:    new THREE.MeshStandardMaterial({ color:0x2c5a32, roughness:0.7 }),
    bottom:  new THREE.MeshStandardMaterial({ color:0x0e3d22, roughness:0.75 })
  };
  return MATS;
}
const C = hex => new THREE.Color(hex);
const PC = { black:C(0x18181b), dark:C(0x26262a), white:C(0xf2efe6), beige:C(0xd9c49a), blue:C(0x1b3d8f), elkoBlue:C(0x203a7a), elkoBlack:C(0x141418),
  green:C(0x2a8a4a), grey:C(0x6d7076), brown:C(0x5a3a1c), red:C(0xa81c1c) };
const MC = { tin:C(0xc8ccd2), gold:C(0xd8b04a), alu:C(0xb9bec6), steel:C(0x8f949b), copper:C(0xc06a34) };

/**
 * Neue Platine anlegen.
 * @param {{ w:number, d:number, ppu?:number, name?:string, rev?:string }} o
 */
export function makeBoard(o){
  const w = o.w, d = o.d, ppu = o.ppu || 160;
  const L = { pads:[], traces:[], vias:[], pours:[], silk:[], texts:[], holes:[], keep:[] };
  const b3m = new Batch(), b3 = b3m, M = pcbMaterials(), ports = [], stats = { traces:0, segments:0, bad:0 };
  const top = BOARD_T / 2;
  const B = {
    w, d, ppu, ports, stats, layout:L,
    /** Lötpad (rund oder eckig) in Platinenkoordinaten. */
    pad(x, z, r = 0.014, square = false){ const p = { x, z, r, square }; L.pads.push(p); return p; },
    via(x, z){ L.vias.push({ x, z }); return { x, z }; },
    pour(x0, z0, x1, z1){ L.pours.push([x0, z0, x1, z1]); },
    text(s, x, z, size = 0.05, rot = 0){ L.texts.push({ s, x, z, size, rot }); },
    rect(x, z, rw, rd){ L.silk.push({ t:'rect', x, z, w:rw, d:rd }); },
    circle(x, z, r){ L.silk.push({ t:'circ', x, z, r }); },
    hole(x, z, r = 0.05){ L.holes.push({ x, z, r }); },
    /** Leiterbahn als Polylinie; jeder Abschnitt muss 0°, 45° oder 90° haben. */
    trace(pts, tw = 0.012){
      for (let i = 1; i < pts.length; i++){
        const dx = Math.abs(pts[i][0] - pts[i - 1][0]), dz = Math.abs(pts[i][1] - pts[i - 1][1]);
        stats.segments++;
        if (!(dx < 1e-6 || dz < 1e-6 || Math.abs(dx - dz) < 1e-6)) stats.bad++;
      }
      stats.traces++; L.traces.push({ pts, w:tw });
    },
    /**
     * Bahn von Pad a nach Pad b: erst `ea` in Richtung `da` herausführen, oktilinear verbinden, `eb` in Richtung `db` herein.
     * first: 'axis' (erst gerade, dann 45°) oder 'diag' (erst 45°, dann gerade).
     */
    route(a, b, { da = null, ea = 0, db = null, eb = 0, first = 'axis', w:tw = 0.012 } = {}){
      const p0 = [a.x, a.z], p1 = da ? [a.x + da[0] * ea, a.z + da[1] * ea] : p0;
      const q0 = [b.x, b.z], q1 = db ? [b.x + db[0] * eb, b.z + db[1] * eb] : q0;
      const pts = [p0, p1, ...octi(p1, q1, first), q0];
      B.trace(dedupe(pts), tw);
    },
    /** Paralleler Bus: verbindet Pin-Listen paarweise mit gestaffelten Ausleitungen, damit sich nichts kreuzt. */
    bus(as, bs, { da, db, e0 = 0.03, step = PITCH, first = 'axis', reverse = false, w:tw = 0.01 } = {}){
      const n = Math.min(as.length, bs.length);
      for (let i = 0; i < n; i++){
        const k = reverse ? n - 1 - i : i;
        B.route(as[i], bs[i], { da, db, ea:e0 + k * step, eb:e0 + (n - 1 - k) * step, first, w:tw });
      }
    },

    /** DIP-IC. axis 'z': Pinreihen links/rechts (x = ±s/2), Pin 1 oben links. */
    dip(ref, x, z, n, { axis = 'z', wide = n >= 24, label = '' } = {}){
      const half = n / 2, s = wide ? 0.24 : 0.12, len = half * PITCH;
      const pins = [], left = [], right = [];
      for (let i = 0; i < half; i++){
        const t = -len / 2 + PITCH / 2 + i * PITCH;
        const pa = axis === 'z' ? B.pad(x - s / 2, z + t, 0.012, i === 0) : B.pad(x + t, z + s / 2, 0.012, i === 0);
        left.push(pa);
      }
      for (let i = 0; i < half; i++){
        const t = len / 2 - PITCH / 2 - i * PITCH;
        right.push(axis === 'z' ? B.pad(x + s / 2, z + t, 0.012) : B.pad(x + t, z - s / 2, 0.012));
      }
      pins.push(...left, ...right);
      const bw = axis === 'z' ? s - 0.045 : len + 0.012, bd = axis === 'z' ? len + 0.012 : s - 0.045;
      L.silk.push({ t:'dip', x, z, w:bw + 0.03, d:bd + 0.03, axis });
      B.text(ref, axis === 'z' ? x : x - len / 2 - 0.02, axis === 'z' ? z - len / 2 - 0.035 : z, 0.045, axis === 'z' ? 0 : -Math.PI / 2);
      b3.box(bw, 0.034, bd, M.plastic, [x, top + 0.024, z], [0, 0, 0], PC.black);
      b3.cyl(0.012, 0.004, M.plastic, axis === 'z' ? [x - bw / 4, top + 0.042, z - bd / 2 + 0.025] : [x - bw / 2 + 0.025, top + 0.042, z + bd / 4], [0, 0, 0], PC.dark, 10);
      pins.forEach(p => {
        const out = axis === 'z' ? Math.sign(p.x - x) : Math.sign(p.z - z);
        if (axis === 'z') b3.box(0.03, 0.006, 0.012, M.metal, [x + out * (bw / 2 + 0.012), top + 0.03, p.z], [0, 0, 0], MC.tin).box(0.006, 0.03, 0.012, M.metal, [p.x, top + 0.015, p.z], [0, 0, 0], MC.tin);
        else b3.box(0.012, 0.006, 0.03, M.metal, [p.x, top + 0.03, z + out * (bd / 2 + 0.012)], [0, 0, 0], MC.tin).box(0.012, 0.03, 0.006, M.metal, [p.x, top + 0.015, p.z], [0, 0, 0], MC.tin);
      });
      if (label) B.text(label, x, z, 0.032, axis === 'z' ? -Math.PI / 2 : 0);
      return { pins, left, right };
    },
    /** Elektrolytkondensator (stehend). */
    elko(ref, x, z, r = 0.05, h = 0.12, col = PC.elkoBlue){
      const a = B.pad(x - r * 0.45, z, 0.012, true), c = B.pad(x + r * 0.45, z, 0.012);
      B.circle(x, z, r + 0.008); B.text('+', x - r - 0.03, z, 0.04); B.text(ref, x, z + r + 0.04, 0.04);
      b3.cyl(r, h, M.plastic, [x, top + h / 2, z], [0, 0, 0], col, 20);
      b3.cyl(r * 0.92, 0.004, M.metal, [x, top + h + 0.002, z], [0, 0, 0], MC.alu, 20);
      b3.box(0.012, 0.004, r * 1.4, M.metal, [x, top + h + 0.005, z], [0, 0, 0], MC.steel);   // Sollbruchkreuz
      b3.box(r * 1.4, 0.004, 0.012, M.metal, [x, top + h + 0.005, z], [0, 0, 0], MC.steel);
      b3.box(0.016, h * 0.98, 0.006, M.plastic, [x - r * 0.98, top + h / 2, z], [0, 0, 0], PC.grey);   // Minus-Streifen
      return { pins:[a, c] };
    },
    /** Widerstand, axial liegend, mit Farbringen. axis 'x' oder 'z'. */
    res(ref, x, z, axis = 'x', k = 0){
      const L2 = 0.1, ax = axis === 'x';
      const a = B.pad(ax ? x - L2 : x, ax ? z : z - L2, 0.011), c = B.pad(ax ? x + L2 : x, ax ? z : z + L2, 0.011);
      B.rect(x, z, ax ? 0.14 : 0.05, ax ? 0.05 : 0.14); B.text(ref, ax ? x : x + 0.06, ax ? z - 0.05 : z, 0.036, ax ? 0 : -Math.PI / 2);
      const rot = ax ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0], y = top + 0.03;
      b3.cyl(0.018, 0.1, M.plastic, [x, y, z], rot, PC.beige, 12);
      [-0.042, 0.042].forEach(o => b3.cyl(0.021, 0.022, M.plastic, ax ? [x + o, y, z] : [x, y, z + o], rot, PC.beige, 12));
      const v = RES_VALUES[k % RES_VALUES.length];
      [[-0.03, v[0]], [-0.012, v[1]], [0.006, v[2]], [0.034, -1]].forEach(([o, ci]) => {
        const col = ci < 0 ? C(0xc8a040) : C(RES_COLORS[ci]);
        b3.cyl(0.0215, 0.007, M.plastic, ax ? [x + o, y, z] : [x, y, z + o], rot, col, 12);
      });
      [a, c].forEach(p => {
        b3.box(ax ? 0.04 : 0.004, 0.004, ax ? 0.004 : 0.04, M.metal, [ax ? (p.x + x) / 2 + Math.sign(p.x - x) * 0.012 : x, y, ax ? z : (p.z + z) / 2 + Math.sign(p.z - z) * 0.012], [0, 0, 0], MC.tin);
        b3.box(0.005, y - top, 0.005, M.metal, [p.x, top + (y - top) / 2, p.z], [0, 0, 0], MC.tin);
      });
      return { pins:[a, c] };
    },
    /** Quarz HC-49. */
    xtal(ref, x, z, axis = 'x'){
      const ax = axis === 'x', a = B.pad(ax ? x - 0.04 : x, ax ? z : z - 0.04, 0.011), c = B.pad(ax ? x + 0.04 : x, ax ? z : z + 0.04, 0.011);
      B.rect(x, z, ax ? 0.17 : 0.07, ax ? 0.07 : 0.17); B.text(ref, x, z + (ax ? 0.07 : 0.12), 0.036);
      b3.box(ax ? 0.14 : 0.045, 0.1, ax ? 0.045 : 0.14, M.metal, [x, top + 0.05, z], [0, 0, 0], MC.alu);
      [-1, 1].forEach(s => b3.cyl(0.0225, 0.1, M.metal, ax ? [x + s * 0.07, top + 0.05, z] : [x, top + 0.05, z + s * 0.07], [0, 0, 0], MC.alu, 12));
      return { pins:[a, c] };
    },
    /** Spannungsregler TO-220 auf Rippenkühlkörper. */
    regulator(ref, x, z){
      const pins = [-1, 0, 1].map(i => B.pad(x + i * 0.045, z + 0.09, 0.012, i === -1));
      B.rect(x, z - 0.03, 0.26, 0.2); B.text(ref, x + 0.18, z + 0.09, 0.04);
      b3.box(0.11, 0.1, 0.035, M.plastic, [x, top + 0.07, z + 0.03], [0, 0, 0], PC.black);
      b3.box(0.11, 0.13, 0.01, M.metal, [x, top + 0.09, z + 0.008], [0, 0, 0], MC.tin);
      pins.forEach(p => b3.box(0.012, 0.03, 0.06, M.metal, [p.x, top + 0.02, z + 0.07], [0.6, 0, 0], MC.tin));
      b3.box(0.24, 0.02, 0.16, M.metal, [x, top + 0.012, z - 0.06], [0, 0, 0], MC.alu);
      for (let i = 0; i < 6; i++) b3.box(0.012, 0.2, 0.16, M.metal, [x - 0.11 + i * 0.044, top + 0.11, z - 0.06], [0, 0, 0], MC.alu);
      return { pins };
    },
    /**
     * Stiftleiste (KK-Raster) bzw. Wannenstecker (idc) mit Anschlusspunkt für das Kabel.
     * axis: Richtung der Pinreihe ('x' | 'z'). port: Name des Anschlusses.
     */
    header(ref, x, z, n, { axis = 'x', kind = 'kk', port = null, part = '', bottom = false } = {}){
      const rows = kind === 'idc' ? 2 : 1, per = Math.ceil(n / rows), ax = axis === 'x', pins = [];
      // Bestückung auf der Unterseite: y spiegeln
      const sy = bottom ? -1 : 1, b3 = bottom ? mirrorBatch(b3m) : b3m;
      for (let r = 0; r < rows; r++) for (let i = 0; i < per; i++){
        const t = (i - (per - 1) / 2) * PITCH, o = rows === 2 ? (r - 0.5) * PITCH : 0;
        pins.push(B.pad(ax ? x + t : x + o, ax ? z + o : z + t, 0.012, i === 0 && r === 0));
      }
      const along = per * PITCH + (kind === 'idc' ? 0.09 : 0.02), across = kind === 'idc' ? 0.12 : 0.055;
      const bw = ax ? along : across, bd = ax ? across : along;
      B.rect(x, z, bw + 0.02, bd + 0.02); B.text(ref, ax ? x : x + across / 2 + 0.05, ax ? z + across / 2 + 0.045 : z, 0.042, ax ? 0 : -Math.PI / 2);
      if (kind === 'idc'){
        b3.box(bw, 0.085, bd, M.plastic, [x, top + 0.0425, z], [0, 0, 0], PC.black);
        b3.box(ax ? 0.05 : 0.02, 0.05, ax ? 0.02 : 0.05, M.plastic, ax ? [x, top + 0.06, z + bd / 2 + 0.008] : [x + bw / 2 + 0.008, top + 0.06, z], [0, 0, 0], PC.dark);   // Kodiernase
      } else {
        b3.box(bw, 0.03, bd, M.plastic, [x, top + 0.015, z], [0, 0, 0], PC.white);
        b3.box(ax ? bw : 0.012, 0.07, ax ? 0.012 : bd, M.plastic, ax ? [x, top + 0.035, z - bd / 2 + 0.006] : [x - bw / 2 + 0.006, top + 0.035, z], [0, 0, 0], PC.white);   // Verriegelungswand
      }
      pins.forEach(p => b3.box(0.012, 0.06, 0.012, M.metal, [p.x, top + 0.04, p.z], [0, 0, 0], MC.gold));
      // Anschlusspunkt: Oberkante des aufgesteckten Gegensteckers (der Stecker gehört zum Kabel)
      const plugH = kind === 'idc' ? 0.05 : 0.07, baseY = kind === 'idc' ? 0.085 : 0.03;
      if (port) ports.push({ id:port, part, kind, local:V(x, sy * (top + baseY + plugH), z), dir:V(0, sy, 0),
        plug:{ w:ax ? along - (kind === 'idc' ? 0.02 : 0) : across - 0.005, h:plugH, d:ax ? across - 0.005 : along - (kind === 'idc' ? 0.02 : 0), axis } });
      return { pins };
    },
    /** Schraubklemme (Netzteil-Ausgänge). */
    terminal(ref, x, z, n, { port = null, part = '' } = {}){
      const pins = [];
      for (let i = 0; i < n; i++){
        const px = x + (i - (n - 1) / 2) * 0.09; pins.push(B.pad(px, z, 0.016, i === 0));
        b3.box(0.088, 0.09, 0.1, M.plastic, [px, top + 0.045, z], [0, 0, 0], C(0x2a7a3a));
        b3.cyl(0.026, 0.012, M.metal, [px, top + 0.096, z - 0.01], [0, 0, 0], MC.steel, 12);
        b3.box(0.04, 0.004, 0.006, M.plastic, [px, top + 0.103, z - 0.01], [0, 0.6, 0], PC.black);
      }
      if (port) ports.push({ id:port, part, kind:'screw', local:V(x, top + 0.05, z + 0.055), dir:V(0, 0, 1), plug:null });
      B.rect(x, z, n * 0.09 + 0.02, 0.12); B.text(ref, x, z - 0.1, 0.045);
      return { pins };
    },
    /** SMD-LED (leuchtet). */
    led(x, z){ B.pad(x - 0.02, z, 0.01, true); B.pad(x + 0.02, z, 0.01, true); b3.box(0.05, 0.02, 0.035, M.led, [x, top + 0.01, z]); },
    /** Durchkontaktierungen im Raster über die Massefläche verteilen (Abstand zu Pads, Bahnen, Bauteilen). */
    stitch(step = 0.16, x0 = -w / 2 + 0.08, z0 = -d / 2 + 0.08, x1 = w / 2 - 0.08, z1 = d / 2 - 0.08){
      const near = (x, z) => L.pads.some(p => Math.hypot(p.x - x, p.z - z) < 0.06) || L.vias.some(p => Math.hypot(p.x - x, p.z - z) < 0.05) ||
        L.holes.some(p => Math.hypot(p.x - x, p.z - z) < 0.12) ||
        L.silk.some(s => s.t !== 'circ' ? Math.abs(s.x - x) < s.w / 2 + 0.03 && Math.abs(s.z - z) < s.d / 2 + 0.03 : Math.hypot(s.x - x, s.z - z) < s.r + 0.04) ||
        L.traces.some(t => t.pts.some((p, i) => i && segDist(x, z, t.pts[i - 1], p) < 0.04));
      for (let x = x0; x <= x1; x += step) for (let z = z0; z <= z1; z += step) if (!near(x, z)) L.vias.push({ x, z });
    },
    /** Freies 3D-Teil (z. B. Trafo) in die Stapel der Platine aufnehmen. */
    extra(fn){ fn(b3, M, top, PC, MC); },

    /** Textur zeichnen und Platine (+ Bauteile) als Gruppe liefern. */
    build(){
      const cw = Math.min(1024, Math.round(w * ppu)), ch = Math.min(1024, Math.round(d * ppu)), sx = cw / w, sz = ch / d;
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const x = cv.getContext('2d');
      const P = (px, pz) => [(px + w / 2) * sx, (pz + d / 2) * sz];
      x.fillStyle = COL.mask; x.fillRect(0, 0, cw, ch);
      x.fillStyle = COL.pour; L.pours.forEach(([x0, z0, x1, z1]) => { const [a, b] = P(x0, z0), [c, e] = P(x1, z1); x.fillRect(a, b, c - a, e - b); });
      // Freistellung um Bahnen, Pads und Vias in der Massefläche
      x.lineCap = x.lineJoin = 'round'; x.strokeStyle = x.fillStyle = COL.mask;
      L.traces.forEach(t => { x.lineWidth = (t.w + 0.02) * sx; path(x, t.pts.map(p => P(p[0], p[1]))); x.stroke(); });
      L.pads.concat(L.vias.map(v => ({ ...v, r:0.012 }))).forEach(p => { const [a, b] = P(p.x, p.z); x.beginPath(); x.arc(a, b, (p.r + 0.01) * sx, 0, 7); x.fill(); });
      // Kupferbahnen unter dem Lack
      x.strokeStyle = COL.cu; L.traces.forEach(t => { x.lineWidth = t.w * sx; path(x, t.pts.map(p => P(p[0], p[1]))); x.stroke(); });
      // Verzinnte Pads mit Bohrung
      L.pads.forEach(p => {
        const [a, b] = P(p.x, p.z), r = p.r * sx;
        x.fillStyle = COL.tin; if (p.square) x.fillRect(a - r, b - r, r * 2, r * 2); else { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
        x.fillStyle = COL.tinDark; x.beginPath(); x.arc(a, b, r * 0.42, 0, 7); x.fill();
      });
      L.vias.forEach(v => { const [a, b] = P(v.x, v.z); x.fillStyle = COL.tin; x.beginPath(); x.arc(a, b, 0.009 * sx, 0, 7); x.fill(); x.fillStyle = COL.hole; x.beginPath(); x.arc(a, b, 0.0035 * sx, 0, 7); x.fill(); });
      // Bestückungsdruck
      x.strokeStyle = x.fillStyle = COL.silk; x.lineWidth = Math.max(1, 0.006 * sx);
      L.silk.forEach(s => {
        const [a, b] = P(s.x, s.z);
        if (s.t === 'circ'){ x.beginPath(); x.arc(a, b, s.r * sx, 0, 7); x.stroke(); return; }
        x.strokeRect(a - s.w / 2 * sx, b - s.d / 2 * sz, s.w * sx, s.d * sz);
        if (s.t === 'dip'){ x.beginPath(); if (s.axis === 'z') x.arc(a, b - s.d / 2 * sz, 0.02 * sx, 0, Math.PI); else x.arc(a - s.w / 2 * sx, b, 0.02 * sx, -Math.PI / 2, Math.PI / 2); x.stroke(); }
      });
      L.texts.forEach(t => {
        const [a, b] = P(t.x, t.z); x.save(); x.translate(a, b); x.rotate(t.rot);
        x.font = `bold ${Math.max(7, t.size * sx)}px monospace`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t.s, 0, 0); x.restore();
      });
      // Befestigungslöcher mit Kupferring
      L.holes.forEach(h => { const [a, b] = P(h.x, h.z); x.fillStyle = COL.ring; x.beginPath(); x.arc(a, b, h.r * sx, 0, 7); x.fill(); x.fillStyle = COL.hole; x.beginPath(); x.arc(a, b, h.r * 0.55 * sx, 0, 7); x.fill(); });
      const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
      const topMat = new THREE.MeshStandardMaterial({ map:tex, roughness:0.48, metalness:0.05 });
      const group = new THREE.Group();
      group.add(new THREE.Mesh(new THREE.BoxGeometry(w, BOARD_T, d), [M.edge, M.edge, topMat, M.bottom, M.edge, M.edge]));
      b3.flush(m => { group.add(m); return m; });
      return { group, ports, stats, canvas:cv };
    }
  };
  return B;
}

/** Stapel-Hülle, die die Lage aller Teile an der Platinenebene spiegelt (Bauteile auf der Unterseite; nur symmetrische Grundformen). */
function mirrorBatch(b){
  const fl = mx => { const m = (mx || new THREE.Matrix4()).clone(); m.elements[13] *= -1; return m; };
  return { add:(g, m, mx, c) => b.add(g, m, fl(mx), c),
    box(w, h, d, m, p, r, c){ b.box(w, h, d, m, [p[0], -p[1], p[2]], r, c); return this; },
    cyl(rad, h, m, p, r, c, seg = 16){ b.cyl(rad, h, m, [p[0], -p[1], p[2]], r, c, seg); return this; } };
}
function segDist(x, z, a, b){
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
function path(x, pts){ x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); }
function dedupe(pts){ return pts.filter((p, i) => !i || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-6); }

/** Oktilineare Verbindung von p nach q (Zwischenpunkt + Ziel). */
export function octi(p, q, first = 'axis'){
  const dx = q[0] - p[0], dz = q[1] - p[1], ax = Math.abs(dx), az = Math.abs(dz), sx = Math.sign(dx), sz = Math.sign(dz);
  if (ax < 1e-9 || az < 1e-9 || Math.abs(ax - az) < 1e-9) return [q];
  let m;
  if (ax > az) m = first === 'axis' ? [p[0] + sx * (ax - az), p[1]] : [p[0] + sx * az, q[1]];
  else m = first === 'axis' ? [p[0], p[1] + sz * (az - ax)] : [q[0], p[1] + sz * ax];
  return [m, q];
}

/** Lokale Ports einer platzierten Platinen-Gruppe in Weltkoordinaten umrechnen. */
export function worldPorts(group, ports){
  group.updateWorldMatrix(true, true);
  const nm = new THREE.Matrix3().getNormalMatrix(group.matrixWorld);
  return ports.map(p => ({ ...p, pos:p.local.clone().applyMatrix4(group.matrixWorld), dirW:p.dir.clone().applyMatrix3(nm).normalize(), quat:group.getWorldQuaternion(new THREE.Quaternion()) }));
}
export { mat4 };
