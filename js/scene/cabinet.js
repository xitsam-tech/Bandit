/** Oberes Gehäuse: Korpus, Fensterrahmen, Laufschrift, LCDs, Aufsatz mit Schild, Lauflicht-Neon. */
import { S } from '../core/state.js';
import { LCD, drawLCD } from '../gfx/lcd.js';
import { Ticker } from '../gfx/ticker.js';
import { CAB_DEPTH, FRONT_Z, R } from './constants.js';
import { world } from './context.js';
import { archShape, canvasTex, frameMesh, neonTube, rrShape } from './helpers.js';
import { buildLowerCabinet } from './lower-cabinet.js';
import { mech } from './mechanics.js';
import { CAB_STYLES, drawChase } from './styles.js';

export function buildCabinet(){
  const lacquer = new THREE.MeshPhysicalMaterial({ color:0x0e0418, roughness:0.45, metalness:0.3, clearcoat:0.85, clearcoatRoughness:0.1, envMapIntensity:0.55 });
  world.lacquerMat = lacquer;
  const chrome = new THREE.MeshStandardMaterial({ color:0xe8e4f4, roughness:0.16, metalness:1.0, envMapIntensity:1.4 });
  const gold = new THREE.MeshStandardMaterial({ color:0xffc451, roughness:0.25, metalness:1.0, envMapIntensity:1.2 });
  const dark = new THREE.MeshStandardMaterial({ color:0x07040c, roughness:0.9, metalness:0 });

  // Korpus mit Walzenfenster als Durchbruch
  const bodyShape = rrShape(8.1, 6.4, 0.45, 0, 0.1);
  bodyShape.holes.push(rrShape(5.9, 3.5, 0.18, 0, 0, THREE.Path));
  // Tiefe aus dem Walzenradius: Walzen (Durchmesser 2R) passen mit Front und Wandstärke hinein
  const depth = CAB_DEPTH;
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(bodyShape, { depth, bevelEnabled:true, bevelThickness:0.08, bevelSize:0.08, bevelSegments:4, curveSegments:14 }), lacquer);
  body.position.z = FRONT_Z - depth; world.scene.add(body);
  // Rückdeckel: das Walzenfenster ist ein Durchbruch durchs Gehäuse – hinten verschließen (gleiches Material, bei Glas durchsichtig)
  const backCap = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 3.6), lacquer); backCap.rotation.y = Math.PI; backCap.position.z = FRONT_Z - depth - 0.04; world.scene.add(backCap);

  const back = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.8), dark); back.position.z = -R - 0.5;   // dunkle Blende hinter der Walzenachse world.scene.add(back); mech.backPlate = back;

  // Chromrahmen ums Fenster
  const bezel = frameMesh(6.35, 3.95, 5.9, 3.5, 0.32, 0.1, chrome); bezel.position.z = 0.33; world.scene.add(bezel);

  // Innenschatten oben/unten (Tiefe im Fenster)
  const shc = document.createElement('canvas'); shc.width = 4; shc.height = 128; const sx = shc.getContext('2d');
  const sg = sx.createLinearGradient(0, 0, 0, 128); sg.addColorStop(0, '#000000f0'); sg.addColorStop(0.55, '#00000055'); sg.addColorStop(1, '#00000000');
  sx.fillStyle = sg; sx.fillRect(0, 0, 4, 128);
  const shTex = new THREE.CanvasTexture(shc);
  const shMat = new THREE.MeshBasicMaterial({ map:shTex, transparent:true, depthWrite:false });
  const shTop = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 1.0), shMat); shTop.position.set(0, 1.25, 0.2); world.scene.add(shTop);
  const shBot = shTop.clone(); shBot.rotation.z = Math.PI; shBot.position.y = -1.25; world.scene.add(shBot);

  // LED-Laufschrift
  const tTex = canvasTex(Ticker.canvas); Ticker.bindTexture(tTex);
  const ticker = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 5.7 * Ticker.canvas.height / Ticker.canvas.width), new THREE.MeshBasicMaterial({ map:tTex, toneMapped:false }));
  ticker.position.set(0, 2.6, 0.4); world.scene.add(ticker);
  const tH = 5.7 * Ticker.canvas.height / Ticker.canvas.width;
  const tFrame = frameMesh(5.94, tH + 0.24, 5.72, tH + 0.02, 0.12, 0.08, chrome); tFrame.position.set(0, 2.6, 0.34); world.scene.add(tFrame);

  // LCD-Anzeigen unten
  [['lines', -2.3, 1.42], ['win', 0, 2.52], ['bet', 2.3, 1.42]].forEach(([k, x, w]) => {
    const o = LCD[k]; o.tex = canvasTex(o.canvas); drawLCD(o);
    const h = w * o.canvas.height / o.canvas.width;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map:o.tex, toneMapped:false }));
    m.position.set(x, -2.56, 0.4); world.scene.add(m);
    const f = frameMesh(w + 0.16, h + 0.16, w, h, 0.08, 0.06, chrome); f.position.set(x, -2.56, 0.34); world.scene.add(f);
  });

  // Aufsatz mit Schriftzug
  const signGeo = new THREE.ExtrudeGeometry(archShape(7.0, 1.4, 0.95), { depth:2.2, bevelEnabled:true, bevelThickness:0.06, bevelSize:0.06, bevelSegments:4, curveSegments:24 });
  const signBody = new THREE.Mesh(signGeo, lacquer);
  signBody.position.set(0, 4.05, 0.15 - 2.2); world.scene.add(signBody);
  // Schild: Canvas exakt auf die Bogenform zugeschnitten, Text automatisch eingepasst
  const SG = { w:6.8, top:0.93, bottom:-0.62, px:200 };
  const sc = document.createElement('canvas'); sc.width = SG.w * SG.px; sc.height = Math.round((SG.top - SG.bottom) * SG.px);
  const signTex = canvasTex(sc);
  const signShape = archShape(6.66, 1.14, 0.84);
  const drawSign = () => {
    const x = sc.getContext('2d'), W = sc.width, H = sc.height;
    const toPx = v => [(v.x + SG.w / 2) * SG.px, (SG.top - v.y) * SG.px];
    x.clearRect(0, 0, W, H);
    x.save();
    x.beginPath(); signShape.getPoints(64).forEach((v, k) => { const [px, py] = toPx(v); k ? x.lineTo(px, py) : x.moveTo(px, py); }); x.closePath();
    x.clip();
    const g = x.createLinearGradient(0, 0, 0, H); const sg2 = CAB_STYLES[S.cabinet].sign; g.addColorStop(0, sg2[0]); g.addColorStop(0.55, sg2[1]); g.addColorStop(1, sg2[2]);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // Strahlen aus der Bogenmitte
    x.globalAlpha = 0.18; x.fillStyle = CAB_STYLES[S.cabinet].rays;
    for (let k = 0; k < 18; k++){
      const a = Math.PI + (k + 0.5) * Math.PI / 18;
      x.beginPath(); x.moveTo(W / 2, H * 0.95); x.arc(W / 2, H * 0.95, W, a - 0.03, a + 0.03); x.closePath(); x.fill();
    }
    x.globalAlpha = 1;
    // Sterne in der Bogenspitze
    const star = (cx, cy, r) => {
      x.beginPath();
      for (let k = 0; k < 10; k++){ const rr = k % 2 ? r * 0.45 : r, a = -Math.PI / 2 + k * Math.PI / 5; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      x.closePath(); x.fill();
    };
    x.fillStyle = '#ffd25a'; x.shadowColor = '#ffc83a'; x.shadowBlur = 16;
    star(W / 2, H * 0.17, 30); star(W / 2 - 110, H * 0.24, 18); star(W / 2 + 110, H * 0.24, 18);
    x.shadowBlur = 0;
    // Schriftzug: Breite auf 84 % begrenzt, Höhe auf den rechteckigen Teil
    const text = 'EINARMIGER BANDIT', maxW = W * 0.84, cy = (SG.top - (-0.04)) * SG.px;
    x.font = '400 100px Bungee, Impact, sans-serif';
    const size = Math.min(124, 100 * maxW / x.measureText(text).width);
    x.font = `400 ${size}px Bungee, Impact, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.lineWidth = size * 0.14; x.strokeStyle = '#5a0c3a'; x.strokeText(text, W / 2, cy);
    const tg = x.createLinearGradient(0, cy - size / 2, 0, cy + size / 2); tg.addColorStop(0, '#fff6c4'); tg.addColorStop(0.5, '#ffc83a'); tg.addColorStop(1, '#e0870c');
    x.shadowColor = '#ff3d9a'; x.shadowBlur = 22; x.fillStyle = tg; x.fillText(text, W / 2, cy);
    x.restore();
    signTex.needsUpdate = true;
  };
  drawSign(); document.fonts && document.fonts.ready.then(drawSign); world.redrawSign = drawSign;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(SG.w, SG.top - SG.bottom), new THREE.MeshBasicMaterial({ map:signTex, transparent:true, toneMapped:false }));
  sign.position.set(0, 4.05 + (SG.top + SG.bottom) / 2, 0.22); world.scene.add(sign);
  const tube = neonTube(0, 0, 0, 0.036, 0xff3d9a, archShape(6.78, 1.24, 0.86)); tube.position.set(0, 4.05, 0.24); world.scene.add(tube);
  // Lauflicht-Neon um den Korpus: Farbverlauf wandert entlang der Röhre
  world.chaseCanvas = document.createElement('canvas'); world.chaseCanvas.width = 256; world.chaseCanvas.height = 4;
  world.chaseTex = new THREE.CanvasTexture(world.chaseCanvas); world.chaseTex.encoding = THREE.sRGBEncoding; world.chaseTex.wrapS = THREE.RepeatWrapping; world.chaseTex.repeat.set(6, 1);
  drawChase(CAB_STYLES.neon.chase);
  const pts2 = rrShape(8.3, 6.6, 0.5, 0, 0.1).getSpacedPoints(200).map(p => new THREE.Vector3(p.x, p.y, 0)); pts2.pop();
  const tube2 = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts2, true), 400, 0.034, 8, true), new THREE.MeshBasicMaterial({ map:world.chaseTex, color:0xb0b0b0, toneMapped:false }));
  world.scene.add(tube2);

  // Sockel mit Goldleiste
  buildLowerCabinet(lacquer, chrome, gold, dark);
}
