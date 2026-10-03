// Zufall (Stopppositionen) und Auszahlungsquote der festen Walzenstreifen (seed-fest, ohne DOM/THREE).
import test from 'node:test';
import assert from 'node:assert/strict';
import { COLS, WHEEL } from '../../js/core/config.js';
import { evaluate } from '../../js/core/lines.js';
import { nextStops, rand, randomStops, seededRandom, setRandomSource, setStopSource } from '../../js/core/rng.js';
import { STRIP_LEN, matrixFromStops } from '../../js/core/strips.js';
import { LINES10, exactBase, fastLines, simulate } from '../../tools/strip-sim.mjs';

test('rand: ohne Ersatzquelle kryptografischer Zufall in [0, 1)', () => {
  setRandomSource(null);
  for (let i = 0; i < 1000; i++){ const x = rand(); assert.ok(x >= 0 && x < 1); }
});

test('seededRandom: gleicher Seed = gleiche Folge', () => {
  const a = seededRandom(42), b = seededRandom(42), c = seededRandom(43);
  const A = Array.from({ length: 5 }, a), B = Array.from({ length: 5 }, b), C = Array.from({ length: 5 }, c);
  assert.deepEqual(A, B); assert.notDeepEqual(A, C);
});

test('randomStops: je Walze gleichverteilt über alle STRIP_LEN Positionen', () => {
  const rnd = seededRandom(7), n = 160000, cnt = Array.from({ length: COLS }, () => Array(STRIP_LEN).fill(0));
  for (let i = 0; i < n; i++) randomStops(rnd).forEach((p, c) => cnt[c][p]++);
  cnt.forEach((row, c) => row.forEach((k, p) => assert.ok(Math.abs(k / n - 1 / STRIP_LEN) < 0.004, `Walze ${c + 1}, Stopp ${p}: ${k / n}`)));
});

test('setStopSource ersetzt den Zufall, ungültige Werte fallen auf Zufall zurück, null stellt ihn wieder her', (t) => {
  t.mock.method(console, 'warn', () => {});
  setStopSource(() => [1, 2, 3, 4, 5]);
  assert.deepEqual(nextStops(), [1, 2, 3, 4, 5]);
  setStopSource(() => [1, 2, 3]);
  const s = nextStops();
  assert.equal(s.length, COLS); assert.ok(s.every(p => p >= 0 && p < STRIP_LEN));
  setStopSource(null);
  const r = nextStops();
  assert.equal(r.length, COLS); assert.ok(r.every(p => Number.isInteger(p) && p >= 0 && p < STRIP_LEN));
});

test('fastLines (Kalibrierung) rechnet wie evaluate', () => {
  const rnd = seededRandom(3), pats = LINES10.map(l => l.pat);
  for (let i = 0; i < 20000; i++){
    const m = matrixFromStops(randomStops(rnd)), a = evaluate(m, LINES10), b = fastLines(m, pats);
    assert.equal(b.total, a.lineTotal); assert.equal(b.jackpot, a.jackpot);
  }
});

// Exakt über alle 16^5 Stoppkombinationen (Werte aus tools/calibrate-strips.mjs)
test('Basisspiel exakt: Linienquote, Treffer, Freispiel- und Rad-Auslösung', () => {
  const ex = exactBase();
  assert.equal(ex.combos, STRIP_LEN ** COLS);
  assert.ok(ex.rtpLines > 0.70 && ex.rtpLines < 0.75, `Linienquote ${(ex.rtpLines * 100).toFixed(2)} %`);
  assert.equal(ex.pFs, 1 / 64, 'Bonus auf Walze 1, 3, 5: alle drei sichtbar = (4/16)³');
  assert.equal(ex.pWheel, 1 / 64, 'Klee je einmal auf jeder Walze: ≥ 4 sichtbar = 16/1024');
  assert.ok(ex.anyHit > 0.23 && ex.anyHit < 0.27, `Trefferquote ${(ex.anyHit * 100).toFixed(2)} %`);
  assert.ok(ex.pJackpot > 0 && ex.pJackpot < 1 / 20000, `Jackpot 1 von ${Math.round(1 / ex.pJackpot)}`);
});

test('Monte Carlo (Seed 1): Quote ohne Jackpot 88–90 % inkl. Freispielen mit gehaltenen Walzen und Glücksrad', () => {
  const r = simulate({ spins: 400000, seed: 1 });
  const p = (/** @type {number} */ x) => (x * 100).toFixed(2) + ' %';
  // Langlauf (tools/calibrate-strips.mjs, 2 Mio. Drehungen, Seed 1) ergibt 89,2 %, diese 400k Drehungen 88,4 %; Toleranz ±2,5 %
  assert.ok(r.rtp > 0.865 && r.rtp < 0.915, `Quote ${p(r.rtp)}`);
  assert.ok(r.fsRate > 0.0140 && r.fsRate < 0.0172, `Freispiel-Auslöser ${p(r.fsRate)}`);
  assert.ok(r.wheelRate > 0.0140 && r.wheelRate < 0.0185, `Glücksrad ${p(r.wheelRate)}`);
  assert.ok(r.hitRate > 0.22 && r.hitRate < 0.28, `Trefferquote ${p(r.hitRate)}`);
  assert.ok(r.fsSpinsPerTrigger >= 3 && r.fsSpinsPerTrigger < 3.5, `Freispiele je Auslösung ${r.fsSpinsPerTrigger}`);
  const wheelMean = WHEEL.reduce((a, b) => a + b, 0) / WHEEL.length;
  assert.ok(wheelMean > 6 && wheelMean < 6.5, 'mittlerer Rad-Multiplikator ≈ 6,3× Gesamteinsatz');
});
