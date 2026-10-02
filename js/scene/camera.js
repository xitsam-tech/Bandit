/** Kamera-Orbit, Ansichtsvoreinstellungen, Zeigerparallaxe und Größenanpassung. */
import { rt } from '../core/runtime.js';
import { S } from '../core/state.js';
import { now } from '../core/util.js';
import { fx, fxCanvas, stage } from '../dom.js';
import { VIEW } from './constants.js';
import { world } from './context.js';

/* ----- Kamera-Orbit: Automat frei drehen und zoomen ----- */
const VIEW_PRESETS = { '3d':{ yaw:0.36, pitch:0.1 }, front:{ yaw:0, pitch:0.04 }, turn:{ yaw:0.36, pitch:0.12 } };
export const orbit = { yaw:0.36, pitch:0.1, zoom:1, drag:null, pinch:null, pointers:new Map(), lastInput:0 };
export function resetView(){ const v = VIEW_PRESETS[S.view] || VIEW_PRESETS['3d']; orbit.yaw = v.yaw; orbit.pitch = v.pitch; orbit.zoom = 1; orbit.lastInput = now(); }

/* =========================================================
   Zeiger-Parallaxe & Größe
   ========================================================= */
export const pointer = { x:0, y:0, tx:0, ty:0 };
export function resize(){
  const w = stage.clientWidth, h = stage.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
  fxCanvas.width = Math.round(w * dpr); fxCanvas.height = Math.round(h * dpr); fxCanvas._w = w; fxCanvas._h = h;
  fx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!rt.glOK) return;
  world.renderer.setSize(w, h, false);
  world.camera.aspect = w / h;
  const vf = THREE.MathUtils.degToRad(world.camera.fov), tv = Math.tan(vf / 2);
  world.camera.userData.dist = Math.max((VIEW.h / 2) / tv, (VIEW.w / 2) / (tv * world.camera.aspect));
  world.camera.updateProjectionMatrix();
  if (world.composer) world.composer.setSize(w, h);
}
