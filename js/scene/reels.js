/** Walzen: gebogene Kacheln, Shader-Bewegungsunschärfe, Symbol-Slots, sichtbare Matrix, Gewinnrahmen. */
import { COLS, ROWS } from '../core/config.js';
import { sampleSymbol } from '../core/rng.js';
import { mod } from '../core/util.js';
import { roundRect } from '../gfx/canvas2d.js';
import { SYM } from '../gfx/symbols.js';
import { BASE_EMISSIVE, CELL_H, CELL_W, N, R, REEL_GAP, STEP, reelX, rowAngle } from './constants.js';
import { reels, winFrames, world } from './context.js';
import { canvasTex } from './helpers.js';

function bentTileGeometry(){
  // Kachel als echtes Zylindersegment: nahtlos, gleichmäßig gekrümmt
  const g = new THREE.PlaneGeometry(CELL_W, STEP * R, 1, 12), p = g.attributes.position;
  for (let i = 0; i < p.count; i++){ const phi = p.getY(i) / R; p.setY(i, R * Math.sin(phi)); p.setZ(i, R * Math.cos(phi)); }
  g.computeVertexNormals();
  return g;
}
// Bewegungsunschärfe im Shader: 9 Abtastungen entlang der Laufrichtung, Stärke = Walzengeschwindigkeit
function reelBlurPatch(sh){
  sh.uniforms.uBlur = this.userData.blurU;
  const tap = (tex) => `vec4 acc = vec4(0.0);
    for (int i = 0; i < 9; i++){ float o = (float(i) - 4.0) * 0.125 * uBlur; acc += texture2D(${tex}, vec2(vUv.x, clamp(vUv.y + o, 0.006, 0.994))); }
    acc /= 9.0;`;
  sh.fragmentShader = 'uniform float uBlur;\n' + sh.fragmentShader
    .replace('#include <map_fragment>', `#ifdef USE_MAP
  {
    ${tap('map')}
    diffuseColor *= mapTexelToLinear(acc);
  }
  #endif`)
    .replace('#include <emissivemap_fragment>', `#ifdef USE_EMISSIVEMAP
  {
    ${tap('emissiveMap')}
    totalEmissiveRadiance *= emissiveMapTexelToLinear(acc).rgb;
  }
  #endif`);
}

export function buildReels(){
  const rimMat = new THREE.MeshStandardMaterial({ color:0xf0d9a0, metalness:1, roughness:0.2, envMapIntensity:1.3 });
  const coreMat = new THREE.MeshStandardMaterial({ color:0x0d0817, roughness:0.8 });
  const tile = bentTileGeometry();
  for (let c = 0; c < COLS; c++){
    const group = new THREE.Group();
    group.position.set(reelX(c), 0, -R);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.06, R - 0.06, CELL_W - 0.02, 32, 1, true), coreMat);
    core.rotation.z = Math.PI / 2; group.add(core);
    [-1, 1].forEach(sd => { const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.01, 0.026, 10, 96), rimMat); rim.rotation.y = Math.PI / 2; rim.position.x = sd * CELL_W / 2; group.add(rim); });
    const blurU = { value:0 }, slots = [];
    for (let k = 0; k < N; k++){
      const mat = new THREE.MeshStandardMaterial({ color:0xe0e0e0, roughness:0.92, metalness:0, emissive:0xffffff, emissiveIntensity:BASE_EMISSIVE, envMapIntensity:0.04 });
      mat.userData.blurU = blurU; mat.onBeforeCompile = reelBlurPatch;
      const mesh = new THREE.Mesh(tile, mat);
      mesh.rotation.x = -(k + 0.5) * STEP;
      group.add(mesh);
      slots.push({ mesh, mat, sid:0 });
    }
    world.scene.add(group);
    reels.push({ group, slots, blurU, s:0, v:0, phase:'idle', t0:0, s0:0, stopAt:0, tense:false, flash:0, bounce:0 });
  }
  // Chrom-Trennstege zwischen den Walzen
  const divMat = new THREE.MeshStandardMaterial({ color:0xe8e4f4, metalness:1, roughness:0.18, envMapIntensity:1.4 });
  for (let c = 0; c < COLS - 1; c++){
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.07, 3.5, 0.1), divMat);
    d.position.set(reelX(c) + REEL_GAP / 2, 0, 0.1); world.scene.add(d);
  }
}
export function applySlot(slot){
  const map = SYM[slot.sid].tex;
  if (slot.mat.map !== map){ const fresh = !slot.mat.map; slot.mat.map = map; slot.mat.emissiveMap = map; if (fresh) slot.mat.needsUpdate = true; }
}
export function setSlot(reel, k, sid){ const sl = reel.slots[mod(k, N)]; sl.sid = sid; applySlot(sl); }
export function slotFor(c, r){ const reel = reels[c]; return reel.slots[mod(Math.round(reel.s) + 1 - r, N)]; }
export function readVisibleMatrix(){
  return Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => slotFor(c, r).sid));
}
export function showMatrixOnReels(m){
  reels.forEach((reel, c) => {
    reel.slots.forEach(sl => { sl.sid = sampleSymbol(); applySlot(sl); });
    for (let r = 0; r < ROWS; r++) setSlot(reel, Math.round(reel.s) + 1 - r, m[r][c]);
  });
}
export function cellWorld(c, r, lift = 0){
  const a = rowAngle(r), rr = R + lift;
  return new THREE.Vector3(reelX(c), rr * Math.sin(a), -R + rr * Math.cos(a));
}

export function buildWinFrames(){
  const c = document.createElement('canvas'); c.width = 256; c.height = 208; const x = c.getContext('2d');
  x.shadowColor = '#ffd25a'; x.shadowBlur = 22; x.lineWidth = 10; x.strokeStyle = '#ffe9a0';
  roundRect(x, 16, 16, 224, 176, 22); x.stroke(); x.stroke();
  const tex = canvasTex(c);
  for (let i = 0; i < ROWS * COLS; i++){
    const m = new THREE.Mesh(new THREE.PlaneGeometry(CELL_W * 1.08, CELL_H * 1.12),
      new THREE.MeshBasicMaterial({ map:tex, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
    m.visible = false; world.scene.add(m); winFrames.push(m);
  }
}
