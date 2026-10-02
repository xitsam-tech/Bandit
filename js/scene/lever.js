/** Hebel rechts am Gehäuse. */
import { R } from './constants.js';
import { pickables, world } from './context.js';

export function buildLever(){
  const chrome = new THREE.MeshStandardMaterial({ color:0xeeeaf8, metalness:1, roughness:0.15, envMapIntensity:1.5 });
  const red = new THREE.MeshPhysicalMaterial({ color:0xe3122a, roughness:0.12, metalness:0.1, clearcoat:1, clearcoatRoughness:0.08 });
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.42, 32), chrome);
  housing.rotation.z = Math.PI / 2; housing.position.set(4.28, 0, -R); world.scene.add(housing); // Lagerung auf der Walzenachse (Höhe und Tiefe mittig zu den Walzen)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), chrome); cap.position.set(4.52, 0, -R); world.scene.add(cap);
  const pivot = new THREE.Group(); pivot.position.set(4.52, 0, -R); pivot.scale.setScalar(1.3);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 2.3, 20), chrome); shaft.position.y = 1.15; pivot.add(shaft);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 24), red); knob.position.y = 2.38; pivot.add(knob);
  world.scene.add(pivot);
  [shaft, knob].forEach(m => { m.userData = { action:'lever' }; pickables.push(m); });
  world.lever = { pivot, angle:0, target:0, drag:false, auto:0 };
}
export function updateLever(dt){
  if (!world.lever) return;
  if (world.lever.auto > 0){
    world.lever.auto = Math.max(0, world.lever.auto - dt * 1.6);
    const x = 1 - world.lever.auto;
    world.lever.target = x < 0.35 ? 1.35 * (x / 0.35) : 1.35 * Math.max(0, 1 - (x - 0.35) / 0.65);
  }
  const k = world.lever.drag || world.lever.auto > 0 ? 22 : 9;
  world.lever.angle += (world.lever.target - world.lever.angle) * Math.min(1, dt * k);
  world.lever.pivot.rotation.x = world.lever.angle;
}
