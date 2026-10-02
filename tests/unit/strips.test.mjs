// Feste Walzenstreifen: Aufbau, Matrix aus Stopppositionen, Suche nach Stopppositionen, Erreichbarkeit der Testszenarien.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLOVER, COLS, DIAMOND, JOKER, ROWS, SCATTER, SYMBOLS } from '../../js/core/config.js';
import { REEL_STRIPS, START_STOPS, STRIP_LEN, checkStrips, findStops, matrixFromStops, validStops } from '../../js/core/strips.js';
import { buildLines, evaluate } from '../../js/core/lines.js';

test('REEL_STRIPS: 5 Walzen mit je STRIP_LEN gültigen Symbolen, alle verschieden', () => {
  assert.equal(STRIP_LEN, 16);
  assert.equal(REEL_STRIPS.length, COLS);
  REEL_STRIPS.forEach(s => {
    assert.equal(s.length, STRIP_LEN);
    assert.ok(s.every(v => Number.isInteger(v) && v >= 0 && v < SYMBOLS.length));
  });
  assert.equal(new Set(REEL_STRIPS.map(s => s.join())).size, COLS, 'jede Walze hat eine andere Reihenfolge');
  assert.deepEqual(checkStrips(), []);
});

test('REEL_STRIPS: kein Symbol zweimal im selben sichtbaren Fenster (keine Klumpen)', () => {
  REEL_STRIPS.forEach((s, c) => {
    for (let p = 0; p < STRIP_LEN; p++){
      const win = Array.from({ length: ROWS }, (_, r) => s[(p + r) % STRIP_LEN]);
      assert.equal(new Set(win).size, ROWS, `Walze ${c + 1}, Stopp ${p}: ${win}`);
    }
  });
});

test('REEL_STRIPS: Sonder-Symbole wie kalibriert (Bonus 1/3/5, Klee überall, Joker 2–4, Diamant 1/3/5)', () => {
  const count = (/** @type {number} */ c, /** @type {number} */ v) => REEL_STRIPS[c].filter(x => x === v).length;
  assert.deepEqual([0, 1, 2, 3, 4].map(c => count(c, SCATTER)), [1, 0, 1, 0, 1]);
  assert.deepEqual([0, 1, 2, 3, 4].map(c => count(c, CLOVER)), [1, 1, 1, 1, 1]);
  assert.deepEqual([0, 1, 2, 3, 4].map(c => count(c, JOKER)), [0, 1, 1, 1, 0]);
  assert.deepEqual([0, 1, 2, 3, 4].map(c => count(c, DIAMOND)), [1, 0, 1, 0, 1]);
});

test('matrixFromStops: Reihe r zeigt Streifenfeld (p + r) mod N, Reihe 0 oben, mit Umlauf', () => {
  const stops = [0, 3, 13, 14, 15];
  const m = matrixFromStops(stops);
  assert.equal(m.length, ROWS); assert.ok(m.every(row => row.length === COLS));
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) assert.equal(m[r][c], REEL_STRIPS[c][(stops[c] + r) % STRIP_LEN]);
  // Umlauf: Stopp 15 zeigt die Felder 15, 0, 1, 2
  assert.deepEqual(m.map(row => row[4]), [15, 0, 1, 2].map(i => REEL_STRIPS[4][i]));
  // aufeinanderfolgende Stopps verschieben das Bild um genau eine Reihe
  const a = matrixFromStops([5, 5, 5, 5, 5]), b = matrixFromStops([6, 6, 6, 6, 6]);
  for (let r = 0; r < ROWS - 1; r++) assert.deepEqual(b[r], a[r + 1]);
});

test('validStops: nur 5 ganze Zahlen in 0..N-1', () => {
  assert.equal(validStops(START_STOPS), true);
  assert.equal(validStops([0, 1, 2, 3, 15]), true);
  for (const bad of [null, [0, 1, 2, 3], [0, 1, 2, 3, 16], [0, 1, 2, 3, -1], [0, 1, 2, 3, 1.5], 'x', [0, 1, 2, 3, '4']]) assert.equal(validStops(bad), false, JSON.stringify(bad));
});

test('findStops: findet passende Stopps, respektiert feste Walzen, null wenn unmöglich', () => {
  const sc = findStops(m => m[0][0] === SCATTER && m[1][2] === SCATTER && m[2][4] === SCATTER);
  assert.ok(sc && validStops(sc));
  const m = matrixFromStops(/** @type {number[]} */ (sc));
  assert.equal(m[0][0], SCATTER); assert.equal(m[1][2], SCATTER); assert.equal(m[2][4], SCATTER);
  const fx = findStops(mm => mm[3][0] !== JOKER, { fixed: [null, 7, null, 2, null] });
  assert.ok(fx); assert.equal(fx[1], 7); assert.equal(fx[3], 2);
  assert.equal(findStops(mm => mm[0][0] === JOKER), null, 'Walze 1 hat keinen Joker');
});

test('Testszenarien sind auf den Streifen erreichbar', () => {
  const lines = buildLines([false, false, false, false], [true, true, true]);
  // Freispiele: Joker auf (0,1) und (1,2) → Walzen 2 und 3 gehalten
  assert.ok(findStops(m => m[0][1] === JOKER && m[1][2] === JOKER));
  // drei Joker-Walzen gleichzeitig gehalten
  assert.ok(findStops(m => [1, 2, 3].every(c => m.some(row => row[c] === JOKER))));
  // Glücksrad: 5× Klee
  assert.ok(findStops(m => m.flat().filter(v => v === CLOVER).length === 5));
  // Mega Win (≥ 25× Gesamteinsatz bei 10 Linien) und Jackpot
  assert.ok(findStops(m => evaluate(m, lines).lineTotal >= 25 * lines.length));
  assert.ok(findStops(m => evaluate(m, lines).jackpot));
  // Kein Gewinn
  assert.ok(findStops(m => { const r = evaluate(m, lines); return r.lineTotal === 0 && r.scatter.count < 3 && r.clover.count < 4; }));
});
