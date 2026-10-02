/** Innenleben (nur im Glas-Gehäuse sichtbar) und Münzlauf durch den Münzprüfer. */
import { COLS } from '../core/config.js';
import { S } from '../core/state.js';
import { now } from '../core/util.js';
import { CELL_W, R, reelX } from './constants.js';
import { reels, world } from './context.js';
import { canvasTex } from './helpers.js';

/* ----- Innenleben (nur im Glas-Gehäuse sichtbar), nach Vorbild echter Schrittmotor-Walzengeräte ----- */
export const mech = { parts:[], backPlate:null, flags:[], cam:null, spring:null, agitator:null, light:null };
export function buildMechanics(){
  const add = (o, parent = world.scene) => { o.visible = false; parent.add(o); mech.parts.push(o); return o; };
  const M = {
    steel:  new THREE.MeshStandardMaterial({ color:0xa9aeb6, metalness:0.85, roughness:0.42, envMapIntensity:0.9 }),
    alu:    new THREE.MeshStandardMaterial({ color:0xd6d9de, metalness:0.9, roughness:0.28, envMapIntensity:1.0 }),
    black:  new THREE.MeshStandardMaterial({ color:0x17171b, metalness:0.35, roughness:0.55 }),
    brass:  new THREE.MeshStandardMaterial({ color:0xc9a04a, metalness:1, roughness:0.32 }),
    copper: new THREE.MeshStandardMaterial({ color:0xc06a34, metalness:1, roughness:0.35 }),
    white:  new THREE.MeshStandardMaterial({ color:0xeceae4, roughness:0.6 }),
    blue:   new THREE.MeshStandardMaterial({ color:0x2a4fa8, roughness:0.45, metalness:0.1 }),
    cap:    new THREE.MeshStandardMaterial({ color:0x1d2f6e, roughness:0.4, metalness:0.2 }),
    led:    new THREE.MeshBasicMaterial({ color:0xfff6e0, toneMapped:false })
  };
  const box = (w, h, d, mat, x, y, z, parent) => { const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), parent); m.position.set(x, y, z); return m; };
  const cyl = (r, h, mat, x, y, z, axis = 'y', parent) => {
    const m = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), mat), parent);
    if (axis === 'x') m.rotation.z = Math.PI / 2; else if (axis === 'z') m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z); return m;
  };
  const tube = (pts, r, mat, closed = false) => add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), Math.max(20, pts.length * 12), r, 6, closed), mat));
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const zc = -R, xL = reelX(0) - CELL_W / 2 - 0.14, xR = reelX(COLS - 1) + CELL_W / 2 + 0.14;

  // Walzenrahmen: Blech-Seitenwände mit Erleichterungslöchern, Querstreben, Rückwandblech
  const plate = new THREE.Shape(); plate.moveTo(-2.3, -2.35); plate.lineTo(2.3, -2.35); plate.lineTo(2.3, 2.35); plate.lineTo(-2.3, 2.35); plate.closePath();
  [[-1.2, 1.2], [1.2, 1.2], [-1.2, -1.2], [1.2, -1.2]].forEach(([a, b]) => { const h = new THREE.Path(); h.absarc(a, b, 0.45, 0, Math.PI * 2, true); plate.holes.push(h); });
  const plateGeo = new THREE.ExtrudeGeometry(plate, { depth:0.04, bevelEnabled:false, curveSegments:24 });
  [xL, xR].forEach(x => { const m = add(new THREE.Mesh(plateGeo, M.steel)); m.rotation.y = Math.PI / 2; m.position.set(x - 0.02, 0, zc); });
  [[2.3, zc - 2.25], [-2.3, zc - 2.25], [2.3, zc + 1.9], [-2.3, zc + 1.9]].forEach(([y, z]) => cyl(0.045, xR - xL, M.alu, (xL + xR) / 2, y, z, 'x'));

  reels.forEach((reel, c) => {
    const x = reelX(c), side = x + CELL_W / 2 + 0.07;
    // mitdrehend: Speichenrad beidseitig, Nabe, Indexfahne für die Lichtschranke
    for (const s of [-1, 1]) for (let k = 0; k < 6; k++){
      const sp = add(new THREE.Mesh(new THREE.BoxGeometry(0.03, (R - 0.12) * 2, 0.07), M.white), reel.group);
      sp.position.x = s * (CELL_W / 2 - 0.05); sp.rotation.x = k * Math.PI / 6;
    }
    const hub = add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, CELL_W - 0.06, 24), M.alu), reel.group); hub.rotation.z = Math.PI / 2;
    const flag = add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.12), M.black), reel.group);
    flag.position.set(CELL_W / 2 - 0.01, R - 0.05, 0); mech.flags.push(flag);
    // fest: Direktantrieb-Schrittmotor (in der Trommel), Halteblech im Spalt, Lichtschranke, LED-Leuchtplatine
    box(0.36, 0.42, 0.42, M.black, x + 0.18, 0, zc);
    box(0.02, 0.38, 0.38, M.alu, x + 0.37, 0, zc);
    const lbl = box(0.005, 0.18, 0.28, M.white, x + 0.381, 0.05, zc);
    cyl(0.03, 0.2, M.alu, x + 0.47, 0, zc, 'x');
    const bracket = box(0.03, 0.42, 2.3, M.steel, side, 0, zc - 1.15);
    box(0.03, 0.42, 0.2, M.steel, side, 0, zc - 2.28);
    const opto = box(0.08, 0.12, 0.16, M.black, side - 0.04, -0.6, zc - 2.0);
    // Leuchtplatine hinter den sichtbaren Reihen (beleuchtet die Walzenbänder von innen)
    box(CELL_W - 0.2, 2.6, 0.02, M.cap, x, 0, zc + 1.62);
    for (let k = 0; k < 4; k++) box(0.5, 0.06, 0.03, M.led, x, (1.5 - k) * 0.62, zc + 1.64);
    // Kabelbaum vom Motor zur Hauptplatine
    tube([V(x + 0.3, -0.2, zc - 0.25), V(side - 0.05, -0.5, zc - 1.2), V(side - 0.05, 1.6, zc - 2.2), V(x * 0.7, 2.62, zc - 1.6)], 0.035, [M.black, M.blue, M.copper, M.white, M.black][c]);
  });
  // Hauptplatine als Einschub über den Walzen: Kondensatoren, Chips, Kühlkörper, Stecker
  const pc = document.createElement('canvas'); pc.width = 512; pc.height = 256; const px = pc.getContext('2d');
  px.fillStyle = '#0b4f2c'; px.fillRect(0, 0, 512, 256);
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  px.strokeStyle = '#c9a54a'; px.lineWidth = 2;
  for (let i = 0; i < 90; i++){ const x0 = rnd() * 512, y0 = rnd() * 256; px.beginPath(); px.moveTo(x0, y0); px.lineTo(x0 + (rnd() - 0.5) * 160, y0); px.lineTo(x0 + (rnd() - 0.5) * 160, y0 + (rnd() - 0.5) * 90); px.stroke(); }
  px.fillStyle = '#e8e2d0'; px.font = 'bold 14px monospace'; px.fillText('MPU-5  REV C', 16, 240);
  const board = add(new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.8), new THREE.MeshStandardMaterial({ map:canvasTex(pc), roughness:0.6 })));
  board.rotation.x = -Math.PI / 2; board.position.set(0, 2.62, -2.65);
  for (const [x, z] of [[xL, -1.4], [xR, -1.4], [xL, -3.9], [xR, -3.9]]) cyl(0.04, 0.27, M.alu, x, 2.485, z);   // Abstandsbolzen auf dem Walzenrahmen
  for (let i = 0; i < 9; i++) cyl(0.07 + (i % 3) * 0.03, 0.22 + (i % 2) * 0.1, M.cap, -2.4 + i * 0.32, 2.75, -3.6);
  [[-1.2, -2.2, 0.7, 0.5], [0.4, -2.6, 0.9, 0.6], [1.9, -2.0, 0.5, 0.5], [-2.4, -2.9, 0.4, 0.4]].forEach(([x, z, w, d]) => box(w, 0.06, d, M.black, x, 2.66, z));
  for (let i = 0; i < 8; i++) box(0.05, 0.3, 0.7, M.alu, 2.4 + i * 0.09, 2.8, -3.3);   // Kühlkörper-Rippen
  for (let i = 0; i < 5; i++) box(0.38, 0.12, 0.16, M.white, -2.4 + i * 1.2, 2.69, -1.35);   // Stecker zu den Motoren
  box(5.6, 0.04, 0.5, new THREE.MeshStandardMaterial({ color:0x0b4f2c, roughness:0.6 }), 0, 2.6, 0.05);   // Platine hinter der Laufschrift
  box(5.6, 0.04, 0.45, new THREE.MeshStandardMaterial({ color:0x0b4f2c, roughness:0.6 }), 0, -2.56, 0.02); // Platine hinter den Anzeigen

  // Hebelmechanik: Lagerbuchse, Nockenscheibe (dreht mit), Rückholfeder (dehnt sich), Mikroschalter
  cyl(0.12, 0.35, M.brass, 3.92, 0, zc, 'x');
  // Nockenscheibe als Gruppe: dreht um die x-Achse mit dem Hebel; Mitnehmer sitzt am Scheibenrand (lokale Koordinaten)
  mech.cam = add(new THREE.Group()); mech.cam.position.set(3.65, 0, zc);
  const camDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 24), M.steel); camDisc.rotation.z = Math.PI / 2; mech.cam.add(camDisc);
  const camLug = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.2), M.steel); camLug.position.set(0, 0.36, 0); mech.cam.add(camLug);
  const helix = []; for (let i = 0; i <= 120; i++){ const a = i / 120 * Math.PI * 2 * 12; helix.push(V(Math.cos(a) * 0.08, -i / 120 * 1.3, Math.sin(a) * 0.08)); }
  const springGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), 360, 0.014, 5, false);
  const springPivot = add(new THREE.Group()); springPivot.position.set(3.65, -1.85, zc + 0.25);
  const springMesh = new THREE.Mesh(springGeo, M.steel); springMesh.position.y = 1.3; springPivot.add(springMesh); mech.spring = springPivot;
  box(0.2, 0.08, 0.2, M.steel, 3.65, -1.88, zc + 0.25);
  box(0.16, 0.2, 0.3, M.black, 3.65, -0.5, zc - 0.45);
  box(0.02, 0.18, 0.06, M.alu, 3.65, -0.38, zc - 0.32);

  // Unterbau: Netzteil mit Lüfter, Münzprüfer mit Fallrohr, Münz-Hopper, Lautsprecher
  const vent = document.createElement('canvas'); vent.width = vent.height = 128; const vx = vent.getContext('2d');
  vx.fillStyle = '#8f949c'; vx.fillRect(0, 0, 128, 128); vx.fillStyle = '#2a2c30';
  for (let y = 10; y < 118; y += 12) vx.fillRect(14, y, 100, 5);
  const psu = add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 1.5), [M.steel, M.steel, M.steel, M.steel, new THREE.MeshStandardMaterial({ map:canvasTex(vent), metalness:0.7, roughness:0.45 }), M.steel]));
  psu.position.set(-2.55, -4.65, -2.4);
  cyl(0.32, 0.06, M.black, -2.55, -4.65, -1.63, 'z');
  for (let k = 0; k < 7; k++){ const bl = box(0.04, 0.26, 0.02, M.black, -2.55, -4.65, -1.59); bl.rotation.z = k / 7 * Math.PI * 2; bl.position.x += Math.cos(k / 7 * Math.PI * 2) * 0.12; bl.position.y += Math.sin(k / 7 * Math.PI * 2) * 0.12; }
  box(0.5, 0.6, 0.45, M.black, 3.3, 2.0, -0.6);
  box(0.06, 0.18, 0.02, M.alu, 3.3, 2.05, -0.37);
  tube([V(3.3, 1.7, -0.7), V(3.55, 0.6, -0.9), V(3.6, -2.6, -1.1), V(3.1, -3.7, -1.9), V(2.3, -4.15, -2.3)], 0.07, new THREE.MeshStandardMaterial({ color:0xb8c8d8, metalness:0.2, roughness:0.15, transparent:true, opacity:0.55 }));
  const hopper = add(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.7, 0.75, 32, 1, true), new THREE.MeshStandardMaterial({ color:0x2a2c32, metalness:0.5, roughness:0.4, side:THREE.DoubleSide })));
  hopper.position.set(1.9, -4.55, -2.4); hopper.rotation.x = 0.35;
  mech.agitator = add(new THREE.Group()); mech.agitator.position.copy(hopper.position); mech.agitator.rotation.x = 0.35;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.03, 32), M.steel); disc.position.y = -0.3; mech.agitator.add(disc);
  for (let i = 0; i < 26; i++){
    const cn = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.03, 18), M.brass);
    const a = i * 2.4, rr = 0.12 + (i % 5) * 0.11;
    cn.position.set(Math.cos(a) * rr, -0.27 + Math.floor(i / 9) * 0.035, Math.sin(a) * rr); cn.rotation.set(0.2 * Math.sin(i), 0, 0.2 * Math.cos(i)); mech.agitator.add(cn);
  }
  cyl(0.22, 0.45, M.black, 1.9, -5.0, -2.75, 'z');
  const spk = add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.14, 0.22, 28, 1, true), new THREE.MeshStandardMaterial({ color:0x222226, roughness:0.8, side:THREE.DoubleSide })));
  spk.rotation.x = -Math.PI / 2; spk.position.set(-0.6, -4.55, -0.25);
  cyl(0.16, 0.14, M.steel, -0.6, -4.55, -0.45, 'z');
  // dezente Innenbeleuchtung, damit die Mechanik im Glas lesbar ist
  // Ausgaberutsche vom Hopper zur Auswurföffnung
  tube([V(1.9, -4.8, -1.95), V(1.3, -4.92, -1.0), V(0.4, -5.02, -0.1), V(0, -5.02, 0.34)], 0.1, M.steel);
  // Füße für Hopper und Netzteil
  [[1.45, -2.4], [2.35, -2.4]].forEach(([x, z]) => box(0.07, 0.4, 0.07, M.steel, x, -5.02, z));
  [[-3.3, -3.0], [-1.8, -3.0], [-3.3, -1.8], [-1.8, -1.8]].forEach(([x, z]) => box(0.1, 0.12, 0.1, M.black, x, -5.16, z));
  // Kabel: Netzteil → Platine, Netzteil → Hopper-Motor, Platine → Lautsprecher / Münzprüfer / Mikroschalter / Anzeigen / Tasten-Deck
  const wRed = new THREE.MeshStandardMaterial({ color:0xb02020, roughness:0.5 }), wGrey = new THREE.MeshStandardMaterial({ color:0x9a9aa2, roughness:0.5 });
  tube([V(-2.55, -4.2, -2.7), V(-3.5, -3.6, -2.9), V(-3.6, 1.5, -3.1), V(-3.0, 2.62, -3.1)], 0.05, M.black);
  tube([V(-1.7, -4.95, -2.6), V(0, -5.12, -2.9), V(1.6, -5.05, -2.85)], 0.035, wRed);
  tube([V(-2.0, 2.62, -1.5), V(-3.45, 1.2, -0.9), V(-3.2, -3.9, -0.6), V(-0.8, -4.55, -0.5)], 0.03, M.blue);
  tube([V(2.4, 2.66, -1.4), V(3.0, 2.45, -1.05), V(3.3, 2.05, -0.84)], 0.03, wRed);
  tube([V(2.9, 2.6, -3.4), V(3.45, 1.5, -3.0), V(3.6, -0.45, -2.6)], 0.028, M.black);
  tube([V(2.8, 2.62, -1.3), V(3.45, 2.1, -0.6), V(3.45, -2.3, -0.3), V(2.7, -2.56, -0.06)], 0.035, wGrey);
  tube([V(0, -3.62, 0.25), V(1.6, -3.55, -0.3), V(3.3, -2.9, -0.45), V(3.45, -2.4, -0.32)], 0.03, M.blue);
  box(1.2, 0.012, 1.3, wGrey, 0, 2.645, -0.6);   // Flachbandkabel zur Laufschrift-Platine
  reels.forEach((reel, c) => {
    const x = reelX(c), side = x + CELL_W / 2 + 0.07;
    tube([V(x - 0.25, -1.32, zc + 1.6), V(x + 0.3, -1.3, zc + 0.6), V(x + 0.36, -0.22, zc)], 0.018, wGrey);   // Leuchtplatine → Motorhalter
    tube([V(side - 0.04, -0.6, zc - 2.06), V(side, -0.3, zc - 2.2), V(side, 0, zc - 2.28)], 0.016, M.black);   // Lichtschranke → Halter
  });
  mech.light = add(new THREE.PointLight(0xdfefff, 0.45, 9)); mech.light.position.set(0, 1.2, -1.2);
}
// Münze läuft vom Einwurf durch den Münzprüfer und das Fallrohr in den Hopper
let coinRun = null;
const COIN_PATH = window.THREE ? new THREE.CatmullRomCurve3([[3.55, 2.24, 0.75], [3.55, 2.24, 0.3], [3.3, 2.05, -0.6], [3.55, 0.6, -0.9], [3.6, -2.6, -1.1], [3.1, -3.7, -1.9], [2.3, -4.15, -2.3]].map(a => new THREE.Vector3(...a))) : null;
export function startCoinRun(){
  if (!world.scene) return;
  if (!coinRun){
    coinRun = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 20), new THREE.MeshStandardMaterial({ color:0xd8b25a, metalness:1, roughness:0.25 }));
    world.scene.add(coinRun);
  }
  coinRun.visible = true; coinRun.userData.t0 = now();
}
export function updateCoinRun(t){
  if (!coinRun || !coinRun.visible) return;
  const x = (t - coinRun.userData.t0) / (S.turbo ? 700 : 1400);
  if (x >= 1){ coinRun.visible = false; return; }
  coinRun.position.copy(COIN_PATH.getPoint(x));
  coinRun.rotation.set(Math.PI / 2, 0, x * 25);
}
export function animateMech(dt){
  if (!mech.cam || !mech.cam.visible) return;
  // Nockenscheibe folgt dem Hebel, Feder dehnt sich mit
  mech.cam.rotation.x = world.lever ? world.lever.angle : 0;
  if (mech.spring) mech.spring.scale.y = 1 + (world.lever ? world.lever.angle : 0) * 0.28;
  // Hopper-Rührscheibe läuft, solange Münzen ausgezahlt werden
  if (mech.agitator && world.coins && now() < world.coins.emitUntil) mech.agitator.rotation.y += dt * 4;
}
