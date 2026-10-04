/**
 * Konkrete Platinen-Layouts: Hauptplatine, Lampentreiber, Tasten-Steckerplatine, Walzenplatine, LED-Leuchtplatine,
 * Laufschrift-/LCD-Treiber und Netzteil. Jede Funktion liefert { group, ports, stats } (lokale Platinen-Koordinaten).
 */
import { REEL_GAP } from './constants.js';
import { PITCH, makeBoard } from './pcb.js';

const reelOff = c => (c - 2) * REEL_GAP;
/** Gerade Bus-Bahnen zwischen zwei Pinreihen gleicher Höhe (z), ausgenommen `skip`. */
function straight(B, as, bs, skip = []){
  as.forEach(a => {
    if (skip.includes(a)) return;
    const b = bs.find(q => Math.abs(q.z - a.z) < 1e-6 && !skip.includes(q));
    if (b) B.trace([[a.x, a.z], [b.x, b.z]], 0.011);
  });
}
/** Pin per kurzer Bahn auf ein Via führen (Lagenwechsel). */
function toVia(B, p, dx, dz){ B.via(p.x + dx, p.z + dz); B.trace([[p.x, p.z], [p.x + dx, p.z + dz]], 0.011); }

/** Hauptplatine (6,4 × 1,6) hinten im Unterteil, unter den Walzen; Steckerleisten für alle Baugruppen. */
export function mainBoard(){
  const B = makeBoard({ w:6.4, d:1.6, ppu:160 });
  B.pour(-3.16, -0.76, 3.16, 0.76);
  [[-3.1, -0.7], [3.1, -0.7], [-3.1, 0.7], [3.1, 0.7]].forEach(([x, z]) => B.hole(x, z));
  const P = 'Hauptplatine';
  // Versorgung: Netzteil-Stecker, Elkos, Spannungsregler mit Kühlkörper, 5-V-Schiene am hinteren Rand
  const j6 = B.header('J6', -2.7, -0.68, 4, { port:'mb.power', part:P });
  const c1 = B.elko('C1', -2.6, -0.25, 0.08, 0.18), c2 = B.elko('C2', -2.25, -0.2, 0.06, 0.13);
  const u9 = B.regulator('U9', -2.25, -0.52);
  B.route(j6.pins[0], c1.pins[0], { da:[0, 1], ea:0.08, w:0.03 });
  B.route(c1.pins[0], u9.pins[0], { first:'diag', w:0.03 });
  B.route(u9.pins[2], c2.pins[0], { w:0.03 });
  [j6.pins[1], j6.pins[2], j6.pins[3]].forEach(p => toVia(B, p, 0, -0.07));
  toVia(B, u9.pins[1], 0, 0.07); toVia(B, c1.pins[1], 0, 0.11); toVia(B, c2.pins[1], 0, 0.09);
  B.trace([[u9.pins[2].x, u9.pins[2].z], [u9.pins[2].x, -0.7], [u9.pins[2].x + 0.04, -0.74], [2.62, -0.74]], 0.026);
  B.via(2.62, -0.74);
  B.text('+12V', -2.7, -0.57, 0.05); B.text('MPU-5  REV C', -0.62, 0.27, 0.065); B.text('BANDIT ELEKTRONIK 1987', 1.75, 0.15, 0.05);

  // Rechenkern: CPU, EPROM, RAM, Logik – Busse als gerade parallele Bahnen zwischen den Pinreihen
  const y1 = B.xtal('Y1', -1.78, -0.3, 'z');
  const u1 = B.dip('U1', -1.4, -0.18, 40, { label:'CPU 6809' });
  const u2 = B.dip('U2', -0.8, -0.28, 28, { label:'EPROM 27C256' });
  const u3 = B.dip('U3', -0.2, -0.28, 28, { label:'RAM 6264' });
  const u4 = B.dip('U4', 0.5, -0.36, 16), u5 = B.dip('U5', 0.95, -0.36, 16), u10 = B.dip('U10', 1.4, -0.38, 14), u12 = B.dip('U12', 1.85, -0.36, 16);
  const chips = [u1, u2, u3, u4, u5, u10, u12];
  const vcc = chips.map(u => u.right[u.right.length - 1]), gnd = chips.map(u => u.left[u.left.length - 1]);
  const skip = [...vcc, ...gnd];
  straight(B, u1.right, u2.left, skip); straight(B, u2.right, u3.left, skip); straight(B, u3.right, u4.left, skip);
  straight(B, u4.right, u5.left, skip); straight(B, u5.right, u10.left, skip); straight(B, u10.right, u12.left, skip);
  vcc.forEach(p => B.trace([[p.x, p.z], [p.x, -0.74]], 0.016));
  gnd.forEach(p => toVia(B, p, -0.06, 0));
  // Quarz an der CPU, freie CPU-Pins über Vias auf die Unterseite
  u1.left.forEach(p => {
    const yp = y1.pins.find(q => Math.abs(q.z - p.z) < 1e-6);
    if (yp) B.trace([[p.x, p.z], [yp.x, yp.z]], 0.011);
    else if (!skip.includes(p) && Math.round((p.z + 1) / PITCH) % 2 === 0) toVia(B, p, -0.08, 0);
  });
  [u2.left[0], u3.left[0]].forEach(p => toVia(B, p, 0.06, 0.0));
  u12.right.forEach((p, i) => { if (!skip.includes(p) && i % 2 === 0) toVia(B, p, 0.08, 0); });
  B.elko('C3', 2.1, -0.6, 0.04, 0.09); B.elko('C4', 0.12, 0.12, 0.04, 0.09);
  [2.25, 2.33, 2.41, 2.49].forEach((x, i) => { const r = B.res('R' + (i + 1), x, -0.25, 'z', i); toVia(B, r.pins[1], 0, 0.06); });

  // Walzen: je ein Schrittmotortreiber und eine Steckerleiste (Motor, Lichtschranke, LED)
  for (let c = 0; c < 5; c++){
    const X = reelOff(c);
    const d = B.dip('U' + (20 + c), X - 0.42, 0.42, 16, { axis:'x', label:'ULN2003' });
    const j = B.header('J' + (1 + c), X, 0.66, 6, { port:'mb.reel' + c, part:P });
    B.bus(d.left.slice(3, 7), j.pins.slice(0, 4), { da:[0, 1], e0:0.03, step:0.03, reverse:true });
    toVia(B, j.pins[4], 0, -0.1); toVia(B, j.pins[5], 0, -0.06);
    d.right.slice(0, 4).forEach((p, i) => toVia(B, p, 0, -0.06 - (i % 2) * 0.04));
    toVia(B, d.left[7], 0.06, 0);
    B.text('WALZE ' + (c + 1), X + 0.24, 0.53, 0.04);
  }
  // Flachband zur Laufschrift
  const j8 = B.header('J8', 0.34, 0.6, 10, { kind:'idc', port:'mb.ticker', part:P });
  j8.pins.forEach((p, i) => toVia(B, p, 0, i < 5 ? 0.07 : -0.07));
  // Linker Rand: Lampentreiber, Tasten, Anzeigen (Wannenstecker), Lautsprecher
  const ribbons = [['J7', -0.36, 16, 'mb.lamps', 'LAMPEN'], ['J10', 0.06, 14, 'mb.buttons', 'TASTEN'], ['J9', 0.45, 10, 'mb.lcd', 'LCD']];
  ribbons.forEach(([ref, z, n, port, lbl]) => {
    const h = B.header(ref, -3.05, z, n, { axis:'z', kind:'idc', port, part:P });
    h.pins.forEach((p, i) => (i < n / 2 ? toVia(B, p, -0.085, 0) : toVia(B, p, 0.09, 0)));
    B.text(lbl, -2.82, z, 0.04, -Math.PI / 2);
  });
  const j11 = B.header('J11', -1.92, -0.7, 2, { port:'mb.speaker', part:P });
  j11.pins.forEach(p => toVia(B, p, 0, 0.07)); B.text('SPK', -1.92, -0.58, 0.04);
  // Rechter Rand: Hopper, Hebelschalter, Münzprüfer; Optokoppler für den Münzprüfer
  const j12 = B.header('J12', 3.05, -0.45, 4, { axis:'z', port:'mb.hopper', part:P });
  const j13 = B.header('J13', 3.05, -0.06, 3, { axis:'z', port:'mb.lever', part:P });
  const j14 = B.header('J14', 3.05, 0.3, 6, { axis:'z', port:'mb.coin', part:P });
  const u11 = B.dip('U11', 2.62, 0.0, 8, { label:'PC817' });
  B.bus(j14.pins.slice(0, 4), u11.right.slice(0, 4).reverse(), { da:[-1, 0], e0:0.04, step:0.03 });
  j14.pins.slice(4).forEach(p => toVia(B, p, -0.07, 0));
  j12.pins.forEach((p, i) => toVia(B, p, -0.07 - (i % 2) * 0.05, 0));
  j13.pins.forEach((p, i) => toVia(B, p, -0.07 - (i % 2) * 0.05, 0));
  u11.left.forEach(p => toVia(B, p, -0.07, 0));
  [['HOPPER', -0.45], ['HEBEL', -0.06], ['MUENZE', 0.3]].forEach(([t, z]) => B.text(t, 2.86, z, 0.038, -Math.PI / 2));
  B.stitch(0.14);
  return B.build();
}

