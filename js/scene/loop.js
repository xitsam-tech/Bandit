/** Render-Schleife: Animationen, Kamera-Rig, Lichter und Zeichnen pro Frame. */
import { rt } from '../core/runtime.js';
import { S } from '../core/state.js';
import { clamp, mod, now } from '../core/util.js';
import { REDUCED } from '../dom.js';
import { updatePresentation } from '../game/presentation.js';
import { Ticker } from '../gfx/ticker.js';
import { orbit, pointer } from './camera.js';
import { updateCard } from './card.js';
import { updateCoins } from './coins.js';
import { VIEW } from './constants.js';
import { lamps, world } from './context.js';
import { updateLever } from './lever.js';
import { updateDeck } from './lower-cabinet.js';
import { animateMech } from './mechanics.js';
import { updateFlashes, updateReels } from './reel-motion.js';
import { animateSticky } from './sticky.js';
import { CAB_STYLES } from './styles.js';
import { updateWheel } from './wheel.js';
import { drawOverlay } from '../ui/overlay.js';

let lastT = now(), bulbColor = window.THREE ? new THREE.Color() : null, _bulbTmp = window.THREE ? new THREE.Color() : null;
const camTarget = window.THREE ? { pos:new THREE.Vector3(), look:new THREE.Vector3() } : null;
const camState = window.THREE ? { pos:new THREE.Vector3(), look:new THREE.Vector3(), init:false, sph:null } : null;
const _camPivot = window.THREE ? new THREE.Vector3() : null, _tSph = {};
export function loop(){
  requestAnimationFrame(loop);
  const t = now(), dt = Math.min(0.05, (t - lastT) / 1000); lastT = t;
  Ticker.update(t);
  if (!rt.glOK){ drawOverlay(); return; }
  updateReels(t);
  updatePresentation(t);
  updateLever(dt);
  updateCoins(dt, t);

  updateWheel(t, dt);
  updateCard(t, dt);
  animateSticky(t, dt);
  const dimTarget = Math.max(world.wheel ? world.wheel.show * 0.62 : 0, world.card ? world.card.show * 0.45 : 0);
  if (world.dimPlane){ world.dimPlane.material.opacity = dimTarget; world.dimPlane.visible = dimTarget > 0.01; }

  // Kamera-Rig: Parallaxe im Leerlauf, Fahrt zum Glücksrad / zur Karte, Orbit beim großen Gewinn
  const sway = REDUCED ? 0 : 1;
  pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
  pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);
  const dist = world.camera.userData.dist || 16, tt0 = t / 1000;
  const wheelOn = world.wheel && (world.wheel.state === 'in' || world.wheel.state === 'spin' || world.wheel.state === 'result');
  const celebrating = rt.bannerState && rt.bannerState.celebrate;
  if (wheelOn){ camTarget.pos.set(0, 0.7, Math.max(dist * 0.62, 7.5)); camTarget.look.set(0, 0.45, 1.3); }
  else if (rt.gamble){ camTarget.pos.set(0.35 * sway + pointer.x * 0.4 * sway, 0.6, dist * 0.74); camTarget.look.set(0, 0.25, 1.2); }
  else if (celebrating && !REDUCED){
    const ang = orbit.yaw + Math.sin(tt0 * 0.55) * 0.3, r = (dist + 1.2) * 0.93;
    camTarget.pos.set(VIEW.cx + Math.sin(ang) * r, VIEW.cy + 0.9, -1.2 + Math.cos(ang) * r); camTarget.look.set(VIEW.cx, VIEW.cy - 0.1, -1.2);
  } else {
    // Vitrinen-Modus: nach 30 s ohne Eingabe schwenkt die Kamera langsam um den Automaten
    const idle = !REDUCED && !rt.spinning && !rt.busy && !rt.gamble && t - orbit.lastInput > 30000;
    const swing = idle ? Math.sin((t - orbit.lastInput - 30000) / 1000 * 0.18) * 0.45 : 0;
    // Drehteller: Automat rotiert langsam um die eigene Achse (Ziehen übersteuert)
    if (S.view === 'turn' && !orbit.drag && !REDUCED) orbit.yaw += dt * 0.35;
    const yaw = orbit.yaw + swing + pointer.x * 0.05 * sway, pitch = orbit.pitch - pointer.y * 0.03 * sway;
    // Drehpunkt = Gehäusemitte (in der Tiefe); Abstand wächst seitlich, weil dann Gehäusetiefe und Hebel ins Bild müssen
    const PZ = -2.0, r = (dist + 2.0) * orbit.zoom * (1 + Math.abs(Math.sin(yaw)) * 0.28);
    camTarget.look.set(VIEW.cx, VIEW.cy - 0.05, PZ);
    camTarget.pos.set(VIEW.cx + Math.sin(yaw) * Math.cos(pitch) * r, VIEW.cy - 0.05 + Math.sin(pitch) * r, PZ + Math.cos(yaw) * Math.cos(pitch) * r);
  }
  if (!camState.init){ camState.look.copy(camTarget.look); camState.init = true; }
  const k = Math.min(1, dt * (REDUCED || orbit.drag || orbit.pinch ? 10 : 2.4));
  // Kamera fährt auf einer Kugelbahn um die Gehäusemitte statt auf gerader Linie (sonst durch das Gehäuse hindurch)
  const P = _camPivot.set(VIEW.cx, VIEW.cy - 0.05, -2.0);
  const toSph = (v, out) => { const dx = v.x - P.x, dy = v.y - P.y, dz = v.z - P.z, r = Math.hypot(dx, dy, dz);
    out.r = r; out.yaw = Math.atan2(dx, dz); out.pitch = Math.asin(clamp(dy / r, -1, 1)); return out; };
  const ts = toSph(camTarget.pos, _tSph);
  if (!camState.sph) camState.sph = { ...ts };
  const cs = camState.sph, dyaw = mod(ts.yaw - cs.yaw + Math.PI, Math.PI * 2) - Math.PI;
  cs.yaw += dyaw * k; cs.pitch += (ts.pitch - cs.pitch) * k; cs.r += (ts.r - cs.r) * k;
  camState.pos.set(P.x + Math.sin(cs.yaw) * Math.cos(cs.pitch) * cs.r, P.y + Math.sin(cs.pitch) * cs.r, P.z + Math.cos(cs.yaw) * Math.cos(cs.pitch) * cs.r);
  camState.look.lerp(camTarget.look, k);
  world.camera.position.copy(camState.pos);
  if (rt.shake > 0.001 && !REDUCED){ world.camera.position.x += (Math.random() - 0.5) * rt.shake; world.camera.position.y += (Math.random() - 0.5) * rt.shake; }
  rt.shake *= Math.pow(0.02, dt);
  world.camera.lookAt(camState.look);

  // Scheinwerfer
  world.sweeps.forEach((l, i) => {
    const want = celebrating || wheelOn ? 0.9 : rt.spinning ? 0.25 : 0.05;
    l.intensity += (want - l.intensity) * Math.min(1, dt * 3);
    l.target.position.set(Math.sin(tt0 * (i ? 1.1 : 0.8) + i * 2) * 3.4, 0.6 + Math.cos(tt0 * (i ? 0.9 : 1.3)) * 2.2, 0);
  });

  // Glühbirnen: Lauflicht im Leerlauf, schnell beim Drehen, Blinken beim Gewinn
  const n = world.bulbs.count, tt = t / 1000, bst = CAB_STYLES[S.cabinet], hcol = world.bulbHalo.geometry.attributes.color;
  for (let i = 0; i < n; i++){
    let target;
    const winning = rt.present && rt.present.res.wins.length;
    if (winning) target = ((i + Math.floor(tt * 12)) % 4) < 2 ? 1 : 0;
    else if (rt.spinning) target = ((i + Math.floor(tt * 20)) % 6) < 2 ? 1 : 0;
    else target = (i + Math.floor(tt * 2.2)) % 2 ? 1 : 0.08;
    // Glühfaden: weiches Auf- und Abglühen statt hartem Schalten
    world.bulbV[i] += (target - world.bulbV[i]) * Math.min(1, dt * (target > world.bulbV[i] ? 22 : 9));
    const v = world.bulbV[i];
    const hue = winning && i % 2 ? bst.bulbAlt : bst.bulb;
    bulbColor.setHex(0x2a1c0c).lerp(_bulbTmp.setHex(hue).multiplyScalar(1.05), v);
    world.bulbs.setColorAt(i, bulbColor);
    _bulbTmp.setHex(hue).multiplyScalar(v * 0.45);
    hcol.setXYZ(i, _bulbTmp.r, _bulbTmp.g, _bulbTmp.b);
  }
  world.bulbs.instanceColor.needsUpdate = true; hcol.needsUpdate = true;
  world.neonMats.forEach((n2, i) => { const f = 0.85 + 0.15 * Math.sin(tt * (i ? 1.7 : 2.3)) + (Math.random() < 0.004 ? -0.5 : 0); n2.mat.color.copy(n2.base).multiplyScalar(f * 0.95); });
  const lk = CAB_STYLES[S.cabinet].light;
  world.pinkLight.intensity = lk * (1.2 + 0.3 * Math.sin(tt * 1.3));
  world.cyanLight.intensity = lk * (1.0 + 0.3 * Math.cos(tt * 1.1));
  if (world.bokeh && !REDUCED) world.bokeh.rotation.z = Math.sin(tt * 0.05) * 0.03;
  lamps.rows.concat(lamps.pairs).forEach((l, i) => { const s = l.lit ? 1 + 0.04 * Math.sin(tt * 4 + i) : 1; l.g.scale.set(s, s, 1); });
  updateFlashes(t, dt);
  animateMech(dt);
  updateDeck(t, dt);
  if (world.chaseTex) world.chaseTex.offset.x = (world.chaseTex.offset.x - dt * (rt.spinning ? 1.2 : 0.25)) % 1;

  if (world.composer) world.composer.render(); else world.renderer.render(world.scene, world.camera);
  drawOverlay();
}
