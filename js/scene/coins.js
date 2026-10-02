/** Münzregen und Münzen in der Schale. */
import { rand } from '../core/rng.js';
import { clamp, now } from '../core/util.js';
import { REDUCED } from '../dom.js';
import { world } from './context.js';
import { TRAY } from './lower-cabinet.js';
import { updateCoinRun } from './mechanics.js';

export function buildCoins(){
  const n = REDUCED ? 30 : 140;
  const geo = new THREE.CylinderGeometry(0.15, 0.15, 0.035, 24);
  const mat = new THREE.MeshStandardMaterial({ color:0xffc451, metalness:1, roughness:0.22, envMapIntensity:1.6, emissive:0x3a2200 });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const items = Array.from({ length:n }, () => ({ alive:false, p:new THREE.Vector3(), v:new THREE.Vector3(), r:new THREE.Euler(), w:new THREE.Vector3(), life:0 }));
  const d = new THREE.Object3D(); d.scale.set(0, 0, 0); d.updateMatrix();
  for (let i = 0; i < n; i++) mesh.setMatrixAt(i, d.matrix);
  mesh.frustumCulled = false;
  world.scene.add(mesh);
  world.coins = { mesh, items, d, emitUntil:0, rate:0, acc:0, pile:0 };
}
// Neuer Dreh: die Münzen in der Schale gelten als genommen
export function clearTray(){
  if (!world.coins) return;
  world.coins.items.forEach((it, i) => { if (it.rest){ it.alive = false; it.rest = false; world.coins.d.scale.set(0, 0, 0); world.coins.d.updateMatrix(); world.coins.mesh.setMatrixAt(i, world.coins.d.matrix); } });
  world.coins.pile = 0; world.coins.mesh.instanceMatrix.needsUpdate = true;
}
export function burstCoins(ms, rate){ if (!world.coins) return; world.coins.emitUntil = now() + ms; world.coins.rate = REDUCED ? rate * 0.25 : rate; }
function spawnCoin(){
  const it = world.coins.items.find(x => !x.alive); if (!it) return;
  it.alive = true; it.life = 0; it.rest = false;
  // Münzen kommen aus der Auswurföffnung; bei großen Gewinnen spritzen sie höher
  const big = world.coins.rate > 35;
  it.p.set((rand() - 0.5) * 1.1, -5.0, 0.45);
  it.v.set((rand() - 0.5) * (big ? 3 : 1.6), (big ? 2.5 : 0.6) + rand() * (big ? 3 : 1.4), 0.9 + rand() * 1.4);
  it.r.set(rand() * 6, rand() * 6, rand() * 6);
  it.w.set((rand() - 0.5) * 16, (rand() - 0.5) * 16, (rand() - 0.5) * 16);
}
export function updateCoins(dt, t){
  if (!world.coins) return;
  if (t < world.coins.emitUntil){ world.coins.acc += world.coins.rate * dt; while (world.coins.acc >= 1){ spawnCoin(); world.coins.acc--; } }
  const d = world.coins.d; let any = false;
  world.coins.items.forEach((it, i) => {
    if (!it.alive) return; any = true;
    if (!it.rest){
      it.life += dt; it.v.y -= 11 * dt; it.p.addScaledVector(it.v, dt);
      it.r.x += it.w.x * dt; it.r.y += it.w.y * dt; it.r.z += it.w.z * dt;
      const T = TRAY, inX = it.p.x > T.x0 + 0.12 && it.p.x < T.x1 - 0.12, inZ = it.p.z > T.z0 && it.p.z < T.z1 - 0.1;
      // Wände der Schale: Münzen prallen innen ab
      if (it.p.y < T.floor + 0.2){
        if (it.p.x < T.x0 + 0.12 || it.p.x > T.x1 - 0.12){ it.v.x *= -0.4; it.p.x = clamp(it.p.x, T.x0 + 0.12, T.x1 - 0.12); }
        if (it.p.z > T.z1 - 0.1){ it.v.z *= -0.4; it.p.z = T.z1 - 0.1; }
      }
      // Liegenbleiben: flach auf dem Boden der Schale (leicht gestapelt)
      if (it.p.y <= T.floor + 0.02 && it.v.y < 0 && inX && inZ){
        it.rest = true; world.coins.pile++;
        it.p.y = T.floor + 0.02 + Math.min(0.25, world.coins.pile * 0.004) * rand();
        it.r.set((rand() - 0.5) * 0.25, rand() * 6, (rand() - 0.5) * 0.25);
      }
    }
    if (!it.rest && (it.p.y < -6 || it.life > 6)){ it.alive = false; d.scale.set(0, 0, 0); }
    else { d.scale.set(1, 1, 1); }
    d.position.copy(it.p); d.rotation.copy(it.r); d.updateMatrix(); world.coins.mesh.setMatrixAt(i, d.matrix);
  });
  if (any || t < world.coins.emitUntil + 100) world.coins.mesh.instanceMatrix.needsUpdate = true;
  updateCoinRun(t);
}