/**
 * Fächer von einer senkrechten Pinreihe (x = Pins) zu einer Steckerspalte weiter links: obere Pins gehen zu den
 * oberen Steckern (innen geführt), untere zu den unteren – ineinander geschachtelt, ohne Kreuzung.
 */
function fanLeft(B, pins, targets, w = 0.016){
  const up = [], down = [];
  pins.forEach((p, i) => (targets[i].z < p.z ? up : down).push([p, targets[i]]));
  const run = (list, s) => list.forEach(([p, t], k) => {
    const a = 0.03 + k * 0.035, x1 = p.x - a, z1 = p.z + s * a, z2 = t.z - s * (x1 - t.x);
    if (s * (z2 - z1) > 0) B.trace([[p.x, p.z], [x1, z1], [x1, z2], [t.x, t.z]], w);
    else B.route(p, t, { w });
  });
  run(up, -1);
  run(down.reverse(), 1);
}

/** Lampentreiber (1,8 × 1,4) an der linken Gehäusewand: Reihen-/Paarlampen, Glühbirnenkranz, Aufsatz. */
export function lampDriverBoard(){
  const B = makeBoard({ w:1.8, d:1.4, ppu:280 });
  const P = 'Lampentreiber';
  B.pour(-0.86, -0.66, 0.86, 0.66);
  [[-0.82, -0.63], [0.82, -0.63], [-0.82, 0.63], [0.82, 0.63]].forEach(([x, z]) => B.hole(x, z, 0.04));
  // Steckerspalte an der Vorderkante: Reihen 1–4, Paare 1-2/2-3/3-4, Glühbirnenkranz
  const col = [['K1', 'ld.row0'], ['K2', 'ld.row1'], ['K3', 'ld.row2'], ['K4', 'ld.row3'], ['K5', 'ld.pair0'], ['K6', 'ld.pair1'], ['K7', 'ld.pair2']]
    .map(([ref, port], i) => B.header(ref, -0.78, -0.55 + i * 0.15, 2, { axis:'z', port, part:P }));
  col.push(B.header('K8', -0.78, 0.53, 3, { axis:'z', port:'ld.bulbs', part:P }));
  const u2 = B.dip('U2', -0.45, 0.07, 18, { label:'ULN2803' });
  const u1 = B.dip('U1', 0.2, 0.05, 16, { label:'74HC595' });
  const tg = col.map((h, i) => h.pins.reduce((m, p) => (Math.abs(p.z - u2.left[i].z) < Math.abs(m.z - u2.left[i].z) ? p : m)));
  fanLeft(B, u2.left.slice(0, 8), tg);
  col.forEach((h, i) => h.pins.filter(p => p !== tg[i]).forEach(p => toVia(B, p, -0.07, 0)));
  straight(B, u2.right, u1.left, [u2.right[u2.right.length - 1], u1.left[u1.left.length - 1]]);
  toVia(B, u2.right[u2.right.length - 1], 0.07, 0); toVia(B, u1.left[u1.left.length - 1], -0.07, 0); toVia(B, u2.left[8], 0, 0.07);
  // Oberkante: Relais für die Aufsatz-Leuchtstoffröhre, Flachband zur Hauptplatine
  const k9 = B.header('K9', -0.2, -0.58, 3, { port:'ld.marquee', part:P });
  const j1 = B.header('J1', 0.46, -0.56, 16, { kind:'idc', port:'ld.bus', part:P });
  B.extra((b, M, top, PC) => b.box(0.3, 0.16, 0.2, M.plastic, [-0.2, top + 0.08, -0.32], [0, 0, 0], new THREE.Color(0x2a56b8)));
  B.rect(-0.2, -0.32, 0.32, 0.22); B.text('RL1', -0.2, -0.17, 0.045);
  const rl = [-0.32, -0.08].map(x => B.pad(x, -0.4, 0.016)), rc = [-0.32, -0.08].map(x => B.pad(x, -0.24, 0.013));
  B.route(rl[0], k9.pins[0], { da:[0, -1], ea:0.06, w:0.03 }); B.route(rl[1], k9.pins[2], { da:[0, -1], ea:0.06, w:0.03 });
  toVia(B, k9.pins[1], 0, 0.06);
  B.route(rc[1], u1.left[0], { first:'diag' }); toVia(B, rc[0], 0, 0.08);
  B.bus(u1.right.slice(0, 6).reverse(), j1.pins.slice(8, 14), { da:[1, 0], e0:0.04, step:0.035, first:'axis' });
  j1.pins.slice(0, 8).forEach(p => toVia(B, p, 0, 0.07));
  [0.62, 0.7].forEach((x, i) => B.res('R' + (i + 1), x, 0.3, 'z', i + 3));
  B.elko('C1', 0.62, -0.08, 0.05, 0.12);
  B.text('LAMP DRV', 0.1, 0.5, 0.07); B.stitch(0.12);
  return B.build();
}

