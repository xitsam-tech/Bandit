/**
 * Bauteile außerhalb des Walzenrahmens: Hauptplatine, Lampentreiber, Anzeigen-Treiber, Tasten-Steckerplatine mit
 * Tastenschaltern, Lampenfassungen, Glühbirnen-Ringleitung, Aufsatz-Leuchtstoffröhre mit Vorschaltgerät,
 * Münzprüfer mit Rückgabetaste, Münzrinnen, Hopper, Netzteil mit Netzeingang, Lautsprecher.
 * Registriert dabei alle Anschlüsse (Ports) und großen Bauteile (Hindernisse) für die Kabelprüfung.
 */
import { lamps, world } from './context.js';
import { bulbRing } from './bulbs.js';
import { deck } from './lower-cabinet.js';
import { registerBoardPorts, registerChannel, registerPort, registerSolid, requirePorts } from './cables.js';
import { V } from './geo.js';
import { worldPorts } from './pcb.js';
import { buttonBoard, displayBoard, lampDriverBoard, mainBoard, psuBoard } from './boards.js';
import { buildCoinChutes } from './coin-chute.js';
import { mech } from './mechanics.js';

/**
 * Platine einsetzen: Lage über die Achsen (xw = Platinen-x, yw = Bestückungsseite) im Koordinatensystem von `parent`,
 * Ports mit Präfix registrieren. clone: Gruppe kopieren (gleiche Platine mehrfach).
 */
export function placeBoard(add, built, pos, xw, yw, prefix = '', clone = false, parent = world.scene){
  const g = clone ? built.group.clone() : built.group;
  const z = new THREE.Vector3().crossVectors(xw, yw).normalize();
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xw.clone().normalize(), yw.clone().normalize(), z));
  g.position.copy(pos); add(g, parent);
  registerBoardPorts(worldPorts(g, built.ports).map(p => ({ ...p, id:prefix + p.id })));
  return g;
}
/** Abstandsbolzen (Sechskant) von a nach b mit Schraubenkopf am Ende b. */
function standoff(b, M, a, w){
  const d = w.clone().sub(a), mid = a.clone().add(w).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
  b.add(new THREE.CylinderGeometry(0.03, 0.03, d.length(), 6), M.brass, new THREE.Matrix4().compose(mid, q, V(1, 1, 1)));
  b.add(new THREE.CylinderGeometry(0.03, 0.03, 0.015, 12), M.steel, new THREE.Matrix4().compose(w.clone().addScaledVector(d.normalize(), 0.04), q, V(1, 1, 1)));
}

