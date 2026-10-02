// Auto stoppt bei Mega Win (Vorlage: autostop.js).
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, targets } from './helpers.mjs';

for (const [name, file] of targets()){
  describe(`Auto-Stopp (${name})`, { timeout: 120000 }, () => {
    let g;
    before(async () => { g = await openGame({ file, wait: 3000 }); });
    after(() => g && g.close());

    test('erster Dreh 20× Sieben → Mega Win, Auto stoppt und dreht nicht weiter', async () => {
      const r = await g.page.evaluate(async () => {
        const orig = __t.defaultMatrix; let n = 0;
        __t.setMatrix(() => { n++; return n === 1 ? Array.from({ length: 4 }, () => Array(5).fill(7)) : orig(); });
        document.getElementById('autoBtn').click();
        const t0 = performance.now();
        while (performance.now() - t0 < 25000){ await new Promise(r => setTimeout(r, 300)); if (!__t.autoOn && !__t.spinning && !__t.busy) break; }
        const spinsAtStop = __t.S.stats.spins;
        await new Promise(r => setTimeout(r, 4000));
        __t.setMatrix(null);
        return { autoOn: __t.autoOn, spinsAtStop, spinsLater: __t.S.stats.spins, credits: __t.S.credits, won: __t.S.stats.won,
          status: document.getElementById('status').textContent, autoBtn: document.getElementById('autoBtn').textContent };
      });
      assert.equal(r.autoOn, false);
      assert.equal(r.spinsAtStop, 1);
      assert.equal(r.spinsLater, 1, 'nach dem Stopp keine weiteren Drehungen');
      assert.equal(r.won, 3600, '10 Linien × 720 × 0,50');
      assert.equal(r.status, 'Auto gestoppt: Mega Win über 3600.00.');
      assert.equal(r.autoBtn, 'Auto');
    });

    test('keine Konsolenfehler', () => { assert.deepEqual(g.errors, []); });
  });
}
