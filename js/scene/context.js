/** Gemeinsamer Szene-Kontext: veränderliche Three.js-Objekte (world) und Sammlungen von Szene-Teilen. */

/** Veränderliche Szene-Objekte; werden von den build*-Funktionen gesetzt. */
export const world = {
  renderer: undefined,
  scene: undefined,
  camera: undefined,
  composer: null,
  exposurePass: null,
  bulbs: null,
  coins: null,
  lever: null,
  bokeh: null,
  neonMats: [],
  pinkLight: undefined,
  cyanLight: undefined,
  wheel: null,
  card: null,
  dimPlane: null,
  sweeps: [],
  chaseTex: null,
  lacquerMat: null,
  chaseCanvas: null,
  redrawSign: null,
  belly: null,
  bulbHalo: null,
  bulbV: null,
};

export const reels = [], pickables = [], lamps = { rows:[], pairs:[] }, winFrames = [];
export const stickyMeshes = [], holdFrames = [];
