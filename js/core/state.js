// @ts-check
/** Persistenter Spielzustand S sowie Laden/Speichern (localStorage bzw. Hot-Reload-Daten). */
import { BET_STEPS, COLS, JOKER, JP_MAX, JP_SEED, ROWS, START_CREDITS, STORE_KEY } from './config.js';
import { matrixFromStops, validStops } from './strips.js';
import { clamp } from './util.js';

/**
 * @typedef {import('./lines.js').Line} Line
 * @typedef {{ free: boolean, lines: Line[], betIdx: number, held?: boolean[], stops?: number[] }} SpinCtx  stops: Ziel-Stopppositionen
 * @typedef {{ w: number, k: string }} HistoryEntry
 * @typedef {{ spins: number, wagered: number, won: number, biggest: number, fsTriggers: number, jackpots: number, wheels: number, gambleNet: number }} Stats
 * @typedef {object} State
 * @property {number} credits
 * @property {number} betIdx
 * @property {boolean[]} singles
 * @property {boolean[]} pairs
 * @property {number} jackpot
 * @property {boolean} sound
 * @property {boolean} showLines
 * @property {number} freeSpins
 * @property {number} fsBetIdx
 * @property {Line[] | null} fsLines
 * @property {number} fsWon
 * @property {Stats} stats
 * @property {number[] | null} stops       Stopppositionen der Walzen (während eines Drehs: dessen Ziel)
 * @property {number[][] | null} matrix    daraus abgeleitete sichtbare Matrix (nur Anzeige/Kompatibilität)
 * @property {number[]} sticky
 * @property {number} level
 * @property {number} xp
 * @property {boolean} music
 * @property {boolean} turbo
 * @property {HistoryEntry[]} history
 * @property {SpinCtx | null} pending
 * @property {string} cabinet
 * @property {number} brightness
 * @property {number} gambleRefund
 * @property {{ stake: number } | null} wheelPending
 * @property {string} view
 */

/* =========================================================
   Zustand & Speicher
   ========================================================= */
/** Spielzustand; wird nach jeder Änderung gespeichert. @type {State} */
export const S = {
  credits: START_CREDITS,
  betIdx: 2,
  singles: [false,false,false,false],
  pairs: [true,true,true],
  jackpot: JP_SEED,
  sound: true,
  showLines: false,
  freeSpins: 0, fsBetIdx: 2, fsLines: null, fsWon: 0,
  stats: { spins:0, wagered:0, won:0, biggest:0, fsTriggers:0, jackpots:0, wheels:0, gambleNet:0 },
  stops: null, matrix: null,
  sticky: [], level: 1, xp: 0, music: false, turbo: false, history: [], pending: null, cabinet: 'neon', brightness: 0.85, gambleRefund: 0, wheelPending: null, view: '3d'
};

/**
 * Zustand aus Hot-Reload-Daten oder localStorage übernehmen (nur gültige Werte).
 * @param {{ state?: any }} [extra]
 */
