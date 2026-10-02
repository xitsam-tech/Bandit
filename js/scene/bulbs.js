/** Glühbirnen-Kranz ums Walzenfenster. */
import { world } from './context.js';
import { rrShape } from './helpers.js';

export function buildBulbs(){
  const pts = rrShape(6.42, 4.12, 0.42).getSpacedPoints(48);
  pts.pop();
  const n = pts.length, d = new THREE.Object3D();
  // Chrom-Fassung
  const sockets = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.068, 0.08, 0.05, 20),
    new THREE.MeshStandardMaterial({ color:0xd8d4e4, metalness:1, roughness:0.25, envMapIntensity:1.2 }), n);
  // Glaskolben (Farbe = Glühen, bei „aus“ dunkles Bernstein)
  world.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.052, 16, 12), new THREE.MeshBasicMaterial({ toneMapped:false }), n);
  pts.forEach((p, i) => {
    d.rotation.set(Math.PI / 2, 0, 0); d.scale.set(1, 1, 1); d.position.set(p.x, p.y, 0.4); d.updateMatrix(); sockets.setMatrixAt(i, d.matrix);
    d.rotation.set(0, 0, 0); d.scale.set(1, 1, 0.85); d.position.set(p.x, p.y, 0.45); d.updateMatrix(); world.bulbs.setMatrixAt(i, d.matrix);
    world.bulbs.setColorAt(i, new THREE.Color(0x3a2610));
  });
  world.bulbs.instanceColor.needsUpdate = true;
  world.scene.add(sockets, world.bulbs);
  // weicher Lichthof je Birne
  const hc = document.createElement('canvas'); hc.width = hc.height = 64; const hx = hc.getContext('2d');
  const hg = hx.createRadialGradient(32, 32, 0, 32, 32, 32);
  hg.addColorStop(0, '#ffffffff'); hg.addColorStop(0.18, '#ffffffaa'); hg.addColorStop(0.45, '#ffffff22'); hg.addColorStop(1, '#ffffff00');
  hx.fillStyle = hg; hx.fillRect(0, 0, 64, 64);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  pts.forEach((p, i) => { pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = 0.48; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  world.bulbHalo = new THREE.Points(geo, new THREE.PointsMaterial({
    size:0.36, map:new THREE.CanvasTexture(hc), vertexColors:true, transparent:true,
    depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false
  }));
  world.scene.add(world.bulbHalo);
  world.bulbV = new Float32Array(n);
}
