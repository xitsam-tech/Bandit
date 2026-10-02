// @ts-check
/** Laufzeit-Zustand des Spielablaufs (nicht gespeichert). Ein gemeinsames Objekt, weil ES-Modul-Exporte von außen nicht neu zugewiesen werden können. */

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