export function loadState(extra){
  /** @type {any} */
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch(e){}
  const src = (extra && extra.state) || saved;
  if (!src || typeof src !== 'object') return;
  if (Number.isFinite(src.credits)) S.credits = Math.max(0, src.credits);
  if (Number.isInteger(src.betIdx)) S.betIdx = clamp(src.betIdx, 0, BET_STEPS.length - 1);
  if (Array.isArray(src.singles) && src.singles.length === 4) S.singles = src.singles.map(Boolean);
  if (Array.isArray(src.pairs) && src.pairs.length === 3) S.pairs = src.pairs.map(Boolean);
  if (Number.isFinite(src.jackpot)) S.jackpot = clamp(src.jackpot, JP_SEED, JP_MAX);
  if (typeof src.sound === 'boolean') S.sound = src.sound;
  if (typeof src.showLines === 'boolean') S.showLines = src.showLines;
  /** @type {(a: any[]) => number[]} */
  const validKeys = a => a.filter(k => Number.isInteger(k) && k >= 0 && k < ROWS * COLS);
  const hasFsLines = Array.isArray(src.fsLines) && src.fsLines.length > 0;
  const restoreFs = () => { S.fsLines = src.fsLines; S.fsBetIdx = clamp(src.fsBetIdx|0, 0, BET_STEPS.length - 1); S.fsWon = +src.fsWon || 0; };
  if (Number.isInteger(src.freeSpins) && src.freeSpins > 0 && hasFsLines){ S.freeSpins = src.freeSpins; restoreFs(); }
  if (src.stats && typeof src.stats === 'object') Object.assign(S.stats, src.stats);
  if (Array.isArray(src.sticky) && S.freeSpins > 0) S.sticky = validKeys(src.sticky);
  if (Number.isInteger(src.level) && src.level > 0) S.level = src.level;
  if (Number.isFinite(src.xp) && src.xp >= 0) S.xp = src.xp;
  if (typeof src.music === 'boolean') S.music = src.music;
  if (typeof src.turbo === 'boolean') S.turbo = src.turbo;
  if (['3d', 'front', 'turn'].includes(src.view)) S.view = src.view;
  if (['neon', 'wood', 'piano', 'glass'].includes(src.cabinet)) S.cabinet = src.cabinet;
  if (Number.isFinite(src.brightness)) S.brightness = clamp(src.brightness, 0.5, 1.2);
  // Unterbrochene Risikoentscheidung / Glücksrad: Einsatz bzw. Rad nach dem Neuladen nicht verlieren
  if (Number.isFinite(src.gambleRefund) && src.gambleRefund > 0) S.gambleRefund = src.gambleRefund;
  if (src.wheelPending && Number.isFinite(src.wheelPending.stake) && src.wheelPending.stake > 0) S.wheelPending = { stake: src.wheelPending.stake };
  if (Array.isArray(src.history)) S.history = src.history.slice(0, 14);
  // Walzenstand: Stopppositionen (ältere Spielstände mit nur `matrix` → kein Stand, main.js wählt Startpositionen)
  if (validStops(src.stops)) setStops(src.stops);
  const p = src.pending;
  if (p && Array.isArray(p.lines) && p.lines.length && Number.isInteger(p.betIdx)){
    S.pending = { free: !!p.free, lines: p.lines, betIdx: clamp(p.betIdx, 0, BET_STEPS.length - 1), held: Array.isArray(p.held) ? p.held.map(Boolean) : undefined,
      stops: validStops(p.stops) ? p.stops.slice() : undefined };
    if (S.pending.stops) setStops(S.pending.stops);
    // Unterbrochenes Freispiel: Klebe-Joker und Linien auch dann zurückholen, wenn freeSpins schon 0 war
    if (p.free && Array.isArray(src.sticky)) S.sticky = validKeys(src.sticky);
    if (p.free && hasFsLines) restoreFs();
  }
  if (S.stops) pruneSticky();
}
/** Walzenstand setzen (Stopppositionen + abgeleitete Matrix). @param {number[]} stops */
export function setStops(stops){ S.stops = stops.slice(); S.matrix = matrixFromStops(S.stops); }
/** Klebe-Joker nur dort behalten, wo die Walzen wirklich einen Joker zeigen (z. B. nach altem Spielstand). */
export function pruneSticky(){
  const m = S.matrix;
  S.sticky = m ? S.sticky.filter(k => m[Math.floor(k / COLS)][k % COLS] === JOKER) : [];
}
/** Speicherbares Abbild des Zustands. */
export function snapshot(){
  return {
    credits:S.credits, betIdx:S.betIdx, singles:S.singles, pairs:S.pairs, jackpot:S.jackpot,
    sound:S.sound, showLines:S.showLines, freeSpins:S.freeSpins, fsBetIdx:S.fsBetIdx,
    fsLines:S.fsLines, fsWon:S.fsWon, stats:S.stats, stops:S.stops, matrix:S.matrix,
    sticky:S.sticky, level:S.level, xp:S.xp, music:S.music, turbo:S.turbo, view:S.view, history:S.history, pending:S.pending, cabinet:S.cabinet,
    brightness:S.brightness, gambleRefund:S.gambleRefund, wheelPending:S.wheelPending
  };
}
/** Zustand in localStorage sichern (Fehler werden ignoriert). */
export function saveState(){ try { localStorage.setItem(STORE_KEY, JSON.stringify(snapshot())); } catch(e){} }
