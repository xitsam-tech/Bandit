// @ts-check
/**
 * Zufall: kryptografischer Zufall und Stopppositionen der Walzen.
 * Der Zufall wählt pro Walze nur eine Stoppposition auf ihrem festen Streifen (gleichverteilt).
 * Für Tests sind Zufallsquelle und Stopp-Lieferant austauschbar.
 */
import { COLS } from './config.js';
import { STRIP_LEN, validStops } from './strips.js';

/** @type {null | (() => number)} Testzugang: ersetzt die Zufallsquelle (z. B. seed-fester Generator). */
let source = null;
/** @type {null | (() => number[])} Testzugang: liefert die Stopppositionen des nächsten Drehs. */
let stopSource = null;

/** Gleichverteilte Zufallszahl in [0, 1). */
export function rand(){
  if (source) return source();
  try { const u = new Uint32Array(1); crypto.getRandomValues(u); return u[0] / 4294967296; }
  catch(e){ return Math.random(); }
}
/** Zufällige Stopppositionen (je Walze gleichverteilt 0..STRIP_LEN-1). @param {() => number} [rnd] @returns {number[]} */
export function randomStops(rnd = rand){
  return Array.from({ length: COLS }, () => Math.floor(rnd() * STRIP_LEN));
}
/** Stopppositionen für einen Dreh: der gesetzte Lieferant (Tests) oder randomStops(). @returns {number[]} */
export function nextStops(){
  if (stopSource){
    const s = stopSource();
    if (validStops(s)) return s.slice();
    console.warn('Stopp-Lieferant: ungültige Stopppositionen', s);
  }
  return randomStops();
}

/** Zufallsquelle ersetzen (`null` = wieder kryptografischer Zufall). @param {null | (() => number)} fn */
export function setRandomSource(fn){ source = fn; }
/** Stopp-Lieferanten ersetzen (`null` = wieder Zufall). @param {null | (() => number[])} fn */
export function setStopSource(fn){ stopSource = fn; }

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
