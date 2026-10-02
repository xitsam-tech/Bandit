/** Scheinwerfer (Sweeps). */
import { world } from './context.js';

/* ----- Scheinwerfer ----- */
export function buildSweeps(){
  world.sweeps = [0xff3d9a, 0x35e2ff].map((col, i) => {
    const l = new THREE.SpotLight(col, 0, 40, 0.3, 0.55, 1);
    l.position.set(i ? 7 : -7, 9, 7); world.scene.add(l, l.target); return l;
  });
}
