/**
 * Innenleben (nur im Glas-Gehäuse sichtbar), nach Vorbild echter Schrittmotor-Walzengeräte:
 * Walzenrahmen mit Seitenplatten und Traversen, je Walze Halteblech, Schrittmotor, Speichenrad mit Indexfahne,
 * Gabellichtschranke, LED-Leuchtplatine und Walzenplatine; Hebelmechanik mit eingehängter Rückholfeder.
 * Bauteile außerhalb des Walzenrahmens: interior.js, Kabel: harness.js, Münzweg: coin-chute.js.
 */
import { COLS } from '../core/config.js';
import { now } from '../core/util.js';
import { AXIS_Z, CELL_W, R, WALL_X, reelX, rowAngle } from './constants.js';
import { reels, world } from './context.js';
import { checkWiring, flushCables, registerPort, registerSolid, requirePorts, wiring } from './cables.js';
import { Batch, V, alignY, mergeGeometries } from './geo.js';
import { buildInterior, placeBoard } from './interior.js';
import { buildHarness } from './harness.js';
import { ledBoard, reelBoard } from './boards.js';
export { startCoinRun, updateCoinRun } from './coin-chute.js';

export const mech = { parts:[], backPlate:null, flags:[], cam:null, spring:null, agitator:null, light:null, flap:null, wiring, checkWiring, pcbs:[] };

/** Gemeinsame Materialien des Innenlebens. */
function materials(){
  return {
    steel:  new THREE.MeshStandardMaterial({ color:0xa9aeb6, metalness:0.85, roughness:0.42, envMapIntensity:0.9 }),
    zinc:   new THREE.MeshStandardMaterial({ color:0xc3c8cf, metalness:0.8, roughness:0.5, envMapIntensity:0.9 }),
    alu:    new THREE.MeshStandardMaterial({ color:0xd6d9de, metalness:0.9, roughness:0.28, envMapIntensity:1.0 }),
    black:  new THREE.MeshStandardMaterial({ color:0x17171b, metalness:0.35, roughness:0.55 }),
    brass:  new THREE.MeshStandardMaterial({ color:0xc9a04a, metalness:1, roughness:0.32 }),
    white:  new THREE.MeshStandardMaterial({ color:0xeceae4, roughness:0.6 }),
    spring: new THREE.MeshStandardMaterial({ color:0xb8bcc4, metalness:0.95, roughness:0.25 }),
    label:  new THREE.MeshStandardMaterial({ color:0xe8e2c8, roughness:0.7 })
  };
}

/**
 * Maße des Walzenrahmens (aus dem Walzenradius R abgeleitet): Seitenplatten, obere/untere Traverse, Walzenplatine
 * unter dem Band. Auch für Kabelbaum und Innenleben (interior.js, harness.js).
 */
export const FRAME = (() => {
  const XP = reelX(COLS - 1) + CELL_W / 2 + 0.14;   // Seitenplatten neben den äußeren Walzen
  const PY = R + 0.22, PZ = R - 0.08, PZF = R - 0.5; // halbe Höhe, Tiefe nach hinten / nach vorn (vorn Platz für Kabel)
  const RAIL_T = R + 0.1, RAIL_B = -(R + 0.37);       // obere Traverse knapp über dem Band, untere tiefer (trägt die Walzenplatinen)
  return { XP, PY, PZ, PZF, RAIL_T, RAIL_B, RB_Y: RAIL_B + 0.1, k: R / 2.1 };
})();

