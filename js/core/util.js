// @ts-check
/** Kleine reine Hilfsfunktionen (Formatierung, Begrenzung, Modulo, Zeit). */

export const fmt = v => (Math.round(v * 100) / 100).toFixed(2);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mod = (a, n) => ((a % n) + n) % n;
export const now = () => performance.now();
