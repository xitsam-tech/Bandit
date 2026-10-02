// @ts-check
/** Zufall: kryptografischer Zufall, gewichtete Symbolwahl, Zufallsmatrix. Für Tests sind Zufallsquelle und Matrix-Lieferant austauschbar. */
import { COLS, ROWS, WEIGHTS } from './config.js';

/** @typedef {number[][]} Matrix  4×5, Werte = Symbol-Index */

/** @type {null | (() => number)} Testzugang: ersetzt die Zufallsquelle (z. B. seed-fester Generator). */
let source = null;
/** @type {null | (() => Matrix)} Testzugang: ersetzt den Matrix-Lieferanten (alle Aufrufe von randomMatrix). */
let matrixSource = null;

/** Gleichverteilte Zufallszahl in [0, 1). */
export function rand(){
  if (source) return source();
  try { const u = new Uint32Array(1); crypto.getRandomValues(u); return u[0] / 4294967296; }
  catch(e){ return Math.random(); }
}
const W_TOTAL = WEIGHTS.reduce((a, b) => a + b, 0);
/** Ein Symbol gemäß WEIGHTS ziehen. @returns {number} */
export function sampleSymbol(){
  let r = rand() * W_TOTAL;
  for (let i = 0; i < WEIGHTS.length; i++){ r -= WEIGHTS[i]; if (r < 0) return i; }
  return 0;
}
/** Neue Zufallsmatrix nach WEIGHTS (ignoriert einen gesetzten Matrix-Lieferanten). @returns {Matrix} */
export function defaultRandomMatrix(){
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, sampleSymbol));
}
/** Matrix für einen Dreh: der gesetzte Lieferant (Tests) oder defaultRandomMatrix(). @returns {Matrix} */
export function randomMatrix(){
  return matrixSource ? matrixSource() : defaultRandomMatrix();
}

/** Zufallsquelle ersetzen (`null` = wieder kryptografischer Zufall). @param {null | (() => number)} fn */
export function setRandomSource(fn){ source = fn; }
/** Matrix-Lieferanten ersetzen (`null` = wieder Zufall). @param {null | (() => Matrix)} fn */
export function setMatrixSource(fn){ matrixSource = fn; }

/**
 * Seed-fester Generator (mulberry32) für reproduzierbare Tests.
 * @param {number} seed
 * @returns {() => number}
 */
export function seededRandom(seed){
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
