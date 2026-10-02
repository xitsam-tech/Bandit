// @ts-check
/**
 * Laufzeit-Zustand des Spielablaufs (wird nicht gespeichert).
 * Ein gemeinsames, veränderliches Objekt, weil ES-Modul-Exporte von außen nicht neu zugewiesen werden können:
 * Module lesen und schreiben `rt.spinning`, `rt.busy` … statt früherer Top-Level-`let`s.
 */

/**
 * @typedef {object} Runtime
 * @property {boolean} spinning     Walzen laufen
 * @property {boolean} autoOn       Auto-Spiel aktiv
 * @property {number} lastWin       Gewinn der letzten Runde (inkl. Glücksrad/Risiko)
 * @property {import('./lines.js').EvalResult | null} lastResult  letzte Auswertung (Debug-Raster)
 * @property {boolean} glOK         WebGL-Szene erfolgreich aufgebaut
 * @property {any} present          laufende Gewinnpräsentation
 * @property {any} bannerState      offenes Banner
 * @property {any} autoTimer        Timer für Auto-/Freispiel-Weiterlauf
 * @property {import('./state.js').SpinCtx | null} spinCtx  Kontext des laufenden/letzten Drehs
 * @property {boolean} busy         Auswertung/Ablaufkette läuft
 * @property {any} gamble           offene Risiko-Leiter
 * @property {number} shake         Kamera-Wackeln (klingt ab)
 * @property {number[] | null} hoverBand  hervorgehobene Reihen (Hover auf Reihen-/Paar-Knöpfen)
 */

/** @type {Runtime} */
export const rt = {
  spinning: false,
  autoOn: false,
  lastWin: 0,
  lastResult: null,
  glOK: false,
  present: null,
  bannerState: null,
  autoTimer: 0,
  spinCtx: null,
  busy: false,
  gamble: null,
  shake: 0,
  hoverBand: null,
};
