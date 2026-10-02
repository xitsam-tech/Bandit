// Start ohne Konsolenfehler, Self-Tests 18/18, ein Dreh per Leertaste (Vorlage: run4.js).
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, targets, selfTests } from './helpers.mjs';

for (const [name, file] of targets()){
  describe(`Start & Self-Test (${name})`, { timeout: 120000 }, () => {
    let g;
    before(async () => { g = await openGame({ file, wait: 3500 }); });
    after(() => g && g.close());

    test('Self-Test: 18/18 bestanden', async () => {
      assert.equal(await selfTests(g.page), '18/18 bestanden');
    });

    test('Leertaste dreht; danach zeigen die Walzen die gespeicherte Matrix', async () => {
      const c0 = await g.page.evaluate(() => __t.S.credits);
      await g.page.mouse.click(5, 5);
      await g.page.keyboard.press('Space');
      await g.page.waitForTimeout(900);
      assert.equal(await g.page.evaluate(() => __t.spinning || __t.busy), true, 'Dreh läuft');
      await g.page.waitForFunction(() => !__t.spinning && !__t.busy, null, { timeout: 30000 });
      const r = await g.page.evaluate(() => ({ spins: __t.S.stats.spins, credits: __t.S.credits, won: __t.S.stats.won, wagered: __t.S.stats.wagered,
        match: JSON.stringify(__bandit.readVisibleMatrix()) === JSON.stringify(__t.S.matrix), btn: document.getElementById('spinBtn').textContent }));
      assert.equal(r.spins, 1);
      assert.equal(r.match, true);
      assert.ok(Math.abs(r.credits - (c0 - r.wagered + r.won)) < 1e-6, 'Buchung stimmt: Credits = Start − Einsatz + Gewinn');
      assert.match(r.btn, /DREHEN|NEHMEN & DREHEN/);
      assert.equal(await selfTests(g.page), '18/18 bestanden');
    });

    test('keine Konsolenfehler/-warnungen (außer blockierten Fonts)', () => {
      assert.deepEqual(g.errors, []);
    });
  });
}
