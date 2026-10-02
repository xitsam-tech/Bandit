/** Eingabe auf der Bühne: Raycast auf Lampen/Tasten/Hebel, Hebel ziehen, Kamera-Orbit. */
import { Snd } from '../audio/sound.js';
import { rt } from '../core/runtime.js';
import { clamp, now } from '../core/util.js';
import { $, stage } from '../dom.js';
import { spin } from '../game/flow.js';
import { gambleCollect, gamblePick } from '../game/gamble.js';
import { orbit, pointer, resetView } from '../scene/camera.js';
import { pickables, world } from '../scene/context.js';
import { deck } from '../scene/lower-cabinet.js';
import { changeBet, togglePair, toggleRow } from './controls.js';

function deckAction(id){
  const b = deck.buttons.find(x => x.id === id); if (b) b.press = 1;
  Snd.ensure(); Snd.ui();
  if (id === 'auto') $('autoBtn').click();
  else if (id === 'down') changeBet(-1);
  else if (id === 'up') changeBet(1);
  else if (id === 'start') spin();
  else if (id === 'red') gamblePick(true);
  else if (id === 'black') gamblePick(false);
  else if (id === 'take') gambleCollect();
}

/* =========================================================
   Eingabe: Lampen & Hebel in 3D
   ========================================================= */
export const raycaster = window.THREE ? new THREE.Raycaster() : null;
export const ndc = window.THREE ? new THREE.Vector2() : null;
let pointerDown = null;
function pick(ev){
  const rect = stage.getBoundingClientRect();
  ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, world.camera);
  const hit = raycaster.intersectObjects(pickables, false)[0];
  return hit ? hit.object.userData : null;
}
function lampHover(ud){
  if (!ud){ rt.hoverBand = null; return; }
  if (ud.action === 'row') rt.hoverBand = [ud.idx];
  else if (ud.action === 'pair') rt.hoverBand = [ud.idx, ud.idx + 1];
  else rt.hoverBand = null;
}
export function bindStageInput(){
  const el = $('gl');
  resetView();
  el.addEventListener('wheel', ev => {
    ev.preventDefault();
    orbit.zoom = clamp(orbit.zoom * Math.exp(ev.deltaY * 0.0012), 0.55, 1.4); orbit.lastInput = now();
  }, { passive:false });
  el.addEventListener('dblclick', () => resetView());
  el.addEventListener('pointermove', ev => {
    pointer.tx = ((ev.clientX - stage.getBoundingClientRect().left) / stage.clientWidth) * 2 - 1;
    pointer.ty = ((ev.clientY - stage.getBoundingClientRect().top) / stage.clientHeight) * 2 - 1;
    if (orbit.pointers.has(ev.pointerId)) orbit.pointers.set(ev.pointerId, { x:ev.clientX, y:ev.clientY });
    if (orbit.pointers.size >= 2){
      const [a, b] = [...orbit.pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (orbit.pinch) orbit.zoom = clamp(orbit.pinch.zoom * orbit.pinch.d / Math.max(20, d), 0.55, 1.4); else orbit.pinch = { d, zoom:orbit.zoom };
      orbit.drag = null; orbit.lastInput = now(); return;
    }
    if (orbit.drag){
      orbit.yaw = orbit.drag.yaw - (ev.clientX - orbit.drag.x) * 0.006;   // volle 360°
      orbit.pitch = clamp(orbit.drag.pitch + (ev.clientY - orbit.drag.y) * 0.004, -0.12, 0.62);
      orbit.lastInput = now(); el.style.cursor = 'grabbing'; return;
    }
    if (world.lever.drag){
      const dy = ev.clientY - pointerDown.y;
      world.lever.target = clamp(dy / (stage.clientHeight * 0.32) * 1.35, 0, 1.35);
      if (world.lever.target > 1.1 && !world.lever.fired){ world.lever.fired = true; spin(); }
      return;
    }
    const ud = pick(ev);
    el.style.cursor = ud ? 'pointer' : 'grab';
    lampHover(ud && !rt.spinning ? ud : null);
  });
  el.addEventListener('pointerleave', () => { rt.hoverBand = null; pointer.tx = pointer.ty = 0; });
  el.addEventListener('pointercancel', ev => { if (world.lever) { world.lever.drag = false; world.lever.target = 0; } pointerDown = null; orbit.drag = null; orbit.pinch = null; orbit.pointers.delete(ev.pointerId); });
  el.addEventListener('pointerdown', ev => {
    Snd.ensure();
    const ud = pick(ev);
    pointerDown = { x:ev.clientX, y:ev.clientY, ud, t:now() };
    orbit.lastInput = now();
    orbit.pointers.set(ev.pointerId, { x:ev.clientX, y:ev.clientY });
    if (ud && ud.action === 'lever'){ world.lever.drag = true; world.lever.fired = false; el.setPointerCapture(ev.pointerId); }
    else if (!ud){ orbit.drag = { x:ev.clientX, y:ev.clientY, yaw:orbit.yaw, pitch:orbit.pitch }; el.setPointerCapture(ev.pointerId); }
  });
  el.addEventListener('pointerup', ev => {
    orbit.pointers.delete(ev.pointerId);
    if (orbit.pointers.size < 2) orbit.pinch = null;
    if (orbit.drag){ orbit.drag = null; el.style.cursor = 'grab'; pointerDown = null; return; }
    if (!pointerDown) return;
    const ud = pointerDown.ud, moved = Math.hypot(ev.clientX - pointerDown.x, ev.clientY - pointerDown.y) > 8;
    if (world.lever.drag){
      world.lever.drag = false; world.lever.target = 0;
      if (!world.lever.fired && !moved){ world.lever.auto = 1; spin(); }
    } else if (ud && !moved){
      if (ud.action === 'btn') deckAction(ud.id);
      if (ud.action === 'row') toggleRow(ud.idx);
      if (ud.action === 'pair') togglePair(ud.idx);
    }
    pointerDown = null;
  });
}
