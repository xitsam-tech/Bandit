/** Geometrie-Hilfen fürs Innenleben: Zusammenfassen vieler Kleinteile zu wenigen Meshes, Matrizen, Vektoren. */

const _m = window.THREE ? new THREE.Matrix4() : null, _q = window.THREE ? new THREE.Quaternion() : null, _e = window.THREE ? new THREE.Euler() : null;

/** Vektor-Kurzform. */
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Transformationsmatrix aus Position, Drehung (Euler, XYZ) und Skalierung.
 * @param {number[]} p  [x, y, z]
 * @param {number[]} [r] [rx, ry, rz]
 * @param {number[]} [s] [sx, sy, sz]
 */
export function mat4(p, r = [0, 0, 0], s = [1, 1, 1]){
  _q.setFromEuler(_e.set(r[0], r[1], r[2]));
  return new THREE.Matrix4().compose(V(p[0], p[1], p[2]), _q.clone(), V(s[0], s[1], s[2]));
}

/** Matrix, die die y-Achse auf `dir` dreht und nach `pos` verschiebt. */
export function alignY(pos, dir, sy = 1){
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
  return new THREE.Matrix4().compose(pos.clone(), q, V(1, sy, 1));
}

/**
 * Fasst Geometrien (beliebig indiziert) zu einer nicht indizierten Geometrie zusammen.
 * Übernommen werden position, normal, uv und – falls vorhanden – color.
 * @param {{geo: any, matrix?: any, color?: any}[]} list
 */
export function mergeGeometries(list){
  let n = 0;
  const parts = list.map(({ geo, matrix, color }) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    n += g.attributes.position.count;
    return { g, color };
  });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const withColor = list.some(x => x.color), col = withColor ? new Float32Array(n * 3) : null;
  let o = 0;
  parts.forEach(({ g, color }) => {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (col){ const cc = color || new THREE.Color(1, 1, 1); for (let i = 0; i < c; i++){ col[(o + i) * 3] = cc.r; col[(o + i) * 3 + 1] = cc.g; col[(o + i) * 3 + 2] = cc.b; } }
    o += c; g.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

/**
 * Sammelt Kleinteile je Material und erzeugt am Ende ein Mesh pro Material (weniger Draw-Calls).
 * Gemeinsam genutzte Grundformen (z. B. Schraubenkopf) werden nur einmal erzeugt.
 */
export class Batch {
  constructor(){ this.groups = new Map(); }
  /** @param {any} geo @param {any} mat @param {any} [matrix] @param {any} [color] Vertexfarbe (nur bei vertexColors-Materialien) */
  add(geo, mat, matrix, color){
    if (!this.groups.has(mat)) this.groups.set(mat, []);
    this.groups.get(mat).push({ geo, matrix, color });
    return this;
  }
  box(w, h, d, mat, p, r, color){ return this.add(shared('box', w, h, d), mat, mat4(p, r), color); }
  cyl(rad, h, mat, p, r, color, seg = 16){ return this.add(shared('cyl', rad, h, seg), mat, mat4(p, r), color); }
  /** Erzeugt die Meshes und hängt sie über `add` ein. @returns {any[]} */
  flush(addFn){
    const out = [];
    this.groups.forEach((list, mat) => { if (list.length) out.push(addFn(new THREE.Mesh(mergeGeometries(list), mat))); });
    this.groups.clear();
    return out;
  }
}

const cache = new Map();
/** Gemeinsame Grundformen (werden beim Zusammenfassen kopiert, nie direkt gerendert). */
export function shared(kind, a, b, c){
  const key = kind + ':' + a + ':' + b + ':' + c;
  if (!cache.has(key)){
    cache.set(key, kind === 'box' ? new THREE.BoxGeometry(a, b, c) : new THREE.CylinderGeometry(a, a, b, c || 16));
  }
  return cache.get(key);
}

/** Gebürstetes Blech: feine Längsriefen als Textur (für map und roughnessMap). */
let brushed = null;
export function brushedTexture(){
  if (brushed) return brushed;
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#b8bcc2'; x.fillRect(0, 0, 256, 64);
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 260; i++){
    const y = rnd() * 64, l = 40 + rnd() * 200, x0 = rnd() * 256, v = 150 + Math.floor(rnd() * 90);
    x.strokeStyle = `rgba(${v},${v + 4},${v + 8},${0.25 + rnd() * 0.35})`; x.lineWidth = 0.6 + rnd();
    x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + l, y + (rnd() - 0.5)); x.stroke();
  }
  brushed = new THREE.CanvasTexture(c); brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping; brushed.anisotropy = 4;
  return brushed;
}
