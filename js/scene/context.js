/**
 * Gemeinsamer Szene-Kontext: veränderliche Three.js-Objekte (`world`) und Sammlungen von Szene-Teilen.
 * Die build*-Funktionen setzen die Einträge in initGL(); andere Module greifen darüber zu.
 * Abhängigkeiten: keine (Blatt-Modul, damit es keine Import-Zyklen erzeugt).
 */

/** Veränderliche Szene-Objekte; werden von den build*-Funktionen gesetzt. @type {Record<string, any>} */
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

/** Walzen, Klickziele, Leuchtknöpfe, Gewinnrahmen (werden beim Aufbau befüllt). */
export const reels = [], pickables = [], lamps = { rows:[], pairs:[] }, winFrames = [];
/** Klebe-Joker-Felder und Halte-Rahmen (Freispiele). */
export const stickyMeshes = [], holdFrames = [];
