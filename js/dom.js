/** DOM-/Geräte-Zugriffe: $(), Bühne, Overlay-Canvas, reduzierte Bewegung, Vibration. */

export const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const $ = id => document.getElementById(id);
export const stage = $('stage'), fxCanvas = $('fx'), fx = fxCanvas.getContext('2d');
/** Kurze Vibration (nur nach einer Nutzer-Interaktion). */
export function buzz(p){ try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(p); } catch(e){} }
