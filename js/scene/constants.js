/** Geometrie der Walzen und des Bildausschnitts. */

/* =========================================================
   Three.js-Szene
   ========================================================= */
export const N = 16, STEP = Math.PI * 2 / N, R = 2.1, REEL_GAP = 1.13;
export const CELL_W = 0.98, CELL_H = 2 * R * Math.sin(STEP / 2) * 0.975;
export const VIEW = { cx: 0.35, cy: -0.05, w: 10.2, h: 11.8 };
export const rowAngle = r => (1.5 - r) * STEP;
export const reelX = c => (c - 2) * REEL_GAP;
export const BASE_EMISSIVE = 0.045;
