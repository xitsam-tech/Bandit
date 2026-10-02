// @ts-check
/** Glücksrad-Geometrie: Feld unter dem Zeiger und Zielwinkel für ein gezogenes Feld. */
import { WHEEL } from './config.js';
import { mod } from './util.js';

/**
 * Index des Feldes unter dem Zeiger bei Drehwinkel phi.
 * @param {number} phi
 * @returns {number}
 */
export function wheelIndexAt(phi){ const seg = Math.PI * 2 / WHEEL.length; return mod(Math.round(phi / seg), WHEEL.length); }
/**
 * Zielwinkel, bei dem das Rad nach `turns` vollen Umdrehungen auf Feld `idx` stehen bleibt (± jitter innerhalb des Feldes).
 * @param {number} phi aktueller Winkel
 * @param {number} idx gezogenes Feld
 * @param {number} jitter Versatz im Feld (|jitter| < halbe Feldbreite)
 * @param {number} turns volle Umdrehungen
 * @returns {number}
 */
export function wheelTarget(phi, idx, jitter, turns){ const seg = Math.PI * 2 / WHEEL.length; return phi - mod(phi, Math.PI * 2) + Math.PI * 2 * turns + idx * seg + jitter; }