export function buildInterior(add, M, b){
  /* ----- Hauptplatine über den Walzen, auf den oberen Traversen ----- */
  const mb = mainBoard(); mech.pcbs.push({ name:'Hauptplatine', stats:mb.stats });
  placeBoard(add, mb, V(0, 2.615, -3.3), V(1, 0, 0), V(0, 1, 0));
  [[-3.1, -4.0], [3.1, -4.0], [-3.1, -2.6], [3.1, -2.6]].forEach(([x, z]) => standoff(b, M, V(x, 2.5, z), V(x, 2.6, z)));
  registerSolid('Hauptplatine', new THREE.Box3(V(-3.2, 2.58, -4.1), V(3.2, 2.67, -2.5)));
  registerSolid('Kühlkörper', new THREE.Box3(V(-2.38, 2.6, -3.92), V(-2.12, 2.86, -3.72)));

  /* ----- Lampentreiber an der linken Wand ----- */
  const ld = lampDriverBoard(); mech.pcbs.push({ name:'Lampentreiber', stats:ld.stats });
  const LD = V(-3.8, 1.0, -2.5);
  placeBoard(add, ld, LD, V(0, 0, -1), V(1, 0, 0));
  [[-0.82, -0.63], [0.82, -0.63], [-0.82, 0.63], [0.82, 0.63]].forEach(([u, v]) => standoff(b, M, V(-3.96, LD.y - v, LD.z - u), V(-3.815, LD.y - v, LD.z - u)));
  registerSolid('Lampentreiber', new THREE.Box3(V(-3.97, LD.y - 0.7, LD.z - 0.9), V(-3.72, LD.y + 0.7, LD.z + 0.9)));

  /* ----- Treiberplatinen hinter Laufschrift und LCDs ----- */
  const tk = displayBoard('TICKER DRV', 'ticker.in', [0.21, 1.1, 1.99], -1.6), lc = displayBoard('LCD DRV', 'lcd.in', [-0.95, 0.15, 1.25, 2.35], -2.1);
  mech.pcbs.push({ name:'Laufschrift', stats:tk.stats }, { name:'LCD', stats:lc.stats });
  placeBoard(add, tk, V(0, 2.6, 0.24), V(-1, 0, 0), V(0, 0, -1));
  placeBoard(add, lc, V(0, -2.56, 0.24), V(-1, 0, 0), V(0, 0, -1));
  [2.6, -2.56].forEach(y => [-2.7, 2.7].forEach(x => standoff(b, M, V(x, y, 0.36), V(x, y, 0.255))));
  registerSolid('Laufschrift-Platine', new THREE.Box3(V(-2.8, 2.37, 0.05), V(2.8, 2.83, 0.3)));
  registerSolid('LCD-Platine', new THREE.Box3(V(-2.8, -2.79, 0.05), V(2.8, -2.33, 0.3)));
  requirePorts('ticker.in', 'lcd.in');

  /* ----- Lampenfassungen hinter den Reihen- und Paarlampen ----- */
  const bake = new THREE.MeshStandardMaterial({ color:0x2a2420, roughness:0.6 });
  lamps.rows.concat(lamps.pairs).forEach((l, i) => {
    const p = l.g.position, id = i < 4 ? 'lamp.row' + i : 'lamp.pair' + (i - 4);
    b.cyl(0.085, 0.2, bake, [p.x, p.y, 0.26], [Math.PI / 2, 0, 0], null, 18);
    b.cyl(0.11, 0.02, M.steel, [p.x, p.y, 0.355], [Math.PI / 2, 0, 0], null, 18);
    b.box(0.05, 0.03, 0.03, M.white, [p.x, p.y, 0.15]);
    registerPort(id, { pos:V(p.x, p.y, 0.135), dir:V(0, 0, -1), part:'Lampe ' + id });
    registerSolid('Lampenfassung', new THREE.Box3(V(p.x - 0.11, p.y - 0.11, 0.15), V(p.x + 0.11, p.y + 0.11, 0.37)));
    requirePorts(id);
  });

  /* ----- Glühbirnen: Fassungen durch die Front, umlaufende Ringleitung (Hin- und Rückleiter) ----- */
  const ringPts = (z) => bulbRing.pts.map(p => V(p.x, p.y, z));
  bulbRing.pts.forEach(p => b.cyl(0.026, 0.18, bake, [p.x, p.y, 0.29], [Math.PI / 2, 0, 0], null, 8));
  [[0.215, 0x8a1a1a], [0.185, 0x1c1c20]].forEach(([z, col]) => {
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ringPts(z), true), 288, 0.01, 4, true), new THREE.MeshStandardMaterial({ color:col, roughness:0.5 })));
  });
  const feed = bulbRing.pts.reduce((m, p) => (Math.hypot(p.x + 3.3, p.y) < Math.hypot(m.x + 3.3, m.y) ? p : m));
  b.box(0.07, 0.1, 0.09, M.white, [feed.x, feed.y, 0.17]);
  registerPort('bulbs.feed', { pos:V(feed.x, feed.y, 0.12), dir:V(0, 0, -1), part:'Glühbirnenkranz' });
  requirePorts('bulbs.feed');

  /* ----- Aufsatz: Leuchtstoffröhre mit Reflektor, Vorschaltgerät ----- */
  const tube = add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5.0, 20), new THREE.MeshBasicMaterial({ color:0xcfe4ff, toneMapped:false })));
  tube.rotation.z = Math.PI / 2; tube.position.set(0, 4.15, -0.6);
  [-1, 1].forEach(s => { b.box(0.12, 0.16, 0.14, M.white, [s * 2.56, 4.15, -0.6]); b.box(0.03, 0.62, 0.14, M.steel, [s * 2.56, 3.73, -0.62]); b.box(0.12, 0.02, 0.2, M.steel, [s * 2.56, 3.42, -0.62]); });
  b.box(5.4, 0.5, 0.02, M.alu, [0, 4.15, -0.76]); b.box(5.4, 0.02, 0.2, M.alu, [0, 4.4, -0.67]); b.box(5.4, 0.02, 0.2, M.alu, [0, 3.9, -0.67]);
  b.box(0.6, 0.14, 0.3, M.steel, [-2.6, 3.47, -1.4]); b.box(0.4, 0.004, 0.2, M.label, [-2.6, 3.542, -1.4]);
  [-1, 1].forEach(s => b.box(0.08, 0.01, 0.36, M.steel, [-2.6 + s * 0.34, 3.405, -1.4]));
  registerPort('mq.feed', { pos:V(-2.92, 3.47, -1.4), dir:V(-1, 0, 0), part:'Vorschaltgerät' });
  registerPort('mq.out', { pos:V(-2.28, 3.47, -1.4), dir:V(1, 0, 0), part:'Vorschaltgerät' });
  registerPort('mq.tube', { pos:V(-2.56, 4.05, -0.6), dir:V(0, -1, 0), part:'Leuchtstoffröhre' });
  registerSolid('Vorschaltgerät', new THREE.Box3(V(-2.9, 3.4, -1.55), V(-2.3, 3.54, -1.25)));
  registerSolid('Reflektor', new THREE.Box3(V(-2.7, 3.89, -0.8), V(2.7, 4.42, -0.56)));
  requirePorts('mq.feed');

  /* ----- Münzprüfer hinter dem Einwurf, Rückgabetaste, Münzrinnen ----- */
  b.box(0.5, 0.6, 0.45, M.black, [3.45, 2.0, -0.6]);
  b.box(0.005, 0.3, 0.3, M.label, [3.198, 2.05, -0.6]);
  b.box(0.16, 0.08, 0.06, M.steel, [3.55, 2.06, -0.36]);
  b.box(0.36, 0.03, 0.66, M.steel, [3.45, 2.315, -0.12]);   // Haltewinkel zur Front
  b.box(0.36, 0.2, 0.03, M.steel, [3.45, 2.22, 0.21]);
  registerSolid('Münzprüfer', new THREE.Box3(V(3.2, 1.7, -0.825), V(3.7, 2.3, -0.375)));
  registerPort('coin.main', { pos:V(3.45, 2.0, -0.835), dir:V(0, 0, -1), part:'Münzprüfer' });
  registerPort('coin.aux', { pos:V(3.3, 1.78, -0.365), dir:V(0, 0, 1), part:'Münzprüfer' });
  b.box(0.04, 0.05, 0.07, M.white, [3.45, 2.0, -0.84]); b.box(0.04, 0.05, 0.05, M.white, [3.3, 1.78, -0.36]);
  b.box(0.1, 0.09, 0.12, M.black, [3.55, 1.95, 0.24]); b.cyl(0.02, 0.1, M.steel, [3.55, 1.95, 0.35], [Math.PI / 2, 0, 0], null, 10);
  registerPort('reject', { pos:V(3.55, 1.95, 0.175), dir:V(0, 0, -1), part:'Rückgabetaste' });
  requirePorts('coin.main', 'reject');
  buildCoinChutes(add).channels.forEach(c => registerChannel(c.name, c.path, c.r));

  /* ----- Hopper: Unterbau, schräger Vorratstopf mit Rührscheibe, Getriebemotor, Auswurf ----- */
  const HP = V(2.6, -4.75, -2.3);
  b.box(1.3, 0.5, 1.2, M.black, [HP.x, HP.y, HP.z]);
  b.box(0.42, 0.14, 0.26, M.black, [2.02, -4.62, -1.62]);
  b.cyl(0.16, 0.22, M.steel, [HP.x, HP.y, -3.0], [Math.PI / 2, 0, 0], null, 20);
  b.box(0.06, 0.06, 0.06, M.white, [HP.x, HP.y, -3.12]);
  [[-0.55, -0.5], [0.55, -0.5], [-0.55, 0.5], [0.55, 0.5]].forEach(([x, z]) => b.box(0.08, 0.17, 0.08, M.steel, [HP.x + x, -5.085, HP.z + z]));
  const bowl = add(new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 0.6, 32, 1, true), new THREE.MeshStandardMaterial({ color:0x2a2c32, metalness:0.5, roughness:0.4, side:THREE.DoubleSide })));
  bowl.position.set(HP.x, -4.2, HP.z); bowl.rotation.x = 0.2;
  mech.agitator = add(new THREE.Group()); mech.agitator.position.copy(bowl.position); mech.agitator.rotation.x = 0.2;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.03, 32), M.steel); disc.position.y = -0.27; mech.agitator.add(disc);
  for (let i = 0; i < 24; i++){
    const cn = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 18), M.brass);
    const a = i * 2.4, rr = 0.1 + (i % 5) * 0.09;
    cn.position.set(Math.cos(a) * rr, -0.24 + Math.floor(i / 9) * 0.035, Math.sin(a) * rr); cn.rotation.set(0.2 * Math.sin(i), 0, 0.2 * Math.cos(i)); mech.agitator.add(cn);
  }
  registerPort('hopper', { pos:V(HP.x, HP.y, -3.13), dir:V(0, 0, -1), part:'Hopper' });
  registerSolid('Hopper', new THREE.Box3(V(1.85, -5.17, -3.12), V(3.35, -3.85, -1.5)));
  requirePorts('hopper');

  /* ----- Netzteil (offen auf Blechwanne), Netzeingang an der Rückwand ----- */
  const ps = psuBoard(); mech.pcbs.push({ name:'Netzteil', stats:ps.stats });
  b.box(1.66, 0.04, 1.4, M.zinc, [-2.55, -5.13, -2.4]);
  [-1, 1].forEach(s => b.box(1.66, 0.12, 0.03, M.zinc, [-2.55, -5.07, -2.4 + s * 0.69]));
  const PS = V(-2.55, -4.95, -2.4);
  placeBoard(add, ps, PS, V(1, 0, 0), V(0, 1, 0));
  [[-0.68, -0.58], [0.68, -0.58], [-0.68, 0.58], [0.68, 0.58]].forEach(([x, z]) => standoff(b, M, V(PS.x + x, -5.11, PS.z + z), V(PS.x + x, -4.965, PS.z + z)));
  registerSolid('Netzteil', new THREE.Box3(V(-3.33, -5.17, -3.1), V(-1.77, -4.55, -1.7)));
  b.box(0.3, 0.2, 0.1, M.black, [-3.4, -4.7, -3.97]); b.box(0.2, 0.12, 0.02, M.steel, [-3.4, -4.7, -3.915]);
  registerPort('mains.in', { pos:V(-3.4, -4.7, -3.9), dir:V(0, 0, 1), part:'Netzeingang' });
  requirePorts('psu.out', 'psu.mains');

  /* ----- Lautsprecher hinter der Front des Unterteils ----- */
  const spk = add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.14, 0.22, 28, 1, true), new THREE.MeshStandardMaterial({ color:0x222226, roughness:0.8, side:THREE.DoubleSide })));
  spk.rotation.x = Math.PI / 2; spk.position.set(-2.4, -4.0, 0.12);
  b.add(new THREE.TorusGeometry(0.41, 0.025, 8, 32), M.black, new THREE.Matrix4().makeTranslation(-2.4, -4.0, 0.24));
  b.cyl(0.16, 0.12, M.steel, [-2.4, -4.0, -0.04], [Math.PI / 2, 0, 0], null, 20);
  [0, 1, 2, 3].forEach(k => { const a = k * Math.PI / 2 + Math.PI / 4; b.box(0.04, 0.04, 0.05, M.steel, [-2.4 + Math.cos(a) * 0.44, -4.0 + Math.sin(a) * 0.44, 0.255]); });
  b.box(0.05, 0.05, 0.04, M.white, [-2.4, -4.0, -0.12]);
  registerPort('speaker', { pos:V(-2.4, -4.0, -0.14), dir:V(0, 0, -1), part:'Lautsprecher' });
  registerSolid('Lautsprecher', new THREE.Box3(V(-2.85, -4.45, -0.12), V(-1.95, -3.55, 0.27)));
  requirePorts('speaker');

  /* ----- Tasten: Schaltblock unter jeder Kappe, Steckerplatine darunter (im Pultkeil) ----- */
  if (deck.group){
    deck.group.updateWorldMatrix(true, false);
    const q = deck.group.getWorldQuaternion(new THREE.Quaternion()), down = V(0, -1, 0).applyQuaternion(q);
    deck.buttons.forEach(btn => {
      const x = btn.group.position.x;
      const m = add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.22), M.black), deck.group); m.position.set(x, -0.08, 0);
      const h = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), M.white), deck.group); h.position.set(x, -0.165, 0.0);
      registerPort('btn.' + btn.id, { pos:deck.group.localToWorld(V(x, -0.19, 0)), dir:down, part:'Taste ' + btn.id });
      requirePorts('btn.' + btn.id);
    });
    const bb = buttonBoard(deck.buttons.map(btn => ({ id:btn.id, x:btn.group.position.x })));
    mech.pcbs.push({ name:'Tastenplatine', stats:bb.stats });
    placeBoard(add, bb, V(0, -0.42, 0), V(1, 0, 0), V(0, 1, 0), '', false, deck.group);
  }
}