/** Tasten-Steckerplatine unter dem Pult: je Taste ein Stecker, Flachband zur Hauptplatine. */
export function buttonBoard(xs){
  const B = makeBoard({ w:6.6, d:0.44, ppu:150 });
  const P = 'Tastenplatine';
  B.pour(-3.26, -0.19, 3.26, 0.19);
  [[-3.22, 0], [3.22, 0]].forEach(([x, z]) => B.hole(x, z, 0.035));
  const j = B.header('J1', -1.0, 0, 14, { kind:'idc', port:'bb.bus', part:P });
  const left = xs.filter(b => b.x < -1), right = xs.filter(b => b.x > -1);
  const lane = (b, i, n, side) => side < 0 ? -0.07 - (n - 1 - i) * 0.04 : 0.07 + i * 0.04;
  xs.forEach(b => {
    const h = B.header('S' + (xs.indexOf(b) + 1), b.x, 0, 2, { port:'bb.' + b.id, part:P });
    const side = b.x < -1 ? -1 : 1, list = side < 0 ? left : right, i = list.indexOf(b);
    const lz = lane(b, i, list.length, side);
    // Zielpin: links von der Wanne obere Reihe, rechts untere; je weiter weg, desto weiter innen
    const row = j.pins.filter(p => (side < 0 ? p.z < 0 : p.z > 0)).sort((a, c) => a.x - c.x);
    const tgt = side < 0 ? row[row.length - list.length + i] : row[row.length - 1 - i];
    const a = h.pins[0];
    B.trace([[a.x, a.z], [a.x, lz - Math.sign(lz) * 0.02], [a.x + Math.sign(tgt.x - a.x) * 0.02, lz], [tgt.x - Math.sign(tgt.x - a.x) * 0.02, lz], [tgt.x, lz - Math.sign(lz) * 0.02], [tgt.x, tgt.z]], 0.014);
    toVia(B, h.pins[1], 0, side < 0 ? 0.07 : -0.07);
  });
  j.pins.forEach(p => { if (!B.layout.traces.some(t => t.pts.some(q => Math.abs(q[0] - p.x) < 1e-6 && Math.abs(q[1] - p.z) < 1e-6))) toVia(B, p, 0, p.z < 0 ? -0.06 : 0.06); });
  B.text('TASTEN  BTN-7', 2.2, -0.12, 0.06);
  B.stitch(0.12);
  return B.build();
}

