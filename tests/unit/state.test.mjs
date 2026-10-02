// Laden/Speichern des Zustands: nur gültige Werte werden übernommen (ohne localStorage in Node).
import test from 'node:test';
import assert from 'node:assert/strict';
import { S, loadState, snapshot } from '../../js/core/state.js';
import { JP_SEED, JP_MAX, BET_STEPS } from '../../js/core/config.js';

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

test('loadState: unterbrochener Dreh wird mit gültiger Matrix übernommen', () => {
  reset();
  const matrix = Array.from({ length: 4 }, () => Array(5).fill(3));
  loadState({ state: { matrix, pending: { free: false, lines: [{ pat: [0, 0, 0, 0, 0], name: 'Reihe 1' }], betIdx: 2 } } });
  assert.equal(S.matrix, matrix);
  assert.equal(S.pending.betIdx, 2); assert.equal(S.pending.free, false);
  reset();
});

test('snapshot enthält alle gespeicherten Felder', () => {
  const keys = Object.keys(snapshot()).sort();
  assert.deepEqual(keys, ['betIdx', 'brightness', 'cabinet', 'credits', 'fsBetIdx', 'fsLines', 'fsWon', 'freeSpins', 'gambleRefund', 'history', 'jackpot', 'level', 'matrix', 'music', 'pairs', 'pending', 'showLines', 'singles', 'sound', 'stats', 'sticky', 'turbo', 'view', 'wheelPending', 'xp'].sort());
});
