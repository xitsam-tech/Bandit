/** Münzregen und Münzen in der Schale. */
import { rand } from '../core/rng.js';
import { clamp, now } from '../core/util.js';
import { REDUCED } from '../dom.js';
import { world } from './context.js';
import { TRAY } from './lower-cabinet.js';
import { updateCoinRun } from './coin-chute.js';

/* Mulde der Münzschale (aus TRAY): Münzmittelpunkt bleibt COIN_M innerhalb der Innenwand, Ecken gerundet */
const COIN_M = 0.19;
const bowl = () => { const T = TRAY; return { cx:(T.x0 + T.x1) / 2, cz:(T.z0 + T.z1) / 2, hw:(T.x1 - T.x0) / 2 - COIN_M, hd:(T.z1 - T.z0) / 2 - COIN_M, r:Math.max(0.03, T.r - COIN_M) }; };
function inBowl(p){ const T = TRAY; return p.x > T.x0 - 0.05 && p.x < T.x1 + 0.05 && p.z > T.z0 - 0.05 && p.z < T.z1 + 0.05; }
function rimY(z){ const T = TRAY, u = clamp((z - T.z0) / (T.z1 - T.z0), 0, 1), s = u * u * (3 - 2 * u); return T.back + (T.top - T.back) * Math.min(1, s * 1.6); }
function clampBowl(p, v){
  const b = bowl(), dx = p.x - b.cx, dz = p.z - b.cz, sx = Math.sign(dx) || 1, sz = Math.sign(dz) || 1;
  const qx = Math.abs(dx) - (b.hw - b.r), qz = Math.abs(dz) - (b.hd - b.r);
  if (qx > 0 && qz > 0){
    const d = Math.hypot(qx, qz);
    if (d > b.r){
      const nx = qx / d * sx, nz = qz / d * sz;
      p.x = b.cx + sx * (b.hw - b.r) + nx * b.r; p.z = b.cz + sz * (b.hd - b.r) + nz * b.r;
      const vn = v.x * nx + v.z * nz; if (vn > 0){ v.x -= 1.4 * vn * nx; v.z -= 1.4 * vn * nz; }
    }
    return;
  }
  if (Math.abs(dx) > b.hw){ p.x = b.cx + sx * b.hw; if (v.x * sx > 0) v.x *= -0.4; }
  if (Math.abs(dz) > b.hd){ p.z = b.cz + sz * b.hd; if (v.z * sz > 0) v.z *= -0.4; }
}
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
      // Mulde: Münzen prallen an den (gerundeten) Innenwänden ab und bleiben flach auf der Gummimatte liegen
      const T = TRAY, inside = inBowl(it.p);
      if (inside && it.p.y < rimY(it.p.z)) clampBowl(it.p, it.v);
      const restY = T.floor + T.mat + 0.018;
      if (inside && it.p.y <= restY && it.v.y < 0){
        it.rest = true; world.coins.pile++;
        it.p.y = restY + Math.min(0.25, world.coins.pile * 0.004) * rand();
        it.r.set((rand() - 0.5) * 0.12, rand() * 6, (rand() - 0.5) * 0.12);
      }
    }
    if (!it.rest && (it.p.y < -6 || it.life > 6)){ it.alive = false; d.scale.set(0, 0, 0); }
    else { d.scale.set(1, 1, 1); }
    d.position.copy(it.p); d.rotation.copy(it.r); d.updateMatrix(); world.coins.mesh.setMatrixAt(i, d.matrix);
  });
  if (any || t < world.coins.emitUntil + 100) world.coins.mesh.instanceMatrix.needsUpdate = true;
  updateCoinRun(t);
}