/** Walzenplatine unter dem Walzenband: Motor-, Lichtschranken- und LED-Anschluss (oben, zu den Bauteilen darüber), Stecker zur Hauptplatine. */
export function reelBoard(){
  const B = makeBoard({ w:1.12, d:0.24, ppu:320 });
  const P = 'Walzenplatine';
  B.pour(-0.54, -0.1, 0.54, 0.1);
  B.hole(-0.48, 0, 0.03); B.hole(0.42, -0.07, 0.025);
  const j = B.header('J1', 0, 0, 6, { port:'top', part:P });
  const m = B.header('M', 0.54, -0.06, 4, { axis:'z', port:'motor', part:P });
  const o = B.header('O', 0.54, 0.075, 3, { axis:'z', port:'opto', part:P });
  const l = B.header('L', -0.54, 0, 2, { axis:'z', port:'led', part:P });
  B.bus(m.pins.slice(0, 2).reverse(), j.pins.slice(4, 6).reverse(), { da:[-1, 0], e0:0.05, step:0.04 });
  B.route(o.pins[1], j.pins[3], { da:[-1, 0], ea:0.05 });
  B.route(l.pins[0], j.pins[0], { da:[1, 0], ea:0.06 });
  B.route(l.pins[1], j.pins[1], { da:[1, 0], ea:0.14 });
  [m.pins[2], m.pins[3], o.pins[0], o.pins[2]].forEach((p, i) => toVia(B, p, -0.05 - (i % 2) * 0.04, 0));
  toVia(B, j.pins[2], 0, -0.07);
  B.res('R1', -0.26, 0.06, 'x', 2); B.elko('C1', 0.26, 0.05, 0.035, 0.08);
  B.text('REEL', -0.26, -0.06, 0.05);
  return B.build();
}

