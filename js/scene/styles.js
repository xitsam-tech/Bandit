/** Gehäuse-Stile (Neon, Holz, Klavierlack, Glas) und Helligkeit. */
import { S } from '../core/state.js';
import { clamp } from '../core/util.js';
import { world } from './context.js';
import { canvasTex } from './helpers.js';
import { mech } from './mechanics.js';

/* ----- Gehäuse-Stile ----- */
export const CAB_STYLES = {
  neon:  { name:'Neon',        sign:['#3a0f57', '#1c0830', '#0d0418'], belly:['#2a0a4a', '#14052a', '#0a0216'], neon:0xff3d9a,
           chase:[['#35e2ff', 0], ['#35e2ff', 0.3], ['#ff3d9a', 0.45], ['#ffc83a', 0.55], ['#35e2ff', 0.7], ['#35e2ff', 1]], bulb:0xffc25a, bulbAlt:0xff3d9a, rays:'#ffc83a', lightA:0xff3d9a, lightB:0x35e2ff, light:0.42 },
  wood:  { name:'Holz',        sign:['#3a2112', '#22130a', '#120a05'], belly:['#2e1a0d', '#1c0f07', '#0e0703'], neon:0xffa040,
           chase:[['#ff9a3c', 0], ['#ff9a3c', 0.35], ['#ffe2a0', 0.5], ['#ff9a3c', 0.65], ['#ff9a3c', 1]], bulb:0xffd49a, bulbAlt:0xffb050, rays:'#ffd27a', lightA:0xffb070, lightB:0xffd8a8, light:0.35 },
  piano: { name:'Klavierlack', sign:['#1a1a1e', '#0b0b0d', '#030304'], belly:['#141418', '#0a0a0c', '#030304'], neon:0xe8eeff,
           chase:[['#9fb4ff', 0], ['#9fb4ff', 0.35], ['#ffffff', 0.5], ['#9fb4ff', 0.65], ['#9fb4ff', 1]], bulb:0xfff2dc, bulbAlt:0xcfe0ff, rays:'#d8dce6', lightA:0xf4f0ff, lightB:0xdfe6ff, light:0.3 },
  glass: { name:'Glas',        sign:['#0d2233', '#071521', '#020a10'], belly:['#0a1c2a', '#06121c', '#02080e'], neon:0x7fe0ff,
           chase:[['#7fe0ff', 0], ['#7fe0ff', 0.35], ['#ffffff', 0.5], ['#7fe0ff', 0.65], ['#7fe0ff', 1]], bulb:0xfff2dc, bulbAlt:0x9fe8ff, rays:'#9fd8ff', lightA:0xdff2ff, lightB:0xffffff, light:0.35 }
};
let woodTex = null;
function woodCanvas(){
  const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const g = x.createLinearGradient(0, 0, 0, 1024);
  g.addColorStop(0, '#6a3519'); g.addColorStop(0.5, '#7d4321'); g.addColorStop(1, '#5e2f15');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
  // Maserung: viele leicht gewellte Linien, dazu ein paar Astflecken
  for (let i = 0; i < 340; i++){
    const y0 = rnd() * 1024, amp = 4 + rnd() * 18, fr = 0.002 + rnd() * 0.006, ph = rnd() * 6.28, dark = rnd() < 0.6;
    x.strokeStyle = dark ? `rgba(40,16,6,${0.08 + rnd() * 0.22})` : `rgba(190,120,70,${0.05 + rnd() * 0.12})`;
    x.lineWidth = 0.6 + rnd() * 2.4;
    x.beginPath();
    for (let px = 0; px <= 1024; px += 16){ const py = y0 + Math.sin(px * fr + ph) * amp + Math.sin(px * 0.031 + ph * 2) * 1.5; px ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.stroke();
  }
  for (let k = 0; k < 5; k++){
    const kx = rnd() * 1024, ky = rnd() * 1024, rx = 14 + rnd() * 20;
    for (let r = rx; r > 2; r -= 3){ x.strokeStyle = `rgba(45,18,6,${0.25})`; x.lineWidth = 1.2; x.beginPath(); x.ellipse(kx, ky, r * 2.4, r, 0, 0, Math.PI * 2); x.stroke(); }
  }
  return c;
}
export function drawChase(stops){
  if (!world.chaseCanvas) return;
  const x = world.chaseCanvas.getContext('2d'), cg = x.createLinearGradient(0, 0, 256, 0);
  stops.forEach(([col, o]) => cg.addColorStop(o, col));
  x.fillStyle = cg; x.fillRect(0, 0, 256, 4);
  if (world.chaseTex) world.chaseTex.needsUpdate = true;
}
export function applyBrightness(){
  const v = clamp(S.brightness, 0.5, 1.2);
  if (world.exposurePass) world.exposurePass.uniforms.exposure.value = v;
  else if (world.renderer) world.renderer.toneMappingExposure = v;
}
export function applyCabinetStyle(name){
  const st = CAB_STYLES[name] || CAB_STYLES.neon;
  if (world.lacquerMat){
    const m = world.lacquerMat;
    if (name === 'wood'){
      if (!woodTex){ woodTex = canvasTex(woodCanvas()); woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping; woodTex.repeat.set(0.16, 0.16); woodTex.anisotropy = 8; }
      m.map = woodTex; m.color.setHex(0xffffff); m.roughness = 0.42; m.metalness = 0; m.clearcoat = 0.75; m.clearcoatRoughness = 0.12; m.envMapIntensity = 0.45;
    } else if (name === 'piano'){
      m.map = null; m.color.setHex(0x050506); m.roughness = 0.2; m.metalness = 0.1; m.clearcoat = 1; m.clearcoatRoughness = 0.03; m.envMapIntensity = 0.9;
    } else if (name === 'glass'){
      m.map = null; m.color.setHex(0xa8d0f0); m.roughness = 0.08; m.metalness = 0; m.clearcoat = 1; m.clearcoatRoughness = 0.02; m.envMapIntensity = 0.7;
    } else {
      m.map = null; m.color.setHex(0x0e0418); m.roughness = 0.45; m.metalness = 0.3; m.clearcoat = 0.85; m.clearcoatRoughness = 0.1; m.envMapIntensity = 0.55;
    }
    // Glas: durchsichtig, Innenseiten sichtbar, schreibt keine Tiefe (Innenleben bleibt sichtbar)
    const glass = name === 'glass';
    m.transparent = glass; m.opacity = glass ? 0.09 : 1; m.depthWrite = !glass; m.side = glass ? THREE.DoubleSide : THREE.FrontSide;
    // Glasfront liegt nur knapp hinter den Anzeigen → in der Tiefe leicht nach hinten versetzen (gegen Z-Fighting-Streifen)
    m.polygonOffset = glass; m.polygonOffsetFactor = glass ? 2 : 0; m.polygonOffsetUnits = glass ? 8 : 0;
    m.needsUpdate = true;
    mech.parts.forEach(o => o.visible = glass);
    if (mech.backPlate) mech.backPlate.visible = !glass;
  }
  world.neonMats.forEach(n => n.base.setHex(st.neon));
  if (world.pinkLight){ world.pinkLight.color.setHex(st.lightA); world.cyanLight.color.setHex(st.lightB); }
  world.sweeps.forEach((l, i) => l.color.setHex(i ? st.lightB : st.lightA));
  drawChase(st.chase);
  if (world.redrawSign) world.redrawSign();
  if (world.belly) world.belly.key = '';
}
