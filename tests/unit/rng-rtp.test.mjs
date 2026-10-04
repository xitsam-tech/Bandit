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

// Exakt über alle 22^5 Stoppkombinationen (Werte aus tools/calibrate-strips.mjs)
test('Basisspiel exakt: Linienquote, Treffer, Freispiel-Stufen und Rad-Auslösung', () => {
  const ex = exactBase();
  const p = (/** @type {number} */ x) => (x * 100).toFixed(3) + ' %';
  assert.equal(ex.combos, STRIP_LEN ** COLS);
  assert.ok(ex.rtpLines > 0.58 && ex.rtpLines < 0.62, `Linienquote ${p(ex.rtpLines)}`);
  // Bonus auf allen 5 Walzen, je 4 von 22 Stopps sichtbar (q = 2/11): ≥ 3 von 5 sichtbar
  const q = 4 / 22, binom = (/** @type {number} */ k) => [1, 5, 10, 10, 5, 1][k] * q ** k * (1 - q) ** (5 - k);
  for (const k of [3, 4, 5]) assert.ok(Math.abs(ex.fsBy[k] - binom(k)) < 1e-12, `${k} Bonus: ${p(ex.fsBy[k])}`);
  assert.ok(ex.fsBy[5] > 0 && ex.fsBy[4] > 0, 'alle Freispiel-Stufen erreichbar');
  assert.ok(Math.abs(ex.pFs - (binom(3) + binom(4) + binom(5))) < 1e-12, `Freispiel-Auslöser ${p(ex.pFs)}`);
  // Klee: Walze 1, 2, 4 einmal (4/22), Walze 3 und 5 zweimal (8/22); Glücksrad ab 4 sichtbaren
  assert.ok(ex.pWheel > 0.013 && ex.pWheel < 0.0155, `Glücksrad ${p(ex.pWheel)}`);
  assert.ok(ex.anyHit > 0.23 && ex.anyHit < 0.27, `Trefferquote ${p(ex.anyHit)}`);
  assert.ok(ex.pJackpot > 0 && ex.pJackpot < 1 / 20000, `Jackpot 1 von ${Math.round(1 / ex.pJackpot)}`);
});

test('Monte Carlo (Seed 1): Quote ohne Jackpot 88–90 % inkl. Freispielen mit gehaltenen Walzen und Glücksrad', () => {
  const r = simulate({ spins: 400000, seed: 1 });
  const p = (/** @type {number} */ x) => (x * 100).toFixed(2) + ' %';
  // Langlauf (tools/calibrate-strips.mjs, 2 Mio. Drehungen, Seed 1) ergibt 89,2 %, diese 400k Drehungen 88,5 %; Toleranz ±2,5 %
  assert.ok(r.rtp > 0.865 && r.rtp < 0.915, `Quote ${p(r.rtp)}`);
  assert.ok(r.fsRate > 0.042 && r.fsRate < 0.048, `Freispiel-Auslöser ${p(r.fsRate)}`);
  assert.ok(r.wheelRate > 0.013 && r.wheelRate < 0.0175, `Glücksrad ${p(r.wheelRate)}`);
  assert.ok(r.hitRate > 0.21 && r.hitRate < 0.28, `Trefferquote ${p(r.hitRate)}`);
  assert.ok(r.fsSpinsPerTrigger >= 3.2 && r.fsSpinsPerTrigger < 4.2, `Freispiele je Auslösung ${r.fsSpinsPerTrigger}`);
  const wheelMean = WHEEL.reduce((a, b) => a + b, 0) / WHEEL.length;
  assert.ok(wheelMean > 6 && wheelMean < 6.5, 'mittlerer Rad-Multiplikator ≈ 6,3× Gesamteinsatz');
});