/** LED-Leuchtplatine im Walzeninneren (beleuchtet die vier sichtbaren Reihen). */
export function ledBoard(rowsZ){
  const B = makeBoard({ w:0.72, d:2.5, ppu:150 });
  B.pour(-0.33, -1.22, 0.33, 1.22);
  B.trace([[-0.3, -1.18], [-0.3, 1.18]], 0.03); B.trace([[0.3, -1.18], [0.3, 1.18]], 0.03);
  B.via(-0.3, -1.18); B.via(0.3, -1.18); B.via(-0.3, 1.18); B.via(0.3, 1.18);
  rowsZ.forEach((z, r) => [-0.15, 0, 0.15].forEach((x, k) => {
    B.led(x, z);
    const p = B.pad(x + 0.02, z + 0.07, 0.01), q = B.pad(x - 0.02, z - 0.07, 0.01);
    B.trace([[x + 0.02, z], [x + 0.02, z + 0.07]], 0.01); B.trace([[x - 0.02, z], [x - 0.02, z - 0.07]], 0.01);
    if (k === 2) B.trace([[p.x, p.z], [0.28, p.z], [0.3, p.z + 0.02]], 0.012);
    if (k === 0) B.trace([[q.x, q.z], [-0.28, q.z], [-0.3, q.z - 0.02]], 0.012);
  }));
  B.text('LED', 0, 1.1, 0.07);
  return B.build();
}

/** Treiberplatine hinter Laufschrift bzw. LCDs (Bauteile zur Rückseite). */
export function displayBoard(label, port, chipsX, labelX){
  const B = makeBoard({ w:5.6, d:0.46, ppu:160 });
  B.pour(-2.76, -0.19, 2.76, 0.19);
  [[-2.7, 0], [2.7, 0]].forEach(([x, z]) => B.hole(x, z, 0.04));
  const j = B.header('J1', chipsX[0] - 0.55, 0.02, 10, { kind:'idc', port, part:label });
  const us = chipsX.map((x, i) => B.dip('U' + (i + 1), x, 0.02, 16, { axis:'x' }));
  // Kette zwischen den Treibern (gleiche Pinreihen) und Zuführung vom Wannenstecker
  us.forEach((u, i) => {
    if (i) { const v = us[i - 1]; B.trace([[v.left[7].x, v.left[7].z], [u.left[0].x, u.left[0].z]], 0.011); B.trace([[v.right[0].x, v.right[0].z], [u.right[7].x, u.right[7].z]], 0.011); }
    u.left.slice(2, 6).forEach((p, k) => toVia(B, p, 0, 0.06 + (k % 2) * 0.04));
    u.right.slice(1, 7).forEach((p, k) => { if (k % 2 === 0) toVia(B, p, 0, -0.07); });
  });
  B.bus(j.pins.slice(5, 9).reverse(), us[0].left.slice(0, 2).concat([us[0].left[6], us[0].left[7]]).slice(0, 2), { da:[0, 1], e0:0.06, step:0.03 });
  j.pins.slice(0, 5).forEach(p => toVia(B, p, 0, -0.07));
  B.text(label, labelX, 0, 0.07);
  B.stitch(0.14);
  return B.build();
}