export function buildMechanics(){
  const add = (o, parent = world.scene) => { o.visible = false; parent.add(o); mech.parts.push(o); return o; };
  const M = materials(), b = new Batch(), zc = AXIS_Z;
  const { XP, PY, PZ, PZF, RAIL_T, RAIL_B, RB_Y, k } = FRAME, WX = WALL_X - 0.02;

  /* ----- Walzenrahmen: Seitenplatten mit Erleichterungslöchern, Traversen, Distanzstücke zu den Gehäusewänden ----- */
  const plate = new THREE.Shape(); plate.moveTo(-PZF, -PY); plate.lineTo(PZ, -PY); plate.lineTo(PZ, PY); plate.lineTo(-PZF, PY); plate.closePath();
  [[-1.1, 1.25], [1.1, 1.25], [-1.1, -1.25], [1.1, -1.25]].forEach(([a, c]) => { const h = new THREE.Path(); h.absarc(a * k, c * k, 0.5 * k, 0, Math.PI * 2, true); plate.holes.push(h); });
  const plateGeo = new THREE.ExtrudeGeometry(plate, { depth:0.04, bevelEnabled:false, curveSegments:24 });
  [-XP, XP].forEach(x => {
    b.add(plateGeo, M.zinc, new THREE.Matrix4().makeTranslation(x - 0.02, 0, zc).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)));
    registerSolid('Seitenplatte', new THREE.Box3(V(x - 0.02, -PY, zc - PZ), V(x + 0.02, PY, zc + PZF)));
    // Distanzstücke zur Gehäusewand (Vierkant) mit Wandwinkel: oben/unten, hinter und vor der Achse
    [[PY - 0.35, zc - 1.5], [-(PY - 0.35), zc - 1.5], [PY - 0.35, zc + 1.2], [-(PY - 0.35), zc + 1.2]].forEach(([y, z]) => {
      const s = Math.sign(x), len = WX - Math.abs(x) - 0.02;
      b.box(len, 0.07, 0.07, M.steel, [x + s * (0.02 + len / 2), y, z]);
      b.box(0.012, 0.18, 0.18, M.steel, [s * WX - s * 0.006, y, z]);
      registerSolid('Distanzstück', new THREE.Box3(V(Math.min(x, s * WX), y - 0.04, z - 0.04), V(Math.max(x, s * WX), y + 0.04, z + 0.04)));
    });
  });
  // Traversen zwischen den Seitenplatten: oben knapp über dem Band, unten unter den Walzen (Halter + Walzenplatinen), vorne
  const rail = (x0, x1, y, z, s = 0.08) => {
    b.box(x1 - x0, s, s, M.steel, [(x0 + x1) / 2, y, z]);
    registerSolid('Traverse', new THREE.Box3(V(x0, y - s / 2, z - s / 2), V(x1, y + s / 2, z + s / 2)));
  };
  rail(-XP, XP, RAIL_T, zc); rail(-XP, XP, RAIL_B, zc);
  rail(-XP, XP, 2.3, zc + PZF - 0.06, 0.06); rail(-XP, XP, -2.3, zc + PZF - 0.06, 0.06);

  /* ----- je Walze: Halteblech im Spalt, Motor, Speichenrad (dreht mit), Lichtschranke, LED-Platine, Walzenplatine ----- */
  // LED-Platine im Walzeninneren, 0,8 hinter dem Band; LEDs auf Höhe der vier sichtbaren Reihen
  const LED_L = R - 0.8, rowsY = [0, 1, 2, 3].map(r => R * Math.sin(rowAngle(r)) * 0.9);
  const rp = reelBoard(), lb = ledBoard(rowsY.map(y => -y));
  mech.pcbs.push({ name:'Walzenplatine', stats:rp.stats }, { name:'LED-Platine', stats:lb.stats });
  const RR = R - 0.06;   // Felgenring des Speichenrads (am Band)
  reels.forEach((reel, c) => {
    const X = reelX(c), gx = X + 0.565;
    // Speichenrad auf der Motorseite (schalenförmig: Nabe innen, Felgenring am Band), Indexfahne unten am Ring
    const wheel = [], dark = [];
    wheel.push({ geo:new THREE.CylinderGeometry(0.27, 0.27, 0.08, 28), matrix:new THREE.Matrix4().makeTranslation(0.15, 0, 0).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)) });
    const ring = new THREE.RingGeometry(RR - 0.1, RR, 96); ring.rotateY(Math.PI / 2); ring.translate(0.44, 0, 0); wheel.push({ geo:ring });
    const ring2 = new THREE.RingGeometry(RR - 0.1, RR, 96); ring2.rotateY(-Math.PI / 2); ring2.translate(0.44, 0, 0); wheel.push({ geo:ring2 });
    for (let i = 0; i < 6; i++){
      const a = i / 6 * Math.PI * 2 + 0.26, p0 = V(0.17, Math.cos(a) * 0.26, Math.sin(a) * 0.26), p1 = V(0.44, Math.cos(a) * (RR - 0.09), Math.sin(a) * (RR - 0.09));
      const d = p1.clone().sub(p0);
      wheel.push({ geo:new THREE.BoxGeometry(0.03, d.length(), 0.08), matrix:alignY(p0.clone().add(p1).multiplyScalar(0.5), d) });
    }
    dark.push({ geo:new THREE.BoxGeometry(0.06, 0.07, 0.1), matrix:new THREE.Matrix4().makeTranslation(0.48, -(RR - 0.125), 0) });   // Indexfahne
    dark.push({ geo:new THREE.CylinderGeometry(0.04, 0.04, 0.1, 12), matrix:new THREE.Matrix4().makeTranslation(0.16, 0, 0).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)) });
    add(new THREE.Mesh(mergeGeometries(wheel), M.white), reel.group);
    mech.flags.push(add(new THREE.Mesh(mergeGeometries(dark), M.black), reel.group));
    // Halteblech im Spalt: von der unteren bis zur oberen Traverse
    const hy0 = RAIL_B + 0.04, hy1 = RAIL_T - 0.04;
    b.box(0.025, hy1 - hy0, 0.3, M.zinc, [gx, (hy0 + hy1) / 2, zc]);
    registerSolid('Walzenhalter', new THREE.Box3(V(gx - 0.0125, hy0, zc - 0.15), V(gx + 0.0125, hy1, zc + 0.15)));
    // Schrittmotor: Topf, Flansch am Halteblech, Typenschild; Welle trägt das Rad. Anschluss unten (Kabel zur Walzenplatine)
    b.cyl(0.2, 0.32, M.black, [X + 0.36, 0, zc], [0, 0, Math.PI / 2], null, 28);
    b.box(0.02, 0.46, 0.46, M.steel, [X + 0.54, 0, zc]);
    b.box(0.2, 0.005, 0.18, M.label, [X + 0.36, 0.2, zc]);
    [[0.18, 0.18], [-0.18, 0.18], [0.18, -0.18], [-0.18, -0.18]].forEach(([y, z]) => b.cyl(0.025, 0.02, M.steel, [X + 0.535, y, zc + z], [0, 0, Math.PI / 2], null, 10));
    registerPort('reel' + c + '.motor', { pos:V(X + 0.54, -0.255, zc - 0.06), dir:V(0, -1, 0), part:'Motor ' + (c + 1) });
    b.box(0.02, 0.03, 0.07, M.white, [X + 0.54, -0.24, zc - 0.06]);
    // Gabellichtschranke unten am Halteblech: Fahne läuft zwischen den Schenkeln (innerhalb des Bandes)
    const oy = -(RR - 0.13);
    b.box(0.03, 0.24, 0.1, M.black, [X + 0.54, oy, zc]);
    b.box(0.07, 0.06, 0.08, M.black, [X + 0.5, oy + 0.08, zc]);
    b.box(0.07, 0.05, 0.08, M.black, [X + 0.5, oy - 0.085, zc]);
    registerPort('reel' + c + '.opto', { pos:V(X + 0.54, oy - 0.125, zc + 0.075), dir:V(0, -1, 0), part:'Lichtschranke ' + (c + 1) });
    b.box(0.02, 0.012, 0.03, M.white, [X + 0.54, oy - 0.12, zc + 0.075]);
    // LED-Leuchtplatine im Walzeninneren an einem Arm vom linken Halteblech (offene Walzenseite)
    const ax = X - 0.55;
    b.box(0.34, 0.03, 0.06, M.zinc, [ax + 0.17, 0, zc]).box(0.04, 0.03, LED_L, M.zinc, [X - 0.2, 0, zc + LED_L / 2 - 0.01]);
    b.box(0.03, 0.05, 0.06, M.white, [X - 0.54, -0.03, zc]);
    const led = lb.group.clone(); led.rotation.x = Math.PI / 2; led.position.set(X, 0, zc + LED_L); add(led);
    registerSolid('LED-Platine', new THREE.Box3(V(X - 0.32, -1.25, zc + LED_L - 0.03), V(X + 0.32, 1.25, zc + LED_L + 0.03)));
    registerPort('reel' + c + '.led', { pos:V(X - 0.54, -0.055, zc), dir:V(0, -1, 0), part:'LED-Platine ' + (c + 1) });
    // Walzenplatine unter dem Band, auf der unteren Traverse (Abstandsbolzen), steckt seitlich im Halteblech
    placeBoard(add, rp, V(X, RB_Y, zc), V(1, 0, 0), V(0, 1, 0), 'rp' + c + '.', true);
    [-0.42, 0.42].forEach(dx => b.cyl(0.025, RB_Y - RAIL_B - 0.04, M.brass, [X + dx, (RB_Y + RAIL_B + 0.04) / 2, zc], [0, 0, 0], null, 6));
    registerSolid('Walzenplatine', new THREE.Box3(V(X - 0.56, RB_Y - 0.01, zc - 0.12), V(X + 0.56, RB_Y + 0.12, zc + 0.12)));
    requirePorts('reel' + c + '.motor', 'reel' + c + '.opto', 'reel' + c + '.led');
  });
  // Halteblech links neben Walze 1 (trägt deren LED-Arm) – an der linken Seitenplatte
  b.box(0.3, 0.12, 0.3, M.zinc, [-XP + 0.17, 0, zc]);

  /* ----- Hebelmechanik: Montageplatte an der rechten Wand, Lagerbuchse, Achse, Nockenscheibe, Feder, Mikroschalter ----- */
  // Lagerplatte (Buchse + Schalterwinkel) und eigener Wandwinkel für den Federanker
  b.box(0.03, 1.3, 0.8, M.steel, [3.9, 0.12, zc + 0.26]);
  [[0.66, -0.07], [0.66, 0.6], [-0.44, -0.07], [-0.44, 0.6]].forEach(([y, z]) => b.cyl(0.03, 0.02, M.steel, [3.875, y, zc + z], [0, 0, Math.PI / 2], null, 10));
  registerSolid('Hebelplatte', new THREE.Box3(V(3.88, -0.53, zc - 0.14), V(3.92, 0.77, zc + 0.66)));
  b.box(0.03, 0.42, 0.3, M.steel, [3.9, -1.62, zc - 0.26]);
  [-0.1, 0.1].forEach(z => b.cyl(0.03, 0.02, M.steel, [3.875, -1.48, zc - 0.26 + z], [0, 0, Math.PI / 2], null, 10));
  b.cyl(0.12, 0.35, M.brass, [3.92, 0, zc], [0, 0, Math.PI / 2]);
  b.cyl(0.04, 0.3, M.steel, [3.72, 0, zc], [0, 0, Math.PI / 2]);
  mech.cam = add(new THREE.Group()); mech.cam.position.set(3.65, 0, zc);
  const camDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 32), M.steel); camDisc.rotation.z = Math.PI / 2; mech.cam.add(camDisc);
  const camLug = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.2), M.steel); camLug.position.set(0, 0.36, 0); mech.cam.add(camLug);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 12), M.steel); pin.rotation.z = Math.PI / 2; pin.position.set(-0.07, 0, -0.26); mech.cam.add(pin);
  const pinHead = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.015, 12), M.steel); pinHead.rotation.z = Math.PI / 2; pinHead.position.set(-0.13, 0, -0.26); mech.cam.add(pinHead);
  // Federanker: Winkel an der Montageplatte mit Stift
  const ANCHOR = V(3.58, -1.62, zc - 0.26);
  b.box(0.32, 0.03, 0.14, M.steel, [3.73, ANCHOR.y - 0.07, ANCHOR.z]);
  b.box(0.03, 0.2, 0.14, M.steel, [3.875, ANCHOR.y - 0.0, ANCHOR.z]);
  b.box(0.03, 0.1, 0.08, M.steel, [3.61, ANCHOR.y - 0.03, ANCHOR.z]);
  b.cyl(0.022, 0.12, M.steel, [ANCHOR.x, ANCHOR.y, ANCHOR.z], [0, 0, Math.PI / 2], null, 12);
  b.cyl(0.035, 0.015, M.steel, [ANCHOR.x - 0.065, ANCHOR.y, ANCHOR.z], [0, 0, Math.PI / 2], null, 12);
  mech.spring = buildSpring(add, M.spring, ANCHOR);
  // Mikroschalter mit Rollenhebel: wird vom Nocken in der Mitte des Hebelwegs betätigt
  const sw = V(3.66, 0.34, zc + 0.46);
  b.box(0.1, 0.14, 0.24, M.black, [sw.x, sw.y, sw.z], [-0.95, 0, 0]);
  b.box(0.012, 0.012, 0.2, M.steel, [sw.x, sw.y - 0.1, sw.z - 0.08], [-0.95, 0, 0]);
  b.cyl(0.025, 0.02, M.white, [sw.x, sw.y - 0.12, sw.z - 0.18], [0, 0, Math.PI / 2], null, 12);
  b.box(0.24, 0.03, 0.12, M.steel, [3.78, sw.y + 0.12, sw.z + 0.06]);
  registerPort('lever.switch', { pos:V(sw.x, sw.y + 0.17, sw.z + 0.05), dir:V(0, 1, 0), part:'Hebelschalter' });
  b.box(0.06, 0.04, 0.08, M.white, [sw.x, sw.y + 0.15, sw.z + 0.05]);
  registerSolid('Hebelschalter', new THREE.Box3(V(sw.x - 0.06, sw.y - 0.12, sw.z - 0.14), V(sw.x + 0.06, sw.y + 0.1, sw.z + 0.14)));
  requirePorts('lever.switch');

  // Bauteile außerhalb des Rahmens, dann Kabelbaum
  buildInterior(add, M, b);
  b.flush(add);
  buildHarness();
  flushCables(add);
  // dezente Innenbeleuchtung, damit die Mechanik im Glas lesbar ist
  mech.light = add(new THREE.PointLight(0xdfefff, 0.45, 9 * FRAME.k)); mech.light.position.set(0, 1.2, AXIS_Z + 0.9);
  updateSpring();
}

