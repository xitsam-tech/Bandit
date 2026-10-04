/** Unterbau: schräges Tasten-Deck, Belly-Glass (Artwork/Risikoleiter), Münzeinwurf, Münzschale, Sockel. */
import { BET_STEPS, CLOVER, DIAMOND, GAMBLE_MAX_STEPS, SCATTER } from '../core/config.js';
import { rt, selectionLocked } from '../core/runtime.js';
import { S } from '../core/state.js';
import { fmt } from '../core/util.js';
import { $ } from '../dom.js';
import { roundRect } from '../gfx/canvas2d.js';
import { drawSymbolArt } from '../gfx/symbols.js';
import { CAB_DEPTH, FRONT_Z } from './constants.js';
import { pickables, world } from './context.js';
import { canvasTex, frameMesh, rrShape } from './helpers.js';
import { CAB_STYLES } from './styles.js';
import { buildMouth, buildTray, updateMouth } from './tray.js';

/* ----- Unterbau nach Vorbild echter Geräte: schräges Tasten-Deck, Belly-Glass, Sockel ----- */
export const deck = { buttons:[], group:null };
/** Münzschale: Innenmaße der Mulde (Rand vorne `top`, hinten `back`), Eckradius, Bodenrundung, Mattenstärke. */
export const TRAY = { x0:-1.7, x1:1.7, z0:0.42, z1:1.75, floor:-5.2, top:-4.94, back:-5.13, r:0.24, fillet:0.08, mat:0.015 };
let mouth = null;
const DECK_BTNS = [
  { id:'auto',  label:'AUTO',    x:-3.0,  r:0.25, col:0x2f6bff },
  { id:'down',  label:'−',       x:-2.3,  r:0.22, col:0x8c7cff },
  { id:'up',    label:'+',       x:-1.66, r:0.22, col:0x8c7cff },
  { id:'start', label:'START',   x:-0.35, r:0.44, col:0x2ecc40, big:true },
  { id:'red',   label:'ROT',     x:1.05,  r:0.26, col:0xe02030 },
  { id:'black', label:'SCHWARZ', x:1.8,   r:0.26, col:0x3a3346 },
  { id:'take',  label:'NEHMEN',  x:2.75,  r:0.3,  col:0xffc400 }
];
function btnLabelTex(text, big){
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const draw = () => {
    x.clearRect(0, 0, 256, 256);
    // Schrift so groß wie möglich: max. 210 px breit, max. 72 px hoch (Einzelzeichen größer)
    x.font = '400 100px Bungee, Impact, sans-serif';
    const size = text.length === 1 ? 140 : Math.min(big ? 76 : 72, 100 * 210 / x.measureText(text).width);
    x.font = `400 ${size}px Bungee, Impact, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.lineWidth = 12; x.strokeStyle = '#000c'; x.strokeText(text, 128, 134); x.fillStyle = '#fff'; x.fillText(text, 128, 134);
    t.needsUpdate = true;
  };
  const t = canvasTex(c); draw(); document.fonts && document.fonts.ready.then(draw);
  return t;
}
export function buildLowerCabinet(lacquer, chrome, gold, dark){
  // Tasten-Pult: keilförmiger Vorbau in voller Gehäusebreite, aus demselben Material wie der Korpus.
  // Profil in der y/z-Ebene (hinten oben → vorne oben → Vorderkante → hinten unten), entlang x extrudiert.
  const P = { backTop:[0.3, -2.95], frontTop:[1.25, -3.85], frontBot:[1.25, -3.98], backBot:[0.3, -4.08] }, W = 8.1;
  const prof = new THREE.Shape();
  prof.moveTo(...P.backTop); prof.lineTo(...P.frontTop); prof.lineTo(...P.frontBot); prof.lineTo(...P.backBot); prof.closePath();
  const wedge = new THREE.Mesh(new THREE.ExtrudeGeometry(prof, { depth:W, bevelEnabled:true, bevelThickness:0.05, bevelSize:0.03, bevelSegments:3 }), lacquer);
  wedge.rotation.y = -Math.PI / 2; wedge.position.x = W / 2; world.scene.add(wedge);
  // Tastenfläche liegt mittig auf der Schräge; Gruppe ist so gedreht, dass ihre y-Achse senkrecht auf der Schräge steht
  const dz = P.frontTop[0] - P.backTop[0], dy = P.backTop[1] - P.frontTop[1];
  const g = new THREE.Group();
  g.position.set(0, (P.backTop[1] + P.frontTop[1]) / 2, (P.backTop[0] + P.frontTop[0]) / 2);
  g.rotation.x = Math.atan2(dy, dz); world.scene.add(g); deck.group = g;
  const slope = Math.hypot(dz, dy);
  const inset = new THREE.Mesh(new THREE.BoxGeometry(W - 0.5, 0.02, slope - 0.22), new THREE.MeshStandardMaterial({ color:0x050506, roughness:0.85, metalness:0, envMapIntensity:0.1 }));
  inset.position.y = 0.012; g.add(inset);
  const rim = frameMesh(W - 0.38, slope - 0.1, W - 0.5, slope - 0.22, 0.08, 0.025, chrome);
  rim.rotation.x = -Math.PI / 2; rim.position.y = 0.0; g.add(rim);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.045, 0.045), gold);
  lip.position.set(0, P.frontTop[1] - 0.02, P.frontTop[0] + 0.05); world.scene.add(lip);
  DECK_BTNS.forEach(b => {
    const bg = new THREE.Group(); bg.position.set(b.x, 0.0, 0.0); g.add(bg);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(b.r + 0.06, b.r + 0.07, 0.04, 40), new THREE.MeshStandardMaterial({ color:0x050507, roughness:0.6 })); seat.position.y = 0.02; bg.add(seat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(b.r + 0.035, 0.028, 12, 48), chrome); ring.rotation.x = Math.PI / 2; ring.position.y = 0.045; bg.add(ring);
    const mat = new THREE.MeshPhysicalMaterial({
      color:b.col, roughness:0.3, metalness:0, clearcoat:1, clearcoatRoughness:0.04,
      emissive:b.col, emissiveIntensity:0.05, envMapIntensity:0.7, side:THREE.DoubleSide
    });
    // gewölbte Kunststoffkappe (Drehprofil mit runder Kante)
    const r = b.r, prof = [[r, 0.0], [r, 0.085], [r * 0.98, 0.104], [r * 0.9, 0.122], [r * 0.75, 0.136], [r * 0.45, 0.146], [0.001, 0.15]].map(([a, y]) => new THREE.Vector2(a, y));
    const cap = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), mat); cap.position.y = 0.04; bg.add(cap);
    const lbl = new THREE.Mesh(new THREE.CircleGeometry(b.r * 0.92, 40), new THREE.MeshBasicMaterial({ map:btnLabelTex(b.label, b.big), transparent:true, depthWrite:false, toneMapped:false }));
    lbl.rotation.x = -Math.PI / 2; lbl.position.y = 0.196; lbl.scale.setScalar(0.86); bg.add(lbl);
    [cap, lbl].forEach(m => { m.userData = { action:'btn', id:b.id }; pickables.push(m); });
    deck.buttons.push({ ...b, group:bg, cap, mat, lbl, press:0, lit:0 });
  });

  // Belly-Glass mit Artwork / Risikoleiter
  const bodyShape = rrShape(8.1, 2.12, 0.2, 0, -4.19);
  const lowDepth = CAB_DEPTH - 0.2;   // Unterteil etwas weniger tief als das Oberteil
  const lower = new THREE.Mesh(new THREE.ExtrudeGeometry(bodyShape, { depth:lowDepth, bevelEnabled:true, bevelThickness:0.06, bevelSize:0.06, bevelSegments:3 }), lacquer);
  lower.position.z = FRONT_Z - lowDepth; world.scene.add(lower);
  const bc = document.createElement('canvas'); bc.width = 1400; bc.height = 144;
  const btex = canvasTex(bc);
  const glassM = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 0.72), new THREE.MeshBasicMaterial({ map:btex, toneMapped:false }));
  glassM.position.set(0, -4.5, 0.4); world.scene.add(glassM);
  const bf = frameMesh(7.2, 0.9, 7.0, 0.72, 0.12, 0.06, chrome); bf.position.set(0, -4.5, 0.34); world.scene.add(bf);
  world.belly = { canvas:bc, tex:btex, key:'' };

  // Münzeinwurf rechts oben (dahinter sitzt der Münzprüfer)
  const slotPlate = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.62, 0.05), chrome); slotPlate.position.set(3.55, 2.15, 0.4); world.scene.add(slotPlate);
  const slotHole = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.02), dark); slotHole.position.set(3.55, 2.24, 0.43); world.scene.add(slotHole);
  const rejectBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 20), new THREE.MeshStandardMaterial({ color:0xb0242c, roughness:0.35 }));
  rejectBtn.rotation.x = Math.PI / 2; rejectBtn.position.set(3.55, 1.95, 0.44); world.scene.add(rejectBtn);
  // Auswurföffnung und verchromte Münzschale vorne unten
  const hole = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 0.02), dark); hole.position.set(0, -5.02, 0.37); world.scene.add(hole);
  const mouthF = frameMesh(1.66, 0.36, 1.5, 0.2, 0.06, 0.04, chrome); mouthF.position.set(0, -5.02, 0.35); world.scene.add(mouthF);
  buildTray(TRAY, chrome);
  mouth = buildMouth(0, -5.02, 0.37, 1.5, chrome);

  // Sockel mit Schattenfuge und Goldleiste
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.36, CAB_DEPTH), dark); plinth.position.set(0, -5.43, FRONT_Z + 0.1 - CAB_DEPTH / 2); world.scene.add(plinth);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(8.3, 0.1, CAB_DEPTH + 0.4), chrome); foot.position.set(0, -5.56, FRONT_Z + 0.1 - CAB_DEPTH / 2); world.scene.add(foot);
  const goldLine = new THREE.Mesh(new THREE.BoxGeometry(7.82, 0.035, 0.04), gold); goldLine.position.set(0, -5.29, 0.42); world.scene.add(goldLine);

}
export function updateDeck(t, dt){
  if (!deck.group) return;
  updateMouth(mouth, dt);
  const canSpin = !$('spinBtn').disabled, gOpen = rt.gamble && !rt.gamble.busy, lock = selectionLocked();
  const pulse = 0.5 + 0.5 * Math.sin(t / 220);
  deck.buttons.forEach(b => {
    let want = 0.05;
    if (b.id === 'start') want = canSpin ? 0.55 + 0.45 * pulse : 0.05;
    else if (b.id === 'auto') want = rt.autoOn ? 0.9 : 0.25;
    else if (b.id === 'down') want = !lock && S.betIdx > 0 ? 0.35 : 0.04;
    else if (b.id === 'up') want = !lock && S.betIdx < BET_STEPS.length - 1 ? 0.35 : 0.04;
    else if (b.id === 'red' || b.id === 'black') want = gOpen ? 0.6 + 0.4 * pulse : 0.03;
    else if (b.id === 'take') want = gOpen ? 0.9 : 0.03;
    b.lit += (want - b.lit) * Math.min(1, dt * 10);
    b.mat.emissiveIntensity = b.lit * (b.id === 'black' ? 1.6 : 0.75);
    b.lbl.material.opacity = 0.7 + 0.3 * Math.min(1, b.lit * 1.6);
    b.press = Math.max(0, b.press - dt * 6);
    b.cap.position.y = 0.04 - 0.035 * Math.sin(Math.min(1, b.press) * Math.PI);
    b.lbl.position.y = b.cap.position.y + 0.156;
  });
  // Belly-Glass bei Bedarf neu zeichnen (Risikoleiter blinkt)
  const key = rt.gamble ? `g${rt.gamble.amount}|${rt.gamble.step}|${rt.gamble.busy}|${Math.floor(t / 250) % 2}` : `i${fmt(S.jackpot)}|${S.level}`;
  if (world.belly && key !== world.belly.key){ world.belly.key = key; drawBelly(t); }
}
function drawBelly(t){
  const c = world.belly.canvas, x = c.getContext('2d'), W = c.width, H = c.height;
  const g = x.createLinearGradient(0, 0, 0, H); const bg2 = CAB_STYLES[S.cabinet].belly; g.addColorStop(0, bg2[0]); g.addColorStop(0.6, bg2[1]); g.addColorStop(1, bg2[2]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#ffc83a66'; x.lineWidth = 3; roundRect(x, 10, 10, W - 20, H - 20, 18); x.stroke();
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if (rt.gamble){
    // Risikoleiter wie bei Spielhallengeräten: Stufen mit Werten, aktuelle Stufe leuchtet, nächste blinkt
    const base = rt.gamble.amount > 0 ? rt.gamble.amount / Math.pow(2, rt.gamble.step) : 0;
    const n = GAMBLE_MAX_STEPS + 1, bw = (W - 220) / n, blink = Math.floor(t / 250) % 2;
    x.font = '400 34px Bungee, Impact, sans-serif'; x.fillStyle = '#ff3d9a'; x.fillText('RISIKO', 100, H / 2);
    for (let k = 0; k < n; k++){
      const bx = 200 + k * bw + 8, by = 40, w = bw - 16, h = H - 80, val = base * Math.pow(2, k);
      const lost = rt.gamble.amount === 0;
      const cur = !lost && k === rt.gamble.step, next = !lost && k === rt.gamble.step + 1, past = !lost && k < rt.gamble.step;
      let fill = '#1c0f30', txt = '#6d5a94';
      if (lost){ fill = '#4a0d18'; txt = '#ff7070'; }
      else if (cur){ fill = '#ffc83a'; txt = '#2a1400'; }
      else if (next){ fill = blink ? '#ff3d9a' : '#3a1030'; txt = '#fff'; }
      else if (past){ fill = '#5a4210'; txt = '#ffe9a0'; }
      x.fillStyle = fill; roundRect(x, bx, by, w, h, 14); x.fill();
      if (cur){ x.shadowColor = '#ffc83a'; x.shadowBlur = 24; x.fill(); x.shadowBlur = 0; }
      x.fillStyle = txt; x.font = `800 ${val >= 1000 ? 30 : 36}px Orbitron, ui-monospace, monospace`; x.fillText(fmt(val), bx + w / 2, by + h / 2);
    }
  } else {
    // Artwork: drei Felder mit den Sonderregeln
    const cells = [[DIAMOND, 'JACKPOT', '5× Diamant · ' + fmt(S.jackpot)], [CLOVER, 'GLÜCKSRAD', '4× Klee irgendwo'], [SCATTER, 'FREISPIELE', '3× Bonus irgendwo']];
    const cw = W / 3;
    cells.forEach(([sid, title, sub], k) => {
      const x0 = cw * k;
      if (k){ x.strokeStyle = '#ffc83a33'; x.lineWidth = 2; x.beginPath(); x.moveTo(x0, 28); x.lineTo(x0, H - 28); x.stroke(); }
      drawSymbolArt(x, sid, x0 + 74, H / 2, 96);
      x.textAlign = 'left';
      x.font = '400 34px Bungee, Impact, sans-serif'; x.fillStyle = '#ffc83a'; x.shadowColor = '#ff3d9a'; x.shadowBlur = 14;
      x.fillText(title, x0 + 136, H / 2 - 19); x.shadowBlur = 0;
      x.font = '600 23px "Chakra Petch", system-ui, sans-serif'; x.fillStyle = '#efe6ff';
      x.fillText(sub, x0 + 138, H / 2 + 24);
    });
    x.textAlign = 'center';
  }
  world.belly.tex.needsUpdate = true;
}
