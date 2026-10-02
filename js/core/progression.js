// @ts-check
/** Level-Fortschritt: XP-Schwelle pro Level. */

/** XP, die für das nächste Level nötig sind. @type {(level: number) => number} */
export const xpNeed = l => Math.round(40 * Math.pow(l, 1.4));
