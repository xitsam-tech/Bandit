// Linienaufbau, Auswertung und Klebe-Joker-Hilfen (reine Logik, ohne DOM/THREE).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLines, coveredRows, evaluate, heldReels } from '../../js/core/lines.js';
import { PAY, JOKER, SCATTER, DIAMOND, CLOVER, WHEEL_MIN, ROWS, COLS } from '../../js/core/config.js';

const NONE4 = [false, false, false, false];
const fill = v => Array.from({ length: ROWS }, () => Array(COLS).fill(v));
const row1 = buildLines([true, false, false, false], [false, false, false]);

test('buildLines: ein Paar spielt 4 Linien (beide Reihen gerade + 2× Zickzack)', () => {
  const L = buildLines(NONE4, [false, false, true]);
  assert.equal(L.length, 4);
  assert.ok(L.some(l => l.pat.every(v => v === 3)), 'Reihe 4 enthalten');
  assert.ok(L.some(l => l.pat.every(v => v === 2)), 'Reihe 3 enthalten');
  assert.deepEqual(L.filter(l => l.name.startsWith('Zickzack')).map(l => l.pat.join('')).sort(), ['23232', '32323']);
});

test('buildLines: alle Paare = 10 Linien, alle Muster verschieden', () => {
  const L = buildLines(NONE4, [true, true, true]);
  assert.equal(L.length, 10);
  assert.equal(new Set(L.map(l => l.pat.join(''))).size, 10);
});

test('buildLines: Einzelreihen allein und ohne Duplikate unter Paaren', () => {
  assert.equal(buildLines([true, true, true, true], [false, false, false]).length, 4);
  assert.equal(buildLines([true, false, false, false], [true, false, false]).length, 4);
  assert.equal(buildLines([false, true, true, false], [true, false, true]).length, 8);
  assert.equal(buildLines(NONE4, [false, false, false]).length, 0);
});

test('buildLines: sortiert nach Name, Farben zugeteilt', () => {
  const L = buildLines(NONE4, [true, true, true]);
  const names = L.map(l => l.name);
  assert.deepEqual(names, [...names].sort((x, y) => (x > y ? 1 : -1)));
  assert.ok(L.every(l => typeof l.color === 'string' && l.color.startsWith('#')));
});

test('coveredRows: Paare decken ihre beiden Reihen ab', () => {
  assert.deepEqual(coveredRows([true, false, false]), [true, true, false, false]);
  assert.deepEqual(coveredRows([false, false, true]), [false, false, true, true]);
  assert.deepEqual(coveredRows([false, false, false]), [false, false, false, false]);
});

test('evaluate: 5 gleiche zahlen den 5er-Wert', () => {
  assert.equal(evaluate(fill(2), row1).lineTotal, PAY[2][2]);
  const r = evaluate(fill(2), row1);
  assert.equal(r.wins.length, 1);
  assert.deepEqual(r.wins[0].cells, [0, 1, 2, 3, 4].map(c => ({ r: 0, c })));
});

test('evaluate: Joker ersetzt (J J 🍒 🍒 🍒 = 5× Kirsche)', () => {
  const m = fill(1); m[0] = [JOKER, JOKER, 0, 0, 0];
  assert.equal(evaluate(m, row1).lineTotal, PAY[0][2]);
});

test('evaluate: 3 Joker vs. 4 gleiche – der höhere Gewinn zählt', () => {
  const m = fill(1); m[0] = [JOKER, JOKER, JOKER, 4, 5];
  const r = evaluate(m, row1);
  assert.equal(r.lineTotal, Math.max(PAY[JOKER][0], PAY[4][1]));
  // umgekehrt: 4 gleiche mit höherem Wert schlagen 3 Joker
  const m2 = fill(1); m2[0] = [JOKER, JOKER, JOKER, 8, 1];
  assert.equal(evaluate(m2, row1).lineTotal, Math.max(PAY[JOKER][0], PAY[8][1]));
});

test('evaluate: 5 Joker zahlen den Joker-5er', () => {
  const m = fill(1); m[0] = Array(5).fill(JOKER);
  assert.equal(evaluate(m, row1).lineTotal, PAY[JOKER][2]);
});

test('evaluate: Joker ersetzt kein Bonus-Symbol (Scatter)', () => {
  const m = fill(1); m[0] = [SCATTER, JOKER, JOKER, JOKER, 0];
  const r = evaluate(m, row1);
  assert.ok(r.wins.every(w => w.sym !== SCATTER));
});

test('evaluate: Scatter wird überall gezählt', () => {
  const m = fill(1); m[0][0] = m[1][2] = m[3][4] = SCATTER;
  const r = evaluate(m, row1);
  assert.equal(r.scatter.count, 3);
  assert.deepEqual(r.scatter.cells, [{ r: 0, c: 0 }, { r: 1, c: 2 }, { r: 3, c: 4 }]);
});

test('evaluate: 5× Diamant (auch mit Joker) = Jackpot, 4× Diamant normaler Gewinn', () => {
  const m = fill(1); m[0] = [DIAMOND, DIAMOND, JOKER, DIAMOND, DIAMOND];
  const r = evaluate(m, row1);
  assert.equal(r.jackpot, true);
  assert.equal(r.wins[0].jackpot, true);
  assert.equal(r.lineTotal, 0, 'Jackpot zahlt aus dem Topf, nicht über PAY');
  const m4 = fill(1); m4[0] = [DIAMOND, DIAMOND, DIAMOND, DIAMOND, 0];
  const r4 = evaluate(m4, row1);
  assert.equal(r4.jackpot, false);
  assert.equal(r4.lineTotal, PAY[DIAMOND][1]);
});

test('evaluate: nur 2 in Folge zahlt nichts; Gewinn zählt nur von links', () => {
  const m = fill(1); m[0] = [0, 0, 4, 0, 0];
  assert.equal(evaluate(m, row1).lineTotal, 0);
  const m2 = fill(1); m2[0] = [4, 0, 0, 0, 0];
  assert.equal(evaluate(m2, row1).lineTotal, 0);
});

test('evaluate: 4× Klee irgendwo zählt fürs Glücksrad', () => {
  const m = fill(1); m[0][0] = m[1][1] = m[2][3] = m[3][4] = CLOVER;
  assert.ok(evaluate(m, row1).clover.count >= WHEEL_MIN);
});

test('evaluate: Zickzack-Linie liest die richtigen Felder', () => {
  const L = buildLines(NONE4, [true, false, false]).filter(l => l.pat.join('') === '01010');
  const m = fill(1); m[0][0] = m[1][1] = m[0][2] = 5;
  const r = evaluate(m, L);
  assert.equal(r.lineTotal, PAY[5][0]);
  assert.deepEqual(r.wins[0].cells, [{ r: 0, c: 0 }, { r: 1, c: 1 }, { r: 0, c: 2 }]);
});

test('heldReels: Walzen mit Klebe-Joker werden gehalten', () => {
  assert.deepEqual(heldReels([1, 7, 13]), [false, true, true, true, false]);
  assert.deepEqual(heldReels([]), [false, false, false, false, false]);
  assert.deepEqual(heldReels([0, 5, 10, 15]), [true, false, false, false, false]);
});
