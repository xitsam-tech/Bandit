// Laden/Speichern des Zustands: nur gültige Werte werden übernommen (ohne localStorage in Node).
import test from 'node:test';
import assert from 'node:assert/strict';
import { S, loadState, pruneSticky, setStops, snapshot } from '../../js/core/state.js';
import { findStops, matrixFromStops } from '../../js/core/strips.js';
import { JP_SEED, JP_MAX, BET_STEPS, JOKER } from '../../js/core/config.js';

const fresh = JSON.parse(JSON.stringify(snapshot()));
const reset = () => { Object.assign(S, JSON.parse(JSON.stringify(fresh))); };

test('loadState übernimmt gültige Werte aus Hot-Reload-Daten', () => {
  reset();
  loadState({ state: { credits: 42.5, betIdx: 4, jackpot: 300, level: 3, xp: 12, cabinet: 'glass', view: 'front', brightness: 1.1 } });
  assert.equal(S.credits, 42.5); assert.equal(S.betIdx, 4); assert.equal(S.jackpot, 300);
  assert.equal(S.level, 3); assert.equal(S.xp, 12); assert.equal(S.cabinet, 'glass'); assert.equal(S.view, 'front'); assert.equal(S.brightness, 1.1);
});

test('loadState begrenzt bzw. verwirft ungültige Werte', () => {
  reset();
  loadState({ state: { credits: -5, betIdx: 99, jackpot: 1e9, cabinet: 'gold', view: 'x', brightness: 9, matrix: [[1, 2]], level: 0 } });
  assert.equal(S.credits, 0); assert.equal(S.betIdx, BET_STEPS.length - 1); assert.equal(S.jackpot, JP_MAX);
  assert.equal(S.cabinet, 'neon'); assert.equal(S.view, '3d'); assert.equal(S.brightness, 1.2); assert.equal(S.matrix, null); assert.equal(S.level, 1);
  reset();
  loadState({ state: { jackpot: 1 } });
  assert.equal(S.jackpot, JP_SEED);
});

test('loadState: Freispiele nur mit Linien, Klebe-Joker nur mit Freispielen', () => {
  reset();
  loadState({ state: { freeSpins: 3, sticky: [1, 2] } });
  assert.equal(S.freeSpins, 0); assert.deepEqual(S.sticky, []);
  reset();
  const lines = [{ pat: [0, 0, 0, 0, 0], name: 'Reihe 1' }];
  loadState({ state: { freeSpins: 3, fsLines: lines, fsBetIdx: 1, sticky: [1, 2, 99, -1, 1.5] } });
  assert.equal(S.freeSpins, 3); assert.equal(S.fsLines, lines); assert.equal(S.fsBetIdx, 1); assert.deepEqual(S.sticky, [1, 2]);
});

test('loadState: Stopppositionen werden übernommen, Matrix daraus abgeleitet', () => {
  reset();
  loadState({ state: { stops: [1, 2, 3, 4, 5], matrix: Array.from({ length: 4 }, () => Array(5).fill(3)) } });
  assert.deepEqual(S.stops, [1, 2, 3, 4, 5]);
  assert.deepEqual(S.matrix, matrixFromStops([1, 2, 3, 4, 5]), 'Matrix kommt aus den Stopps, nicht aus dem Speicher');
  reset();
});

test('loadState: unterbrochener Dreh mit Ziel-Stopppositionen', () => {
  reset();
  const lines = [{ pat: [0, 0, 0, 0, 0], name: 'Reihe 1' }];
  loadState({ state: { stops: [9, 9, 9, 9, 9], pending: { free: false, lines, betIdx: 2, stops: [0, 1, 2, 3, 4] } } });
  assert.equal(S.pending.betIdx, 2); assert.equal(S.pending.free, false);
  assert.deepEqual(S.pending.stops, [0, 1, 2, 3, 4]);
  assert.deepEqual(S.stops, [0, 1, 2, 3, 4], 'Walzen zeigen das Ziel des unterbrochenen Drehs');
  reset();
});

test('loadState: alter Spielstand (nur Matrix) stürzt nicht ab, ungültige Stopps werden verworfen', () => {
  reset();
  const matrix = Array.from({ length: 4 }, () => Array(5).fill(9));
  const lines = [{ pat: [0, 0, 0, 0, 0], name: 'Reihe 1' }];
  loadState({ state: { matrix, freeSpins: 2, fsLines: lines, sticky: [0, 1, 2], pending: { free: true, lines, betIdx: 1 } } });
  assert.equal(S.stops, null, 'kein Walzenstand → main.js wählt Startpositionen');
  assert.equal(S.matrix, null);
  assert.equal(S.pending.stops, undefined);
  reset();
  loadState({ state: { stops: [0, 1, 2, 3, 16] } });
  assert.equal(S.stops, null);
  reset();
});

test('pruneSticky: Klebe-Joker nur auf Feldern, die wirklich einen Joker zeigen', () => {
  reset();
  const st = findStops(m => m[0][1] === JOKER && m[1][2] !== JOKER);
  setStops(st);
  S.sticky = [1, 7, 0];
  pruneSticky();
  assert.deepEqual(S.sticky, [1]);
  reset();
  const lines = [{ pat: [0, 0, 0, 0, 0], name: 'Reihe 1' }];
  loadState({ state: { stops: st, freeSpins: 2, fsLines: lines, sticky: [1, 7, 0] } });
  assert.deepEqual(S.sticky, [1], 'beim Laden bereinigt');
  reset();
});

test('snapshot enthält alle gespeicherten Felder', () => {
  const keys = Object.keys(snapshot()).sort();
  assert.deepEqual(keys, ['betIdx', 'brightness', 'cabinet', 'credits', 'fsBetIdx', 'fsLines', 'fsWon', 'freeSpins', 'gambleRefund', 'history', 'jackpot', 'level', 'matrix', 'music', 'pairs', 'pending', 'showLines', 'singles', 'sound', 'stats', 'sticky', 'stops', 'turbo', 'view', 'wheelPending', 'xp'].sort());
});
