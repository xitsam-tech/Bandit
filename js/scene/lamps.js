/** Leuchtknöpfe für Reihen und Paare links/rechts der Walzen. */
import { coveredRows } from '../core/lines.js';
import { rt } from '../core/runtime.js';
import { S } from '../core/state.js';
import { R, rowAngle } from './constants.js';
import { lamps, pickables, world } from './context.js';
import { circleTex } from './helpers.js';

export function buildLamps(){
  const ring = new THREE.MeshStandardMaterial({ color:0xe8e4f4, metalness:1, roughness:0.2 });
  const mk = (label, x, y, action, idx) => {
    const g = new THREE.Group(); g.position.set(x, y, 0.42);
    const off = circleTex(label, false), on = circleTex(label, true);
    const mat = new THREE.MeshBasicMaterial({ map:off, toneMapped:false });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.17, 40), mat); disc.position.z = 0.02; g.add(disc);
    const tor = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 10, 40), ring); g.add(tor);
    disc.userData = { action, idx }; pickables.push(disc);
    world.scene.add(g);
    return { g, mat, off, on, lit:false };
  };
  for (let r = 0; r < 4; r++) lamps.rows.push(mk(String(r + 1), -3.62, Math.sin(rowAngle(r)) * R, 'row', r));
  for (let i = 0; i < 3; i++) lamps.pairs.push(mk(`${i+1}-${i+2}`, 3.62, (Math.sin(rowAngle(i)) + Math.sin(rowAngle(i + 1))) * R / 2, 'pair', i));
}
export function updateLamps(){
  if (!rt.glOK) return;
  const cov = coveredRows(), fsLock = S.freeSpins > 0;
  const lines = fsLock && S.fsLines ? S.fsLines : null;
  lamps.rows.forEach((l, r) => {
    const lit = lines ? lines.some(L => L.pat.every(v => v === r)) : (S.singles[r] || cov[r]);
    l.lit = lit; l.mat.map = lit ? l.on : l.off;
  });
  lamps.pairs.forEach((l, i) => {
    const lit = lines ? lines.some(L => L.pat[0] !== L.pat[1] && Math.min(L.pat[0], L.pat[1]) === i) : S.pairs[i];
    l.lit = lit; l.mat.map = lit ? l.on : l.off;
  });
}
