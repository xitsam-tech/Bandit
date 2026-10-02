/** Glücksrad (3D-Objekt und Animation). */
import { Snd } from '../audio/sound.js';
import { WHEEL } from '../core/config.js';
import { finishWheel } from '../game/wheel-flow.js';
import { world } from './context.js';
import { canvasTex } from './helpers.js';

/* ----- Glücksrad ----- */
export function drawWheelCanvas(c){
  const SZ = 1024; c.width = c.height = SZ;
  const x = c.getContext('2d'), m = SZ / 2, n = WHEEL.length, seg = Math.PI * 2 / n, R0 = m - 6;
  const COL = { 3:'#4b2391', 4:'#1f7a3a', 5:'#0f7a99', 8:'#c0145c', 15:'#d18a00', 25:'#ffd23f' };
  x.clearRect(0, 0, SZ, SZ);
  for (let i = 0; i < n; i++){
    const a0 = -Math.PI / 2 + i * seg - seg / 2, v = WHEEL[i], base = COL[v] || '#4b2391';
    const g = x.createRadialGradient(m, m, 80, m, m, R0); g.addColorStop(0, '#12081f'); g.addColorStop(0.45, base); g.addColorStop(1, base);
    x.beginPath(); x.moveTo(m, m); x.arc(m, m, R0, a0, a0 + seg); x.closePath(); x.fillStyle = g; x.fill();
    x.strokeStyle = '#ffe9a0'; x.lineWidth = 6; x.stroke();
    x.save(); x.translate(m, m); x.rotate(i * seg); x.translate(0, -R0 * 0.64); x.rotate(-Math.PI / 2);
    x.font = `400 ${v >= 15 ? 84 : 74}px Bungee, Impact, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.lineWidth = 12; x.strokeStyle = v === 25 ? '#7a4a00' : '#1a0b2a'; x.strokeText(`${v}×`, 0, 4);
    x.fillStyle = v === 25 ? '#fffbe6' : '#ffffff'; x.fillText(`${v}×`, 0, 4);
    x.restore();
  }
  x.beginPath(); x.arc(m, m, 130, 0, Math.PI * 2); x.fillStyle = '#1a0b2a'; x.fill(); x.lineWidth = 10; x.strokeStyle = '#ffc83a'; x.stroke();
  x.font = '400 40px Bungee, Impact, sans-serif'; x.fillStyle = '#ffc83a'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🍀', m, m + 2);
  return c;
}
export function buildWheel(){
  const gold = new THREE.MeshStandardMaterial({ color:0xffc451, metalness:1, roughness:0.22, envMapIntensity:1.3 });
  const canvas = drawWheelCanvas(document.createElement('canvas')), tex = canvasTex(canvas);
  const g = new THREE.Group(); g.position.set(0, 0.45, 1.3); g.visible = false;
  const disc = new THREE.Group(); g.add(disc);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.78, 1.78, 0.16, 80), gold); body.rotation.x = Math.PI / 2; disc.add(body);
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.7, 96), new THREE.MeshStandardMaterial({ map:tex, emissive:0xffffff, emissiveMap:tex, emissiveIntensity:0.32, roughness:0.45 }));
  face.position.z = 0.085; disc.add(face);
  const n = WHEEL.length, seg = Math.PI * 2 / n, pegGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.16, 12);
  for (let i = 0; i < n; i++){
    const b = i * seg + seg / 2, peg = new THREE.Mesh(pegGeo, gold);
    peg.rotation.x = Math.PI / 2; peg.position.set(Math.sin(b) * 1.57, Math.cos(b) * 1.57, 0.16); disc.add(peg);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 20), gold); hub.position.z = 0.12; hub.scale.z = 0.5; disc.add(hub);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.79, 0.07, 12, 96), gold); rim.position.z = 0.06; g.add(rim);
  const bulbGeo = new THREE.SphereGeometry(0.055, 10, 8), rimBulbs = [];
  for (let i = 0; i < 28; i++){
    const a = i / 28 * Math.PI * 2, b = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color:0xffc83a, toneMapped:false }));
    b.position.set(Math.sin(a) * 1.95, Math.cos(a) * 1.95, 0.1); g.add(b); rimBulbs.push(b);
  }
  const flap = new THREE.Group(); flap.position.set(0, 2.05, 0.28); g.add(flap);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.44, 24), new THREE.MeshPhysicalMaterial({ color:0xe3122a, roughness:0.15, clearcoat:1 }));
  cone.rotation.z = Math.PI; cone.position.y = -0.22; flap.add(cone);
  flap.add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), gold));
  world.scene.add(g);
  world.dimPlane = new THREE.Mesh(new THREE.PlaneGeometry(80, 50), new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0, depthWrite:false }));
  world.dimPlane.position.z = 0.95; world.dimPlane.visible = false; world.scene.add(world.dimPlane);
  world.wheel = { g, disc, flap, rimBulbs, canvas, tex, state:'hidden', show:0, phi:0, kick:0, lastPeg:0 };
}
export function updateWheel(t, dt){
  if (!world.wheel || world.wheel.state === 'hidden') return;
  const target = world.wheel.state === 'out' ? 0 : 1;
  world.wheel.show += (target - world.wheel.show) * Math.min(1, dt * 5);
  world.wheel.g.scale.setScalar(Math.max(0.001, world.wheel.show)); world.wheel.g.rotation.y = (1 - world.wheel.show) * 1.4;
  if (world.wheel.state === 'spin'){
    const x = Math.min(1, (t - world.wheel.ts) / world.wheel.dur), e = 1 - Math.pow(1 - x, 4);
    world.wheel.phi = world.wheel.from + (world.wheel.to - world.wheel.from) * e;
    if (x >= 1){ world.wheel.phi = world.wheel.to; finishWheel(); }
  }
  const seg = Math.PI * 2 / WHEEL.length, peg = Math.floor(world.wheel.phi / seg + 0.5);
  if (peg !== world.wheel.lastPeg){ world.wheel.lastPeg = peg; if (world.wheel.state === 'spin'){ world.wheel.kick = 1; Snd.peg(); } }
  world.wheel.kick = Math.max(0, world.wheel.kick - dt * 7);
  world.wheel.flap.rotation.z = -0.55 * world.wheel.kick;
  world.wheel.disc.rotation.z = world.wheel.phi;
  const sp = world.wheel.state === 'spin' ? 55 : 170;
  world.wheel.rimBulbs.forEach((b, i) => b.material.color.setHex((i + Math.floor(t / sp)) % 3 === 0 ? 0xfff2b0 : 0x6a3d0c));
  if (world.wheel.state === 'out' && world.wheel.show < 0.02){ world.wheel.state = 'hidden'; world.wheel.g.visible = false; }
}
