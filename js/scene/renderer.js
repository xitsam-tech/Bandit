/** Renderer, Szene, Kamera, Licht, Nachbearbeitung (Bloom) und Raum/Boden. */
import { $, reducedMotion } from '../dom.js';
import { buildBulbs } from './bulbs.js';
import { buildCabinet } from './cabinet.js';
import { buildCard } from './card.js';
import { buildCoins } from './coins.js';
import { world } from './context.js';
import { CAB_DEPTH, CAB_MID_Z } from './constants.js';
import { buildLamps } from './lamps.js';
import { buildLever } from './lever.js';
import { buildSweeps } from './lights.js';
import { buildMechanics } from './mechanics.js';
import { buildReels, buildWinFrames } from './reels.js';
import { buildWheel } from './wheel.js';

export function initGL(){
  if (!window.THREE) return false;
  try {
    world.renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias:true, powerPreference:'high-performance' });
  } catch(e){ return false; }
  world.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  world.renderer.setClearColor(0x040208, 1);

  world.scene = new THREE.Scene();
  world.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);

  // Reflektions-Umgebung: dunkler Raum mit Neon-Panels → Chrom spiegelt Spielhallenlicht
  const pmrem = new THREE.PMREMGenerator(world.renderer);
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color:0x0b0b0c, side:THREE.BackSide })));
  [[0xb8b4b0, -9, 3, 4], [0xb0b4b8, 9, 2, 4], [0xd8ccb8, 0, 12, 6], [0xc8c8c8, 0, 4, 14], [0x303030, 0, -10, -6]].forEach(([col, x, y, z]) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), new THREE.MeshBasicMaterial({ color:col, side:THREE.DoubleSide }));
    p.position.set(x, y, z); p.lookAt(0, 0, 0); env.add(p);
  });
  world.scene.environment = pmrem.fromScene(env, 0.04).texture;

  // Licht
  world.scene.add(new THREE.AmbientLight(0x8a8690, 0.62));
  const key = new THREE.SpotLight(0xfff1dc, 0.5, 40, 0.75, 1.0); key.position.set(2.5, 7, 10); key.target.position.set(0, 0.5, 0); world.scene.add(key, key.target);
  world.pinkLight = new THREE.PointLight(0xff3d9a, 1.4, 22); world.pinkLight.position.set(-7, 2, 4); world.scene.add(world.pinkLight);
  world.cyanLight = new THREE.PointLight(0x35e2ff, 1.2, 22); world.cyanLight.position.set(7, 0, 4); world.scene.add(world.cyanLight);

  buildBackdrop();
  buildCabinet();
  buildReels();
  buildLamps();
  buildLever();
  buildBulbs();
  buildCoins();
  buildWinFrames();
  buildWheel();
  buildCard();
  buildSweeps();
  buildMechanics();

  // Nachbearbeitung: Bloom für Neon, Gamma am Schluss
  if (THREE.EffectComposer && THREE.UnrealBloomPass && THREE.GammaCorrectionShader){
    try {
      // Fließkomma-Puffer gegen Farbstufen in dunklen Verläufen (Banding)
      const hf = world.renderer.capabilities.isWebGL2 || world.renderer.extensions.has('OES_texture_half_float');
      const rt = hf ? new THREE.WebGLRenderTarget(1, 1, { type:THREE.HalfFloatType, minFilter:THREE.LinearFilter, magFilter:THREE.LinearFilter, format:THREE.RGBAFormat }) : undefined;
      world.composer = new THREE.EffectComposer(world.renderer, rt);
      world.composer.addPass(new THREE.RenderPass(world.scene, world.camera));
      world.composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(512, 512), 0.42, 0.35, 0.95));
      world.exposurePass = new THREE.ShaderPass({
        uniforms:{ tDiffuse:{ value:null }, exposure:{ value:1 } },
        vertexShader:'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader:'uniform sampler2D tDiffuse; uniform float exposure; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); gl_FragColor = vec4(c.rgb * exposure, c.a); }'
      });
      world.composer.addPass(world.exposurePass);
      world.composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
    } catch(e){ world.composer = null; }
  }
  if (!world.composer){ world.renderer.outputEncoding = THREE.sRGBEncoding; world.renderer.toneMapping = THREE.LinearToneMapping; }
  return true;
}

function buildBackdrop(){
  // rundum geschlossener Raum, damit beim Drehen keine Kante der Wand sichtbar wird
  const room = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, 70, 64, 1, true), new THREE.MeshBasicMaterial({ color:0x050505, side:THREE.BackSide }));
  room.position.set(0, 2, -4); world.scene.add(room);

  // keine bunten Lichtflecken mehr: ruhiger, neutraler Raum (Gruppe bleibt als leerer Platzhalter)
  world.bokeh = new THREE.Group(); world.scene.add(world.bokeh);

  // Spiegelboden (nur auf breiten Bildschirmen); bei reduzierter Bewegung ausgeblendet – zur Laufzeit umschaltbar
  if (THREE.Reflector && window.innerWidth > 700){
    const mirror = new THREE.Reflector(new THREE.CircleGeometry(33, 64), { textureWidth:768, textureHeight:384, color:0x2e2e30 });
    mirror.rotation.x = -Math.PI / 2; mirror.position.set(0, -5.62, -4); world.scene.add(mirror); world.mirror = mirror;
  }
  const floor = new THREE.Mesh(new THREE.CircleGeometry(33.5, 64), new THREE.MeshStandardMaterial({
    color:0x080808, roughness:0.8, metalness:0.1, envMapIntensity:0.08
  }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -5.61, -4); world.scene.add(floor); world.floor = floor;
  applyMirror();
  const shc = document.createElement('canvas'); shc.width = shc.height = 128; const shx = shc.getContext('2d');
  const shg = shx.createRadialGradient(64, 64, 4, 64, 64, 64); shg.addColorStop(0, '#000000d0'); shg.addColorStop(1, '#00000000');
  shx.fillStyle = shg; shx.fillRect(0, 0, 128, 128);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(11, CAB_DEPTH + 0.4), new THREE.MeshBasicMaterial({ map:new THREE.CanvasTexture(shc), transparent:true, depthWrite:false }));
  contact.rotation.x = -Math.PI / 2; contact.position.set(0, -5.6, CAB_MID_Z + 0.5); world.scene.add(contact);
}

/** Spiegelboden passend zur Einstellung „Bewegung reduzieren“ ein- oder ausblenden. */
export function applyMirror(){
  if (!world.floor) return;
  const on = !!world.mirror && !reducedMotion(), m = world.floor.material;
  if (world.mirror) world.mirror.visible = on;
  m.transparent = on; m.opacity = on ? 0.92 : 1; m.needsUpdate = true;
}
