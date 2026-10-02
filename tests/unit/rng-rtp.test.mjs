// Zufall und Monte-Carlo-Kurzprüfung der Auszahlungsquote (seed-fest, ohne DOM/THREE).
import test from 'node:test';
import assert from 'node:assert/strict';
import { WEIGHTS, WHEEL, WHEEL_MIN } from '../../js/core/config.js';
import { buildLines, evaluate } from '../../js/core/lines.js';
import { rand, sampleSymbol, randomMatrix, defaultRandomMatrix, setRandomSource, setMatrixSource, seededRandom } from '../../js/core/rng.js';

test('rand: ohne Ersatzquelle kryptografischer Zufall in [0, 1)', () => {
  setRandomSource(null);
  for (let i = 0; i < 1000; i++){ const x = rand(); assert.ok(x >= 0 && x < 1); }
});

test('seededRandom: gleicher Seed = gleiche Folge', () => {
  const a = seededRandom(42), b = seededRandom(42), c = seededRandom(43);
  const A = Array.from({ length: 5 }, a), B = Array.from({ length: 5 }, b), C = Array.from({ length: 5 }, c);
  assert.deepEqual(A, B); assert.notDeepEqual(A, C);
});

test('sampleSymbol folgt den Gewichten (grob)', () => {
  setRandomSource(seededRandom(7));
  const n = 200000, cnt = Array(WEIGHTS.length).fill(0);
  for (let i = 0; i < n; i++) cnt[sampleSymbol()]++;
  setRandomSource(null);
  const tot = WEIGHTS.reduce((a, b) => a + b, 0);
  WEIGHTS.forEach((w, i) => assert.ok(Math.abs(cnt[i] / n - w / tot) < 0.005, `Symbol ${i}: ${cnt[i] / n} statt ${w / tot}`));
});

test('setMatrixSource ersetzt randomMatrix, null stellt den Zufall wieder her', () => {
  const fixed = Array.from({ length: 4 }, () => Array(5).fill(7));
  setMatrixSource(() => fixed);
  assert.equal(randomMatrix(), fixed);
  assert.notEqual(defaultRandomMatrix(), fixed);
  setMatrixSource(null);
  const m = randomMatrix();
  assert.equal(m.length, 4); assert.ok(m.every(r => r.length === 5 && r.every(v => Number.isInteger(v) && v >= 0 && v < WEIGHTS.length)));
});

test('Monte Carlo: Linienquote (10 Linien) ≈ 67 %, Bonus-/Rad-Häufigkeit plausibel', () => {
  setRandomSource(seededRandom(1));
  const lines = buildLines([false, false, false, false], [true, true, true]);
  const n = 200000; let tot = 0, fs = 0, wheel = 0;
  for (let i = 0; i < n; i++){
    const r = evaluate(defaultRandomMatrix(), lines);
    tot += r.lineTotal; if (r.scatter.count >= 3) fs++; if (r.clover.count >= WHEEL_MIN) wheel++;
  }
  setRandomSource(null);
  const rtpLines = tot / n / lines.length;
  // Langlauf (2 Mio. Drehungen) ergibt ≈ 67,3 % aus Linien; der Rest der ≈ 92 % kommt aus Freispielen und Glücksrad.
  assert.ok(rtpLines > 0.62 && rtpLines < 0.73, `Linienquote ${(rtpLines * 100).toFixed(2)} %`);
  assert.ok(fs / n > 0.015 && fs / n < 0.025, `Freispiel-Auslöser ${(fs / n * 100).toFixed(2)} %`);
  assert.ok(wheel / n > 0.011 && wheel / n < 0.019, `Glücksrad ${(wheel / n * 100).toFixed(2)} %`);
  const wheelMean = WHEEL.reduce((a, b) => a + b, 0) / WHEEL.length;
  assert.ok(wheelMean > 6 && wheelMean < 6.5, 'mittlerer Rad-Multiplikator ≈ 6,3× Gesamteinsatz');
});
