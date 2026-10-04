/** Geometrie der Walzen, des Gehäuses und des Bildausschnitts. */
import { STRIP_LEN } from '../core/strips.js';

/* =========================================================
   Three.js-Szene
   ========================================================= */
// N = Felder pro Walze (Länge der festen Streifen). Der Radius wächst mit N, damit Kachelhöhe und Symbolgröße
// gleich bleiben (Bogenlänge einer Kachel wie beim früheren Entwurf mit 16 Feldern und Radius 2,1).
export const N = STRIP_LEN, STEP = Math.PI * 2 / N, R = 2.1 * N / 16, REEL_GAP = 1.13;
export const CELL_W = 0.98, CELL_H = 2 * R * Math.sin(STEP / 2) * 0.975;
export const VIEW = { cx: 0.35, cy: -0.05, w: 10.2, h: 11.8 };
export const rowAngle = r => (1.5 - r) * STEP;
export const reelX = c => (c - 2) * REEL_GAP;
export const BASE_EMISSIVE = 0.045;

/* ----- Gehäuse (aus R abgeleitet): Walzenachse bei z = −R, die Walzen reichen bis knapp vor die Rückwand ----- */
/** Walzenachse (Tiefe). */
export const AXIS_Z = -R;
/** Vorderfläche des Korpus (z) und Gehäusetiefe des Oberteils (Walzendurchmesser + Front + Wandstärke). */
export const FRONT_Z = 0.3, CAB_DEPTH = 2 * R + 0.4;
/** Innenseite der Rückwand (Oberteil) bzw. des Unterteils, das 0,2 weniger tief ist. */
export const BACK_Z = FRONT_Z - CAB_DEPTH + 0.08, BACK_Z_LOW = BACK_Z + 0.2;
/** Mitte des Gehäuses in der Tiefe (Drehpunkt der Kamera). */
export const CAB_MID_Z = FRONT_Z - CAB_DEPTH / 2;
/** Innenraum: Seitenwände bei ±WALL_X, Oberkante Oberteil, Boden Unterteil. */
export const WALL_X = 3.97, TOP_Y = 3.25, FLOOR_Y = -5.17;
