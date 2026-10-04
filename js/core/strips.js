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
export const STRIP_LEN = 22;

/**
 * Streifen pro Walze, je STRIP_LEN Symbole, von oben nach unten gelesen.
 * Aufbau: Bonus und Diamant auf jeder Walze (je einmal), Klee auf jeder Walze (Walze 3 und 5 zweimal), Joker auf 2–5;
 * die normalen Symbole 1–5× je Walze. Kein Symbol zweimal im selben sichtbaren Fenster, Sonder-Symbole nie zu zweit.
 * Gefunden mit `node tools/calibrate-strips.mjs --search` (Seed 1), Kennzahlen mit `node tools/calibrate-strips.mjs`
 * (10 Linien, gleichverteilte Stopps; Basisspiel exakt über alle 22⁵ Stoppkombinationen):
 *   Quote ohne Jackpot 89,2 % (Monte Carlo, 2 Mio. Drehungen; exakt + MC-Bonus 89,4 %)
 *   = Linien 59,8 % + Freispiele 20,3 % + Glücksrad 9,0 %; dazu 5 % Jackpot-Einspeisung.
 *   Freispiel-Auslöser 4,49 % (3 / 4 / 5 Bonus: 1 von 25 / 224 / 5033), Glücksrad 1,43 %,
 *   Trefferquote 24,5 % (exakt, inkl. Features), Jackpot ≈ 1 von 32 000 (Basisspiel).
 *   Mit 4 sichtbaren von 22 Feldern ist jedes Bonus-Symbol in 2/11 der Stopps zu sehen; damit 5 Bonus möglich sind,
 *   steht Bonus auf allen fünf Walzen – das legt den Auslöser zwangsläufig auf ≈ 4,5 % (≥ 3 von 5).
 * @type {number[][]}
 */
export const REEL_STRIPS = [
  [S7, PF, ZI, ME, BAR, PF, KI, S7, ST, ME, BAR, B, KI, PF, ME, OR, K, ZI, GL, KI, OR, D],
  [GL, PF, S7, ME, ZI, PF, K, KI, ZI, PF, OR, ME, D, BAR, GL, PF, KI, B, ZI, PF, ST, J],
  [BAR, ZI, GL, PF, K, BAR, ME, PF, D, ZI, ST, ME, PF, B, S7, KI, PF, K, OR, KI, PF, J],
  [ST, ME, OR, GL, ZI, K, OR, ME, ZI, PF, D, S7, OR, BAR, ST, KI, OR, B, ST, ZI, OR, J],
  [BAR, S7, ME, B, ST, PF, ME, K, S7, ST, ZI, ME, KI, K, BAR, ME, GL, J, BAR, OR, ST, D]
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
