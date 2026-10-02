// Auto stoppt bei Mega Win (Vorlage: autostop.js). Der Gewinn wird über Stopppositionen auf den festen Streifen erzwungen.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, targets } from './helpers.mjs';

for (const [name, file] of targets({ reels: true })){
  describe(`Auto-Stopp (${name})`, { timeout: 120000 }, () => {
    let g;
    before(async () => { g = await openGame({ file, wait: 3000 }); });
    after(() => g && g.close());

    test('erster Dreh mit Mega Win (Stopps auf dem Streifen gesucht) → Auto stoppt und dreht nicht weiter', async () => {
      const r = await g.page.evaluate(async () => {
        const lines = __bandit.buildLines(), bet = 0.5;   // Start: 3 Paare = 10 Linien, Einsatzstufe 0,50
        const mega = __t.findStops(m => { const e = __bandit.evaluate(m, lines); return e.lineTotal >= 25 * lines.length && !e.jackpot && e.scatter.count < 3 && e.clover.count < 4; });
        const expWon = __bandit.evaluate(__bandit.matrixFromStops(mega), lines).lineTotal * bet;
        let n = 0;
        __t.setStops(() => (++n === 1 ? mega : __bandit.randomStops()));
        document.getElementById('autoBtn').click();
        const t0 = performance.now();
        while (performance.now() - t0 < 25000){ await new Promise(r => setTimeout(r, 300)); if (!__t.autoOn && !__t.spinning && !__t.busy) break; }
        const spinsAtStop = __t.S.stats.spins;
        await new Promise(r => setTimeout(r, 4000));
        __t.setStops(null);
        return { autoOn: __t.autoOn, spinsAtStop, spinsLater: __t.S.stats.spins, won: __t.S.stats.won, expWon, stops: __t.readStops(), mega, lines: lines.length,
          status: document.getElementById('status').textContent, autoBtn: document.getElementById('autoBtn').textContent };
      });
      assert.equal(r.lines, 10);
      assert.equal(r.autoOn, false);
      assert.equal(r.spinsAtStop, 1);
      assert.equal(r.spinsLater, 1, 'nach dem Stopp keine weiteren Drehungen');
      assert.deepEqual(r.stops, r.mega, 'Walzen stehen auf den gesuchten Stopps');
      assert.ok(r.expWon >= 125, 'Mega Win ≥ 25× Gesamteinsatz');
      assert.equal(r.won, r.expWon);
      assert.equal(r.status, `Auto gestoppt: Mega Win über ${r.expWon.toFixed(2)}.`);
      assert.equal(r.autoBtn, 'Auto');
    });

    test('keine Konsolenfehler', () => { assert.deepEqual(g.errors, []); });
  });
}
