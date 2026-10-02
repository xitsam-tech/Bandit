// Neuladen mitten im Spiel, Risiko-Buchung, Auto+Turbo (Vorlagen: run3.js, reloadtest.js).
// Läuft über http, damit localStorage das Neuladen übersteht.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, targets, selfTests } from './helpers.mjs';

for (const [name, file] of targets()){
  describe(`Neuladen & Buchungen (${name})`, { timeout: 240000 }, () => {
    let g;
    before(async () => {
      g = await openGame({ file, wait: 2500 });
      await g.page.evaluate(() => localStorage.clear());
      await g.reload(2500);
    });
    after(() => g && g.close());

    test('Neuladen mitten im Dreh: Runde wird ausgewertet, Matrix bleibt', async () => {
      await g.page.click('#spinBtn'); await g.page.waitForTimeout(300);
      const before = await g.page.evaluate(() => ({ c: __t.S.credits, m: JSON.stringify(__t.S.matrix), pend: !!__t.S.pending }));
      assert.equal(before.pend, true, 'Dreh ist als unterbrochen gespeichert');
      await g.reload(4500);
      await g.page.waitForFunction(() => !__t.spinning && !__t.busy, null, { timeout: 30000 });
      const after = await g.page.evaluate(() => ({ c: __t.S.credits, pend: __t.S.pending, spins: __t.S.stats.spins, hist: __t.S.history.length,
        same: JSON.stringify(__bandit.readVisibleMatrix()), won: __t.S.stats.won }));
      assert.equal(after.pend, null);
      assert.equal(after.same, before.m, 'Matrix nach dem Neuladen unverändert');
      assert.equal(after.spins, 1); assert.equal(after.hist, 1);
      assert.ok(Math.abs(after.c - (before.c + after.won)) < 1e-6, 'Gewinn genau einmal gutgeschrieben');
    });

    test('Risiko: Einsatz wird abgebucht und bei Treffer doppelt gutgeschrieben', async () => {
      const r = await g.page.evaluate(async () => {
        const S = __t.S;
        while (__t.busy) await new Promise(r => setTimeout(r, 200));
        if (__t.gamble) document.getElementById('gTake').click();
        const c0 = S.credits; __bandit.offerGamble(2); await new Promise(r => setTimeout(r, 300));
        document.getElementById('gRed').click(); const mid = S.credits;
        await new Promise(r => setTimeout(r, 2500));
        return { c0, mid, end: S.credits };
      });
      assert.ok(Math.abs(r.mid - (r.c0 - 2)) < 1e-6, 'Einsatz sofort abgebucht');
      assert.ok(Math.abs(r.end - (r.c0 + 2)) < 1e-6 || Math.abs(r.end - (r.c0 - 2)) < 1e-6, 'Ergebnis ±2: ' + JSON.stringify(r));
    });

    test('Neuladen während der Risiko-Entscheidung bucht den Einsatz zurück', async () => {
      // Nach einem Treffer bleibt die Leiter offen → erst nehmen
      await g.page.waitForFunction(() => !__t.gamble || !__t.gamble.busy, null, { timeout: 10000 });
      await g.page.evaluate(() => { if (__t.gamble) document.getElementById('gTake').click(); });
      await g.page.waitForFunction(() => !__t.gamble, null, { timeout: 10000 });
      const c0 = await g.page.evaluate(() => { __bandit.offerGamble(10); return __t.S.credits; });
      await g.page.waitForTimeout(400); await g.page.mouse.click(5, 5);
      await g.page.evaluate(() => __bandit.gamblePick(true)); await g.page.waitForTimeout(120);
      await g.reload(3000);
      const r = await g.page.evaluate(() => ({ c: __t.S.credits, refund: __t.S.gambleRefund, status: document.getElementById('status').textContent }));
      assert.ok(Math.abs(r.c - c0) < 1e-6, `Credits ${c0} → ${r.c}`);
      assert.equal(r.refund, 0);
      assert.match(r.status, /Unterbrochenes Risiko: 10\.00 wurden zurückgebucht\./);
    });

    test('Neuladen während des Glücksrads: Rad wird nachgeholt', async () => {
      const w0 = await g.page.evaluate(() => { __bandit.runWheel(5, 4); return __t.S.credits; });
      await g.page.waitForTimeout(1500);
      assert.deepEqual(await g.page.evaluate(() => __t.S.wheelPending), { stake: 5 });
      await g.reload(500);
      await g.page.waitForFunction(w0 => !__t.busy && !__t.S.wheelPending && __t.S.credits > w0, w0, { timeout: 45000 });
      const r = await g.page.evaluate(() => ({ c: __t.S.credits, wheels: __t.S.stats.wheels }));
      assert.ok(r.c >= w0 + 15 - 1e-6, 'mindestens 3× Einsatz gutgeschrieben');
      assert.equal(r.wheels, 1);
    });

    test('Auto + Turbo: mehrere Runden, danach konsistent', async () => {
      await g.page.click('#turboBtn'); await g.page.click('#autoBtn');
      await g.page.waitForTimeout(20000);
      if (await g.page.evaluate(() => __t.autoOn)) await g.page.click('#autoBtn');
      await g.page.waitForFunction(() => !__t.spinning && !__t.busy, null, { timeout: 40000 });
      await g.page.waitForTimeout(1500);
      const r = await g.page.evaluate(() => ({ spins: __t.S.stats.spins, busy: __t.busy, autoOn: __t.autoOn, fs: __t.S.freeSpins,
        match: JSON.stringify(__bandit.readVisibleMatrix()) === JSON.stringify(__t.S.matrix) }));
      assert.ok(r.spins >= 3, 'Auto hat gedreht: ' + r.spins);
      assert.equal(r.autoOn, false);
      if (r.fs === 0){ assert.equal(r.match, true); assert.equal(await selfTests(g.page), '18/18 bestanden'); }
    });

    test('keine Konsolenfehler', () => { assert.deepEqual(g.errors, []); });
  });
}
