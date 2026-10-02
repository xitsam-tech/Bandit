/** DOM-Zugriffe, die beim Laden feststehen: $(), Bühne, Overlay-Canvas, reduzierte Bewegung. */

export const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const $ = id => document.getElementById(id);
export const stage = $('stage'), fxCanvas = $('fx'), fx = fxCanvas.getContext('2d');
