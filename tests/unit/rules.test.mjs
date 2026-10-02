// Regeln/Konfiguration: Freispiele, Glücksrad, Level, Tabellen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FS_AWARD, WEIGHTS, PAY, SYMBOLS, WHEEL, BET_STEPS } from '../../js/core/config.js';
import { wheelIndexAt, wheelTarget } from '../../js/core/wheel-math.js';
import { xpNeed } from '../../js/core/progression.js';

test('FS_AWARD: 3 / 4 / 5+ Bonus = 3 / 5 / 8 Freispiele, darunter keine', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 20].map(FS_AWARD), [0, 0, 0, 3, 5, 8, 8, 8, 8]);
});

test('wheelIndexAt ∘ wheelTarget: Rad landet immer auf dem gezogenen Feld', () => {
  const seg = Math.PI * 2 / WHEEL.length;
  for (let i = 0; i < WHEEL.length; i++)
    for (const j of [-0.34, -0.2, 0, 0.2, 0.34])
      for (const p0 of [0, 1.234, 77.7, -5.5, 1e3])
        for (const turns of [4, 6])
          assert.equal(wheelIndexAt(wheelTarget(p0, i, j * seg, turns)), i, `Feld ${i}, jitter ${j}, phi0 ${p0}`);
});

test('wheelTarget: dreht vorwärts um mindestens die vollen Umdrehungen', () => {
  for (const p0 of [0, 2, 50]){
    const t = wheelTarget(p0, 3, 0, 6);
    assert.ok(t - p0 >= Math.PI * 2 * 5, 'mindestens 5 volle Umdrehungen weiter');
  }
});

test('xpNeed: Werte und strenge Monotonie', () => {
  assert.equal(xpNeed(1), 40);
  assert.equal(xpNeed(2), Math.round(40 * Math.pow(2, 1.4)));
  for (let l = 1; l < 50; l++) assert.ok(xpNeed(l + 1) > xpNeed(l));
});

test('Tabellen decken alle Symbole ab und sind unverändert', () => {
  assert.equal(WEIGHTS.length, SYMBOLS.length);
  assert.equal(PAY.length, SYMBOLS.length);
  assert.deepEqual(WEIGHTS, [16, 16, 13, 13, 10, 8, 6, 3, 3, 4, 3, 2, 5]);
  assert.deepEqual(WHEEL, [3, 5, 3, 8, 3, 5, 3, 15, 3, 5, 3, 8, 3, 5, 25, 4]);
  assert.deepEqual(BET_STEPS, [0.1, 0.2, 0.5, 1, 2, 5]);
  assert.ok(PAY.every(p => p.length === 3));
});
