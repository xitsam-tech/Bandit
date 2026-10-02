// @ts-check
/** Kleine reine Hilfsfunktionen (Formatierung, Begrenzung, Modulo, Zeit). */

/** Betrag mit zwei Nachkommastellen. @type {(v: number) => string} */
export const fmt = v => (Math.round(v * 100) / 100).toFixed(2);
/** @type {(v: number, a: number, b: number) => number} */
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Modulo mit nicht-negativem Ergebnis. @type {(a: number, n: number) => number} */
export const mod = (a, n) => ((a % n) + n) % n;
/** Millisekunden seit Seitenstart. @type {() => number} */
export const now = () => performance.now();
