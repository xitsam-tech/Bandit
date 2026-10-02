// @ts-check
/** Zufall: kryptografischer Zufall, gewichtete Symbolwahl, Zufallsmatrix. Für Tests sind Zufallsquelle und Matrix-Lieferant austauschbar. */
import { COLS, ROWS, WEIGHTS } from './config.js';

export function rand(){
  try { const u = new Uint32Array(1); crypto.getRandomValues(u); return u[0] / 4294967296; }
  catch(e){ return Math.random(); }
}
const W_TOTAL = WEIGHTS.reduce((a, b) => a + b, 0);
export function sampleSymbol(){
  let r = rand() * W_TOTAL;
  for (let i = 0; i < WEIGHTS.length; i++){ r -= WEIGHTS[i]; if (r < 0) return i; }
  return 0;
}
export function randomMatrix(){
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, sampleSymbol));
}
