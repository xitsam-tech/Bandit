// Optischer Vergleich legacy ↔ neu: gleiche Ausgangslage (feste Matrix, seed-fester Zufall), Screenshots der Bühne,
// Bildpaare unter tests/e2e/screens/ und eine Pixel-Abweichungszahl je Ansicht.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { openGame, FILES, SCREENS } from './helpers.mjs';

// Feste Walzen und reproduzierbarer Zufall (crypto + Math.random), damit nur Animationsphasen abweichen.
const INIT = `(() => {
  const M = [[7,5,9,1,0],[3,11,6,10,2],[8,12,4,7,5],[1,0,2,3,6]];
  try { if (!sessionStorage.getItem('seeded')){ localStorage.setItem('einarmigerBandit3d.v1', JSON.stringify({ matrix: M })); sessionStorage.setItem('seeded', '1'); } } catch(e){}
  let a = 12345; const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0); };
  crypto.getRandomValues = arr => { for (let i = 0; i < arr.length; i++) arr[i] = next(); return arr; };
  Math.random = () => next() / 4294967296;
})();`;

const VIEWS = [
  ['neon-3d', null, null],
  ['holz-3d', '#cab-wood', null],
  ['glas-seitlich', '#cab-glass', { yaw: 1.05, pitch: 0.12 }]
];

describe('Optischer Vergleich legacy ↔ neu', { timeout: 480000 }, () => {
  const shots = {};
  before(async () => {
    mkdirSync(SCREENS, { recursive: true });
    for (const [name, file] of Object.entries(FILES)){
      const g = await openGame({ file, wait: 4000, init: INIT });
      try {
        for (const [view, cab, orbit] of VIEWS){
          if (cab){ await g.page.click(cab); await g.page.waitForTimeout(500); }
          if (orbit) await g.page.evaluate(o => { __t.orbit.yaw = o.yaw; __t.orbit.pitch = o.pitch; }, orbit);
          // Kamera gleitet je Bild ein Stück zum Ziel → warten, bis sie steht (unabhängig von der Bildrate)
          await g.page.evaluate(async () => {
            __t.orbit.lastInput = performance.now();
            let prev = __t.camera.position.clone(), still = 0; const t0 = performance.now();
            while (still < 3 && performance.now() - t0 < 60000){
              await new Promise(r => setTimeout(r, 400));
              __t.orbit.lastInput = performance.now();   // kein Vitrinen-Schwenk während des Wartens
              const p = __t.camera.position; still = p.distanceTo(prev) < 0.0003 ? still + 1 : 0; prev = p.clone();
            }
            __t.orbit.lastInput = performance.now();
          });
          await g.page.waitForTimeout(1500);
          const file2 = path.join(SCREENS, `${view}-${name}.png`);
          await g.page.locator('#stage').screenshot({ path: file2 });
          (shots[view] ||= {})[name] = file2;
        }
        assert.deepEqual(g.errors, [], name + ': Konsolenfehler');
      } finally { await g.close(); }
    }
  });

  test('Bildpaare sind gleichwertig (mittlere Abweichung klein)', async () => {
    const g = await openGame({ file: FILES.neu, wait: 0 });
    try {
      for (const [view] of VIEWS){
        const [a, b] = ['legacy', 'neu'].map(n => 'data:image/png;base64,' + readFileSync(shots[view][n]).toString('base64'));
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
        console.log(`# ${view}: ${r.w}×${r.h}, mittlere Abweichung ${r.mean.toFixed(2)}/255, stark abweichende Pixel ${(r.bigShare * 100).toFixed(2)} %`);
        assert.ok(r.size, view + ': gleiche Größe');
        assert.ok(r.mean < 4, `${view}: mittlere Abweichung ${r.mean.toFixed(2)}`);
        assert.ok(r.bigShare < 0.03, `${view}: ${(r.bigShare * 100).toFixed(2)} % stark abweichend`);
      }
    } finally { await g.close(); }
  });
});