/** Offenes Schaltnetzteil auf Blechwanne: Trafo, Gleichrichter, Siebelkos, Regler, Sicherung, Klemmen. */
export function psuBoard(){
  const B = makeBoard({ w:1.5, d:1.3, ppu:220 });
  const P = 'Netzteil';
  B.pour(-0.7, -0.6, 0.7, 0.6);
  [[-0.68, -0.58], [0.68, -0.58], [-0.68, 0.58], [0.68, 0.58]].forEach(([x, z]) => B.hole(x, z, 0.04));
  const tin = B.terminal('X1', -0.45, 0.5, 2, { port:'psu.mains', part:P });
  const tout = B.terminal('X2', 0.35, 0.5, 4, { port:'psu.out', part:P });
  B.extra((b, M, top, PC, MC) => {
    // Trafo: Blechpaket mit Kupferwicklung, Sicherungshalter mit Glasrohr
    b.box(0.42, 0.34, 0.36, M.metal, [-0.32, top + 0.17, -0.2], [0, 0, 0], MC.steel);
    b.cyl(0.15, 0.3, M.metal, [-0.32, top + 0.17, -0.2], [0, 0, Math.PI / 2], MC.copper, 20);
    b.box(0.46, 0.04, 0.4, M.plastic, [-0.32, top + 0.02, -0.2], [0, 0, 0], PC.dark);
    b.box(0.26, 0.04, 0.06, M.plastic, [-0.55, top + 0.02, 0.22], [0, 0, 0], PC.black);
    b.cyl(0.022, 0.2, M.plastic, [-0.55, top + 0.05, 0.22], [0, 0, Math.PI / 2], new THREE.Color(0xd8e4ec));
  });
  B.rect(-0.32, -0.2, 0.48, 0.42); B.text('T1', -0.32, 0.06, 0.06); B.rect(-0.55, 0.22, 0.3, 0.09); B.text('F1 T2A', -0.55, 0.32, 0.045);
  const c1 = B.elko('C1', 0.15, -0.3, 0.11, 0.3, new THREE.Color(0x141418)), c2 = B.elko('C2', 0.45, -0.3, 0.11, 0.3, new THREE.Color(0x141418));
  const u1 = B.regulator('U1', 0.2, 0.15), u2 = B.regulator('U2', 0.5, 0.15);
  const br = B.dip('BR1', -0.05, 0.1, 4, { label:'' });
  B.route(tin.pins[0], br.left[0], { da:[0, -1], ea:0.12, w:0.03 });
  B.route(br.right[0], c1.pins[0], { da:[1, 0], ea:0.05, w:0.03 });
  B.route(c1.pins[1], c2.pins[0], { w:0.03 });
  B.route(c2.pins[1], u2.pins[0], { da:[0, 1], ea:0.12, w:0.03 });
  B.route(u1.pins[2], tout.pins[0], { da:[0, 1], ea:0.1, w:0.03 });
  B.route(u2.pins[2], tout.pins[2], { da:[0, 1], ea:0.06, w:0.03 });
  [tout.pins[1], tout.pins[3], u1.pins[1], u2.pins[1], tin.pins[1]].forEach(p => toVia(B, p, 0, -0.08));
  B.text('PSU 12V/5V', 0.32, -0.52, 0.06); B.text('~230V', -0.45, 0.38, 0.05);
  return B.build();
}
