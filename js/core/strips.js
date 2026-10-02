// @ts-check
/**
 * Feste Walzenstreifen: Jede Walze trägt dauerhaft dieselbe Symbolfolge, der Zufall wählt nur die Stoppposition.
 * Sichtbar sind ROWS aufeinanderfolgende Streifenfelder: Reihe r zeigt Streifen[(p + r) mod STRIP_LEN] (Reihe 0 oben).
 * Keine DOM-/THREE-Abhängigkeit.
 */
import { CLOVER as K, COLS, DIAMOND as D, JOKER as J, ROWS, SCATTER as B, SYMBOLS } from './config.js';
import { mod } from './util.js';

/** @typedef {number[][]} Matrix  4×5, Werte = Symbol-Index */

// Symbol-Kürzel für die Streifen (Indizes wie in SYMBOLS)
const KI = 0, ZI = 1, OR = 2, PF = 3, ME = 4, GL = 5, ST = 6, S7 = 7, BAR = 8;

/** Felder pro Walze (= Kacheln auf dem Walzenzylinder). */
export const STRIP_LEN = 16;

/**
 * Streifen pro Walze, je STRIP_LEN Symbole, von oben nach unten gelesen.
 * Aufbau: Bonus auf Walze 1/3/5, Klee auf jeder Walze, Diamant auf 1/3/5, Joker auf 2–4 (je einmal);
 * kein Symbol zweimal im selben sichtbaren Fenster.
 * Kalibriert mit `node tools/calibrate-strips.mjs` (Seed 1, 10 Linien, gleichverteilte Stopps):
 *   Quote ohne Jackpot 89,2 % (Monte Carlo, 2 Mio. Drehungen; exakt + MC-Bonus 89,4 %)
 *   = Linien 72,5 % + Freispiele 6,8 % + Glücksrad 9,9 %; dazu 5 % Jackpot-Einspeisung.
 *   Freispiel-Auslöser und Glücksrad je genau 1/64, Trefferquote 25,0 %, Jackpot ≈ 1 von 52 000.
 * @type {number[][]}
 */
export const REEL_STRIPS = [
  [ZI, OR, GL, S7, ME, ST, PF, K, OR, BAR, PF, B, OR, KI, PF, D],
  [GL, PF, KI, ST, S7, J, ME, PF, OR, KI, K, ZI, PF, ME, KI, BAR],
  [ST, KI, S7, BAR, D, PF, ME, GL, OR, PF, KI, B, ZI, PF, J, K],
  [ME, GL, S7, ZI, KI, OR, K, ME, PF, GL, ZI, J, ST, PF, BAR, ZI],
  [ST, GL, BAR, ZI, B, K, KI, PF, ST, ZI, KI, ME, S7, ZI, OR, D]
];

/** Startpositionen, wenn kein (gültiger) Stand gespeichert ist. */
export const START_STOPS = [0, 0, 0, 0, 0];

/** Gültige Stopppositionen: COLS ganze Zahlen in 0..STRIP_LEN-1. @param {any} s @returns {s is number[]} */
export function validStops(s){
  return Array.isArray(s) && s.length === COLS && s.every(p => Number.isInteger(p) && p >= 0 && p < STRIP_LEN);
}

/**
 * Sichtbare Matrix aus Stopppositionen.
 * @param {number[]} stops   Stoppposition je Walze
 * @param {number[][]} [strips]
 * @returns {Matrix}
 */
export function matrixFromStops(stops, strips = REEL_STRIPS){
  return Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => strips[c][mod(stops[c] + r, strips[c].length)]));
}

/**
 * Sucht Stopppositionen, deren Matrix `pred` erfüllt (feste Reihenfolge, erste Übereinstimmung).
 * @param {(m: Matrix, stops: number[]) => boolean} pred
 * @param {{ fixed?: (number | null | undefined)[], strips?: number[][] }} [opts]  fixed[c]: Walze c bleibt auf dieser Position
 * @returns {number[] | null}
 */
export function findStops(pred, { fixed = [], strips = REEL_STRIPS } = {}){
  const n = strips[0].length, stops = [0, 0, 0, 0, 0];
  /** @type {(c: number) => boolean} */
  const rec = c => {
    if (c === COLS) return pred(matrixFromStops(stops, strips), stops);
    const f = fixed[c];
    if (Number.isInteger(f)){ stops[c] = /** @type {number} */ (f); return rec(c + 1); }
    for (let p = 0; p < n; p++){ stops[c] = p; if (rec(c + 1)) return true; }
    return false;
  };
  return rec(0) ? stops.slice() : null;
}

/**
 * Prüft die Streifen: Länge, gültige Symbole, keine zwei gleichen Nachbarn (zyklisch), Walzen paarweise verschieden.
 * @param {number[][]} [strips]
 * @returns {string[]} Fehlerliste (leer = in Ordnung)
 */
export function checkStrips(strips = REEL_STRIPS){
  /** @type {string[]} */
  const err = [];
  if (strips.length !== COLS) err.push(`${strips.length} statt ${COLS} Walzen`);
  strips.forEach((s, c) => {
    if (s.length !== STRIP_LEN) err.push(`Walze ${c + 1}: ${s.length} statt ${STRIP_LEN} Felder`);
    s.forEach((v, i) => {
      if (!Number.isInteger(v) || v < 0 || v >= SYMBOLS.length) err.push(`Walze ${c + 1}, Feld ${i}: ungültiges Symbol ${v}`);
      if (v === s[(i + 1) % s.length]) err.push(`Walze ${c + 1}, Feld ${i}: ${SYMBOLS[v] ? SYMBOLS[v].name : v} doppelt hintereinander`);
    });
  });
  for (let a = 0; a < strips.length; a++) for (let b = a + 1; b < strips.length; b++)
    if (strips[a].join() === strips[b].join()) err.push(`Walze ${a + 1} und ${b + 1} sind gleich`);
  return err;
}