/** Zugfeder mit Ösen an beiden Enden; Länge folgt dem Abstand Anker ↔ Stift an der Nockenscheibe. */
function buildSpring(add, mat, anchor){
  const g = add(new THREE.Group()); g.position.copy(anchor);
  const coil = [], turns = 16, L0 = 1.0;
  for (let i = 0; i <= turns * 24; i++){ const a = i / 24 * Math.PI * 2; coil.push(V(Math.sin(a) * 0.055, i / (turns * 24) * L0, Math.cos(a) * 0.055)); }
  const body = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), turns * 24, 0.012, 5, false), mat);
  const eyeGeo = new THREE.TorusGeometry(0.05, 0.012, 6, 20), stemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.09, 6);
  const mkEnd = () => {
    const e = new THREE.Group();
    const eye = new THREE.Mesh(eyeGeo, mat); eye.rotation.y = Math.PI / 2; e.add(eye);   // Öse in der y-z-Ebene, der Stift (x-Achse) geht hindurch
    const stem = new THREE.Mesh(stemGeo, mat); stem.position.y = -0.095; e.add(stem);
    return e;
  };
  const top = mkEnd(), bot = mkEnd(); bot.rotation.x = Math.PI;
  g.add(body, top, bot);
  g.userData = { body, top, bot, L0, eye:0.05, stem:0.14, len:0 };
  return g;
}
const _pin = window.THREE ? new THREE.Vector3() : null, _d = window.THREE ? new THREE.Vector3() : null, _up = window.THREE ? new THREE.Vector3(0, 1, 0) : null;
function updateSpring(){
  const s = mech.spring, cam = mech.cam; if (!s || !cam) return;
  cam.updateMatrixWorld(true);
  // Stift an der Nockenscheibe in Weltkoordinaten; die Ösen hängen innen am Stift (Mittelpunkt um den Ösenradius versetzt)
  _pin.set(-0.07, 0, -0.26).applyMatrix4(cam.matrixWorld);
  _d.copy(_pin).sub(s.position);
  const len = _d.length(), u = s.userData;
  s.quaternion.setFromUnitVectors(_up, _d.normalize());
  u.bot.position.set(0, u.eye, 0);
  u.top.position.set(0, len - u.eye, 0);
  u.body.position.set(0, u.eye + u.stem, 0); u.body.scale.set(1, Math.max(0.1, len - 2 * (u.eye + u.stem)) / u.L0, 1);
  u.len = len;
}
export function animateMech(dt){
  if (!mech.cam || !mech.cam.visible) return;
  // Nockenscheibe folgt dem Hebel, Feder wird zwischen Anker und Stift gespannt
  mech.cam.rotation.x = world.lever ? world.lever.angle : 0;
  updateSpring();
  // Hopper-Rührscheibe läuft, solange Münzen ausgezahlt werden
  if (mech.agitator && world.coins && now() < world.coins.emitUntil) mech.agitator.rotation.y += dt * 4;
}
