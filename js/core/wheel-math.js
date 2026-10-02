// @ts-check
/** Glücksrad-Geometrie: Feld unter dem Zeiger und Zielwinkel für ein gezogenes Feld. */
import { WHEEL } from './config.js';
import { mod } from './util.js';

export function wheelIndexAt(phi){ const seg = Math.PI * 2 / WHEEL.length; return mod(Math.round(phi / seg), WHEEL.length); }
export function wheelTarget(phi, idx, jitter, turns){ const seg = Math.PI * 2 / WHEEL.length; return phi - mod(phi, Math.PI * 2) + Math.PI * 2 * turns + idx * seg + jitter; }
