// Optischer Regressionstest der neuen Fassung: gleiche Ausgangslage (feste Stopppositionen, seed-fester Zufall),
// Screenshots der Bühne je Ansicht, Vergleich mit den Referenzbildern in tests/e2e/screens/.
// Referenzbilder werden NUR mit UPDATE_SNAPSHOTS=1 neu geschrieben; sonst landen die aktuellen Bilder im Temp-Ordner.
// (Früher: Vergleich legacy ↔ neu. Seit den festen Walzenstreifen zeigen beide Fassungen andere Walzeninhalte.)
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { clickSetting, openGame, FILES, SCREENS } from './helpers.mjs';

const UPDATE = process.env.UPDATE_SNAPSHOTS === '1';
const OUT = UPDATE ? SCREENS : path.join(os.tmpdir(), 'bandit-screens');

// Feste Walzen und reproduzierbarer Zufall (crypto + Math.random), damit nur Animationsphasen abweichen.
const INIT = `(() => {
  try { if (!sessionStorage.getItem('seeded')){ localStorage.setItem('einarmigerBandit3d.v1', JSON.stringify({ stops: [7, 3, 11, 0, 5] })); sessionStorage.setItem('seeded', '1'); } } catch(e){}
  let a = 12345; const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0); };
  crypto.getRandomValues = arr => { for (let i = 0; i < arr.length; i++) arr[i] = next(); return arr; };
  Math.random = () => next() / 4294967296;
})();`;

// [Name, Gehäuse-Knopf, Orbit, Toleranz { mean, big }]. Nur die Standard-Kamera: Eine seitliche Ansicht ist unter
// SwiftShader selbst zwischen zwei Läufen derselben Fassung nicht reproduzierbar (Kamera-Gleiten bei 2–4 Bildern/s).
const VIEWS = [
  ['neon-3d', null, null, { mean: 4, big: 0.03 }],
  ['holz-3d', '#cab-wood', null, { mean: 4, big: 0.03 }],
  ['glas-3d', '#cab-glass', null, { mean: 4, big: 0.03 }]
];

describe('Optischer Regressionstest (neu)', { timeout: 480000 }, () => {
  /** @type {Record<string, string>} */
  const shots = {};
  let g;
  before(async () => {
    mkdirSync(OUT, { recursive: true });
    g = await openGame({ file: FILES.neu, wait: 4000, init: INIT });
    for (const [view, cab, orbit] of VIEWS){
      if (cab){ await clickSetting(g.page, cab); await g.page.waitForTimeout(500); }
      if (orbit) await g.page.evaluate(o => { __t.orbit.yaw = o.yaw; __t.orbit.pitch = o.pitch; }, orbit);
      // Kamera gleitet je Bild ein Stück zum Ziel → warten, bis sie steht (unabhängig von der Bildrate)
      await g.page.evaluate(async () => {
        __t.orbit.lastInput = performance.now();
        let prev = __t.camera.position.clone(), still = 0; const t0 = performance.now();
        while (still < 5 && performance.now() - t0 < 90000){
          await new Promise(r => setTimeout(r, 400));
          __t.orbit.lastInput = performance.now();   // kein Vitrinen-Schwenk während des Wartens
          const p = __t.camera.position; still = p.distanceTo(prev) < 0.00005 ? still + 1 : 0; prev = p.clone();
        }
        __t.orbit.lastInput = performance.now();
      });
      await g.page.waitForTimeout(1500);
      shots[view] = path.join(OUT, `${view}.png`);
      await g.page.locator('#stage').screenshot({ path: shots[view] });
    }
  });
  after(() => g && g.close());

  test('Walzen zeigen die gespeicherten Stopps', async () => {
    assert.deepEqual(await g.page.evaluate(() => __t.readStops()), [7, 3, 11, 0, 5]);
  });

  test('Bilder entsprechen den Referenzbildern (mittlere Abweichung klein)', { skip: UPDATE && 'Referenzbilder neu geschrieben' }, async () => {
    for (const [view, , , tol] of VIEWS){
      const ref = path.join(SCREENS, `${view}.png`);
      assert.ok(existsSync(ref), `${view}: Referenzbild fehlt – mit UPDATE_SNAPSHOTS=1 erzeugen`);
      const [a, b] = [ref, shots[view]].map(f => 'data:image/png;base64,' + readFileSync(f).toString('base64'));
      const r = await g.page.evaluate(async ([a, b]) => {
        const load = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = src; });
        const [A, B] = await Promise.all([load(a), load(b)]);
        if (A.width !== B.width || A.height !== B.height) return { size: false };
        const px = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
        const da = px(A), db = px(B); let sum = 0, big = 0;
        for (let i = 0; i < da.length; i += 4){
          const d = (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 3;
          sum += d; if (d > 48) big++;
        }
        const n = da.length / 4;
        return { size: true, w: A.width, h: A.height, mean: sum / n, bigShare: big / n };
      }, [a, b]);
      console.log(`# ${view}: ${r.w}×${r.h}, mittlere Abweichung ${r.mean?.toFixed(2)}/255, stark abweichende Pixel ${((r.bigShare || 0) * 100).toFixed(2)} %`);
      assert.ok(r.size, view + ': gleiche Größe');
      assert.ok(r.mean < tol.mean, `${view}: mittlere Abweichung ${r.mean.toFixed(2)}`);
      assert.ok(r.bigShare < tol.big, `${view}: ${(r.bigShare * 100).toFixed(2)} % stark abweichend`);
    }
  });

  test('keine Konsolenfehler', () => { assert.deepEqual(g.errors, []); });
});
