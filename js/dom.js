/** DOM-/Geräte-Zugriffe: $(), Bühne, Overlay-Canvas, reduzierte Bewegung, Vibration. */
import { S } from './core/state.js';

/** Systemeinstellung „Bewegung reduzieren“ (prefers-reduced-motion). */
export const SYSTEM_REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
/** Bewegung reduzieren? Einstellung im Spielstand (S.reduced), sonst die Systemeinstellung. Zur Laufzeit änderbar. */
export const reducedMotion = () => (typeof S.reduced === 'boolean' ? S.reduced : SYSTEM_REDUCED);

export const $ = id => document.getElementById(id);
export const stage = $('stage'), fxCanvas = $('fx'), fx = fxCanvas.getContext('2d');
/** Kurze Vibration (nur nach einer Nutzer-Interaktion). */
export function buzz(p){ try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(p); } catch(e){} }
