/** Klebe-Joker und Halte-Rahmen in den Freispielen. */
import { COLS, JOKER, ROWS } from '../core/config.js';
import { heldReels } from '../core/lines.js';
import { rt } from '../core/runtime.js';
import { S } from '../core/state.js';
import { roundRect } from '../gfx/canvas2d.js';
import { SYM } from '../gfx/symbols.js';
import { CELL_H, CELL_W, reelX, rowAngle } from './constants.js';
import { holdFrames, stickyMeshes, winFrames, world } from './context.js';
import { canvasTex } from './helpers.js';
import { cellWorld } from './reels.js';

/* ----- Klebe-Joker (Freispiele) ----- */
export function buildSticky(){
  const frameTex = winFrames[0].material.map;
  for (let i = 0; i < ROWS * COLS; i++){
    const r = Math.floor(i / COLS), c = i % COLS, g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ map:SYM[JOKER].tex, emissive:0xffffff, emissiveMap:SYM[JOKER].tex, emissiveIntensity:0.35, roughness:0.5 });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(CELL_W, CELL_H), mat); g.add(p);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(CELL_W * 1.08, CELL_H * 1.12),
      new THREE.MeshBasicMaterial({ map:frameTex, color:0xb07cff, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
    f.position.z = 0.012; g.add(f);
    g.position.copy(cellWorld(c, r, 0.13)); g.rotation.x = -rowAngle(r); g.visible = false;
    world.scene.add(g); stickyMeshes.push({ g, mat, f, pop:0 });
  }
  // Rahmen + Schild „HALT“ um eine gehaltene Walze
  const hc = document.createElement('canvas'); hc.width = 256; hc.height = 880; const hx = hc.getContext('2d');
  hx.shadowColor = '#c08cff'; hx.shadowBlur = 26; hx.lineWidth = 12; hx.strokeStyle = '#d9b8ff';
  roundRect(hx, 18, 18, 220, 844, 26); hx.stroke(); hx.stroke();
  hx.shadowBlur = 0; roundRect(hx, 58, 4, 140, 46, 14); hx.fillStyle = '#7a3cff'; hx.fill();
  hx.font = '400 30px Bungee, Impact, sans-serif'; hx.fillStyle = '#fff'; hx.textAlign = 'center'; hx.textBaseline = 'middle'; hx.fillText('HALT', 128, 29);
  const htex = canvasTex(hc);
  for (let c = 0; c < COLS; c++){
    const f = new THREE.Mesh(new THREE.PlaneGeometry(CELL_W * 1.1, 3.22),
      new THREE.MeshBasicMaterial({ map:htex, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
    f.position.set(reelX(c), 0, 0.22); f.visible = false; f.userData.pop = 0; world.scene.add(f); holdFrames.push(f);
  }
}
export function updateSticky(fresh = []){
  stickyMeshes.forEach((o, i) => { o.g.visible = S.sticky.includes(i); if (fresh.includes(i)) o.pop = 1; });
  const h = S.freeSpins > 0 || (rt.spinCtx && rt.spinCtx.free) ? heldReels(S.sticky) : [];
  holdFrames.forEach((f, c) => { const on = !!h[c]; if (on && !f.visible) f.userData.pop = 1; f.visible = on; });
}
export function animateSticky(t, dt){
  holdFrames.forEach((f, c) => {
    if (!f.visible) return;
    f.userData.pop = Math.max(0, f.userData.pop - dt * 2);
    f.material.opacity = 0.6 + 0.3 * Math.sin(t / 260 + c) + f.userData.pop * 0.4;
  });
  stickyMeshes.forEach((o, i) => {
    if (!o.g.visible) return;
    o.pop = Math.max(0, o.pop - dt * 2.5);
    const s = 1 + 0.35 * o.pop * o.pop; o.g.scale.set(s, s, 1);
    o.f.material.opacity = 0.55 + 0.35 * Math.sin(t / 180 + i);
    o.mat.emissiveIntensity = rt.present && rt.present.cells.has(i) ? 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t / 110)) : 0.35;
  });
}
