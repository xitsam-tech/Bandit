// @ts-check
/** Gewinnlinien und Auswertung einer 4×5-Matrix; Klebe-Joker-Hilfen. */
import { BET_STEPS, CLOVER, COLS, DIAMOND, JOKER, PAY, SCATTER } from './config.js';
import { S } from './state.js';

/**
 * @typedef {{ pat: number[], name: string, color?: string }} Line  pat[c] = Reihe auf Walze c
 * @typedef {{ r: number, c: number }} Cell
 * @typedef {{ sym: number, count: number, pay: number, jackpot?: boolean, line?: Line, cells?: Cell[] }} LineWin
 * @typedef {{ count: number, cells: Cell[] }} SymbolCount
 * @typedef {{ wins: LineWin[], jackpot: boolean, lineTotal: number, scatter: SymbolCount, clover: SymbolCount }} EvalResult
 */

/* =========================================================
   Linien & Auswertung
   ========================================================= */
const LINE_COLORS = ['#ffc83a','#35e2ff','#ff3d9a','#7dff9b','#c79bff','#ff9d4d','#5ec8ff','#ff6f91','#d4ff5e','#ffe27a'];
/**
 * Aktive Linien aus Einzelreihen und Paaren (Duplikate entfallen, nach Name sortiert, Farben zugeteilt).
 * @param {boolean[]} [singles]
 * @param {boolean[]} [pairs]
 * @returns {Line[]}
 */
export function buildLines(singles = S.singles, pairs = S.pairs){
  /** @type {Map<string, Line>} */
  const map = new Map();
  /** @type {(pat: number[], name: string) => void} */
  const add = (pat, name) => { const k = pat.join(''); if (!map.has(k)) map.set(k, { pat, name }); };
  pairs.forEach((on, i) => { if (!on) return; add([i,i,i,i,i], `Reihe ${i+1}`); add([i+1,i+1,i+1,i+1,i+1], `Reihe ${i+2}`); });
  singles.forEach((on, r) => { if (on) add([r,r,r,r,r], `Reihe ${r+1}`); });
  pairs.forEach((on, i) => {
    if (!on) return; const a = i, b = i + 1;
    add([a,b,a,b,a], `Zickzack ${a+1}–${b+1}`);
    add([b,a,b,a,b], `Zickzack ${b+1}–${a+1}`);
  });
  const lines = Array.from(map.values()).sort((x, y) => (x.name > y.name ? 1 : -1));
  lines.forEach((l, i) => l.color = LINE_COLORS[i % LINE_COLORS.length]);
  return lines;
}
/** Reihen, die schon über ein Paar aktiv sind. @param {boolean[]} [pairs] @returns {boolean[]} */
export function coveredRows(pairs = S.pairs){
  const c = [false,false,false,false];
  pairs.forEach((on, i) => { if (on){ c[i] = true; c[i+1] = true; } });
  return c;
}
/** Linien des laufenden Spiels (in Freispielen die eingefrorenen). @returns {Line[]} */
export function activeLines(){ return S.freeSpins > 0 && S.fsLines ? S.fsLines : buildLines(); }
/** Einsatz pro Linie (in Freispielen der eingefrorene). @returns {number} */
export function betValue(){ return BET_STEPS[S.freeSpins > 0 ? S.fsBetIdx : S.betIdx]; }
/** Gesamteinsatz eines bezahlten Drehs. @returns {number} */
export function spinCost(){ return BET_STEPS[S.betIdx] * buildLines().length; }

/**
 * Wertet eine Matrix auf den gegebenen Linien aus (von links, Joker ersetzt alles außer Bonus; pro Linie zählt der höchste Gewinn).
 * Bonus (Scatter) und Klee werden überall gezählt.
 * @param {number[][]} m 4×5-Matrix
 * @param {Line[]} lines
 * @returns {EvalResult}
 */
export function evaluate(m, lines){
  /** @type {LineWin[]} */
  const wins = []; let jackpot = false, lineTotal = 0;
  for (const L of lines){
    const seq = L.pat.map((r, c) => m[r][c]);
    /** @type {LineWin | null} */
    let best = null;
    let jk = 0; while (jk < 5 && seq[jk] === JOKER) jk++;
    if (jk >= 3) best = { sym: JOKER, count: jk, pay: PAY[JOKER][jk - 3] };
    const base = seq.find(v => v !== JOKER);
    if (base !== undefined && base !== SCATTER){
      let k = 0; while (k < 5 && (seq[k] === base || seq[k] === JOKER)) k++;
      if (base === DIAMOND && k === 5){ jackpot = true; best = { sym: DIAMOND, count: 5, pay: 0, jackpot: true }; }
      else if (k >= 3){ const p = PAY[base][k - 3]; if (!best || p > best.pay) best = { sym: base, count: k, pay: p }; }
    }
    if (best){
      best.line = L;
      best.cells = L.pat.slice(0, best.count).map((r, c) => ({ r, c }));
      wins.push(best); lineTotal += best.pay;
    }
  }
  /** @type {Cell[]} */
  const scatterCells = [];
  /** @type {Cell[]} */
  const cloverCells = [];
  m.forEach((row, r) => row.forEach((v, c) => { if (v === SCATTER) scatterCells.push({ r, c }); if (v === CLOVER) cloverCells.push({ r, c }); }));
  return { wins, jackpot, lineTotal, scatter: { count: scatterCells.length, cells: scatterCells }, clover: { count: cloverCells.length, cells: cloverCells } };
}

/** Walzen, die wegen Klebe-Jokern gehalten werden. @param {number[]} keys Feldnummern r*COLS+c @returns {boolean[]} */
export function heldReels(keys){ const h = [false,false,false,false,false]; keys.forEach(k => { h[k % COLS] = true; }); return h; }
/** Klebe-Joker in die Matrix schreiben (verändert m). @param {number[][]} m @param {number[]} keys @returns {number[][]} */
export function applySticky(m, keys){ keys.forEach(k => { m[Math.floor(k / COLS)][k % COLS] = JOKER; }); return m; }
