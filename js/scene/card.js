/** Risiko-Karte (3D-Objekt und Animation). */
import { mod } from '../core/util.js';
import { roundRect } from '../gfx/canvas2d.js';
import { world } from './context.js';
import { canvasTex } from './helpers.js';

/* ----- Risiko-Karte ----- */
export function buildCard(){
  const back = document.createElement('canvas'); back.width = 300; back.height = 420;
  const x = back.getContext('2d');
  x.fillStyle = '#f3ead6'; roundRect(x, 0, 0, 300, 420, 22); x.fill();
  const g = x.createLinearGradient(0, 0, 300, 420); g.addColorStop(0, '#5a1a8f'); g.addColorStop(1, '#2a0d4a');
  x.fillStyle = g; roundRect(x, 16, 16, 268, 388, 14); x.fill();
  x.strokeStyle = '#ffc83a55'; x.lineWidth = 2;
  for (let i = -420; i < 420; i += 26){ x.beginPath(); x.moveTo(16 + i, 16); x.lineTo(16 + i + 388, 404); x.stroke(); x.beginPath(); x.moveTo(284 - i, 16); x.lineTo(284 - i - 388, 404); x.stroke(); }
  x.fillStyle = '#1a0b2a'; x.beginPath(); x.arc(150, 210, 62, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#ffc83a'; x.lineWidth = 6; x.stroke();
  x.font = '400 46px Bungee, Impact, sans-serif'; x.fillStyle = '#ffc83a'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('EB', 150, 214);
  const face = document.createElement('canvas'); face.width = 300; face.height = 420;
  const edge = new THREE.MeshStandardMaterial({ color:0xb8b0a0, roughness:0.6 });
  const backTex = canvasTex(back), faceTex = canvasTex(face);
  const mats = [edge, edge, edge, edge,
    new THREE.MeshStandardMaterial({ map:backTex, color:0xcfc6d8, roughness:0.55, emissive:0xffffff, emissiveMap:backTex, emissiveIntensity:0.06 }),
    new THREE.MeshStandardMaterial({ map:faceTex, color:0xc9c2b4, roughness:0.6, emissive:0xffffff, emissiveMap:faceTex, emissiveIntensity:0.05 })];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.82, 0.03), mats);
  const grp = new THREE.Group(); grp.add(mesh); grp.position.set(0, 0.25, 1.5); grp.visible = false; world.scene.add(grp);
  world.card = { g:grp, mesh, faceC:face, faceTex, show:0, target:0, rot:0, rotTarget:0, faceUp:false };
}
export function drawCardFace(suit, rank, red){
  const x = world.card.faceC.getContext('2d'), col = red ? '#d4142a' : '#151018';
  x.clearRect(0, 0, 300, 420);
  x.fillStyle = '#fbf6ea'; roundRect(x, 0, 0, 300, 420, 22); x.fill();
  x.strokeStyle = '#d9cdb0'; x.lineWidth = 3; roundRect(x, 10, 10, 280, 400, 16); x.stroke();
  x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '700 46px "Chakra Petch", system-ui, sans-serif'; x.fillText(rank, 40, 46);
  x.font = '40px serif'; x.fillText(suit, 40, 92);
  x.save(); x.translate(260, 374); x.rotate(Math.PI);
  x.font = '700 46px "Chakra Petch", system-ui, sans-serif'; x.fillText(rank, 0, 0); x.font = '40px serif'; x.fillText(suit, 0, 46);
  x.restore();
  x.font = '190px serif'; x.fillText(suit, 150, 222);
  world.card.faceTex.needsUpdate = true;
}
export function updateCard(t, dt){
  if (!world.card) return;
  world.card.show += (world.card.target - world.card.show) * Math.min(1, dt * 6);
  world.card.g.visible = world.card.show > 0.01 || world.card.target > 0;
  if (!world.card.g.visible) return;
  world.card.g.scale.setScalar(Math.max(0.001, world.card.show));
  world.card.g.rotation.z = (1 - world.card.show) * 0.5;
  world.card.g.position.y = (world.camera.aspect < 1 ? -0.6 : -0.1) + Math.sin(t / 650) * 0.04;
  world.card.rot += (world.card.rotTarget - world.card.rot) * Math.min(1, dt * 11);
  world.card.mesh.rotation.y = world.card.rot;
  world.card.mesh.position.z = Math.sin(mod(world.card.rot, Math.PI)) * 0.35;
}
