// Freispiele: gehaltene Walzen mit Klebe-Jokern, alle Joker-Walzen gehalten, Retrigger (Vorlagen: run5.js, fstest.js, fstestB.js).
// Ausgangslagen entstehen über erzwungene Stopppositionen auf den festen Streifen: Klebe-Joker liegen immer auf echten Jokern.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, targets, selfTests, SELFTEST_OK } from './helpers.mjs';

// Im Browser: Dreh mit erzwungenen Stopps, warten bis die Ablaufkette fertig ist, Bonusrunde einrichten
const PAGE_HELPERS = `(() => {
  const JOKER = 9, BONUS = 10, CLOVER = 12;
  window.__fs = {
    async idle(ms = 40000){
      const t0 = performance.now();
      while (__t.spinning || __t.busy){ await new Promise(r => setTimeout(r, 100)); if (performance.now() - t0 > ms) return false; }
      __t.clearAuto(); return true;
    },
    /** Normaler (bezahlter) Dreh auf genau diese Stopps. */
    async baseSpin(stops){ __t.setStops(() => stops); __bandit.spin(); __t.setStops(null); return this.idle(); },
    /** Walzen so stellen, dass auf den Feldern keys Joker liegen (ohne Bonus-/Rad-Auslösung), dann Bonusrunde mit genau diesen Klebe-Jokern. */
    async setupFree(keys, fs){
      const S = __t.S;
      if (keys.length){
        const st = __t.findStops(m => keys.every(k => m[Math.floor(k / 5)][k % 5] === JOKER) &&
          m.flat().filter(v => v === BONUS).length < 3 && m.flat().filter(v => v === CLOVER).length < 4);
        if (!st) throw new Error('keine Stopps mit Jokern auf ' + keys);
        await this.baseSpin(st);
      }
      const vis = __bandit.readVisibleMatrix();
      if (!keys.every(k => vis[Math.floor(k / 5)][k % 5] === JOKER)) throw new Error('Joker nicht sichtbar');
      S.freeSpins = fs; S.fsLines = __bandit.buildLines(); S.fsBetIdx = S.betIdx; S.fsWon = 0; S.sticky = keys.slice();
      __t.updateSticky();
      return S.sticky.slice();
    }
  };
})();`;

for (const [name, file] of targets({ reels: true })){
  describe(`Freispiele (${name})`, { timeout: 300000 }, () => {
    let g;
    before(async () => { g = await openGame({ file, wait: 3000 }); await g.page.addScriptTag({ content: PAGE_HELPERS }); });
    after(() => g && g.close());

    test('Self-Test vorab vollständig', async () => {
      assert.equal(await selfTests(g.page), SELFTEST_OK);
    });

    test('Klebe-Joker halten ihre Walzen fest, die anderen drehen', async () => {
      const r = await g.page.evaluate(async () => {
        const S = __t.S;
        const sticky = await __fs.setupFree([1, 7], 1);   // Joker auf (0,1) und (1,2) → Walzen 2 und 3
        const before = __bandit.readVisibleMatrix(), stops0 = __t.readStops(), rot0 = __t.reels.map(r => r.group.rotation.x);
        __bandit.spin();
        // Drehwinkel während des ganzen Drehs beobachten (robust gegen langsame Software-Frames)
        const moved = [0, 0, 0, 0, 0], sample = () => __t.reels.forEach((r, c) => { moved[c] = Math.max(moved[c], Math.abs(r.group.rotation.x - rot0[c])); });
        await new Promise(r => setTimeout(r, 600)); sample();
        const phases = __t.reels.map(r => r.phase), held = __t.reels.map(r => !!r.held);
        while (__t.spinning){ sample(); await new Promise(r => setTimeout(r, 50)); }
        await __fs.idle();
        const after = __bandit.readVisibleMatrix(), stops1 = __t.readStops();
        return { sticky, held, phases, heldStill: [1, 2].every(c => moved[c] === 0), othersMoved: [0, 3, 4].every(c => moved[c] > 0),
          colsKept: [1, 2].every(c => before.every((row, r) => row[c] === after[r][c]) && stops0[c] === stops1[c]),
          jokersStay: after[0][1] === 9 && after[1][2] === 9,
          fsLeft: S.freeSpins, stickyAfter: S.sticky.length, holdFramesAfter: __t.holdFrames.filter(f => f.visible).length };
      });
      assert.deepEqual(r.sticky, [1, 7]);
      assert.deepEqual(r.held, [false, true, true, false, false]);
      assert.equal(r.phases[1], 'idle'); assert.equal(r.phases[2], 'idle');
      assert.ok(r.heldStill, 'gehaltene Walzen bewegen sich nicht');
      assert.ok(r.othersMoved, 'freie Walzen drehen ' + JSON.stringify(r));
      assert.ok(r.colsKept, 'gehaltene Spalten und Stopps unverändert');
      assert.ok(r.jokersStay, 'Joker bleiben auf ihren Feldern sichtbar');
      // Retrigger nur über neu gelandete Bonus-Symbole möglich; sonst ist die Bonusrunde vorbei
      if (r.fsLeft === 0){ assert.equal(r.stickyAfter, 0); assert.equal(r.holdFramesAfter, 0); }
    });

    test('alle Joker-Walzen (2–5) gehalten: Runde endet ohne Hänger', async () => {
      await g.page.evaluate(() => __fs.idle());
      const r = await g.page.evaluate(async () => {
        const S = __t.S;
        // je ein Joker auf Walze 2, 3, 4 und 5 (Walze 1 trägt keinen Joker)
        const st = __t.findStops(m => [1, 2, 3, 4].every(c => m.some(row => row[c] === 9)));
        const keys = []; __bandit.matrixFromStops(st).forEach((row, r) => row.forEach((v, c) => { if (v === 9) keys.push(r * 5 + c); }));
        await __fs.setupFree(keys, 1);
        const stops0 = __t.readStops();
        __bandit.spin(); const held = __t.reels.map(r => !!r.held), t0 = performance.now();
        while (__t.spinning || __t.busy){ await new Promise(r => setTimeout(r, 100)); if (performance.now() - t0 > 30000) return 'HANG'; }
        __t.clearAuto();
        return { held, kept: [1, 2, 3, 4].every(c => __t.readStops()[c] === stops0[c]), fs: S.freeSpins, sticky: S.sticky.length };
      });
      assert.notEqual(r, 'HANG');
      assert.deepEqual(r.held, [false, true, true, true, true]);
      assert.ok(r.kept, 'gehaltene Walzen behalten ihre Stopps');
      assert.equal(r.fs, 0); assert.equal(r.sticky, 0);
    });

    // Genau n Bonus-Symbole auf freien Walzen (Bonus steht auf jeder Walze); gehaltene Walzen bleiben auf ihrem Stopp.
    // fs = 0: bezahlter Dreh im Grundspiel (Auslösung), sonst ein Freispiel (Retrigger).
    const scenario = (scen) => g.page.evaluate(async (scen) => {
      const S = __t.S;
      await __fs.idle();
      if (scen.fs) await __fs.setupFree(scen.sticky, scen.fs);
      const held = [0, 1, 2, 3, 4].map(c => !!scen.fs && S.sticky.some(k => k % 5 === c)), cur = __t.readStops();
      const lines = __bandit.buildLines();
      const st = __t.findStops(m => m.flat().filter((v, i) => v === 10 && !held[i % 5]).length === scen.n && m.flat().filter(v => v === 12).length < 4 &&
        __bandit.evaluate(m, lines).lineTotal < 50, { fixed: cur.map((p, c) => held[c] ? p : null) });
      if (!st) return 'KEINE STOPPS';
      __t.setStops(() => st); __bandit.spin(); __t.setStops(null);
      const before = S.freeSpins; // nach Abzug
      const t0 = performance.now();
      while (__t.spinning || __t.busy){ await new Promise(r => setTimeout(r, 100)); if (performance.now() - t0 > 60000) return 'HANG ' + JSON.stringify({ sp: __t.spinning, busy: __t.busy, fs: S.freeSpins, phases: __t.reels.map(r => r.phase) }); }
      __t.clearAuto();
      return { afterSpinDeduct: before, after: S.freeSpins };
    }, scen);

    test('Retrigger: 3 Bonus auf freien Walzen bei 2 Freispielen → 1 + 3', async () => {
      assert.deepEqual(await scenario({ fs: 2, sticky: [], n: 3 }), { afterSpinDeduct: 1, after: 4 });
    });

    test('Retrigger im letzten Freispiel → 0 + 3', async () => {
      assert.deepEqual(await scenario({ fs: 1, sticky: [], n: 3 }), { afterSpinDeduct: 0, after: 3 });
    });

    test('Retrigger mit gehaltener Walze 2 → 1 + 3', async () => {
      assert.deepEqual(await scenario({ fs: 2, sticky: [1], n: 3 }), { afterSpinDeduct: 1, after: 4 });
    });

    test('Retrigger mit 4 Bonus → 1 + 5', async () => {
      assert.deepEqual(await scenario({ fs: 2, sticky: [], n: 4 }), { afterSpinDeduct: 1, after: 6 });
    });

    test('Retrigger mit 5 Bonus im letzten Freispiel → 0 + 8', async () => {
      assert.deepEqual(await scenario({ fs: 1, sticky: [], n: 5 }), { afterSpinDeduct: 0, after: 8 });
    });

    test('Grundspiel: 4 Bonus → 5 Freispiele, 5 Bonus → 8 Freispiele', async () => {
      await g.page.evaluate(() => { const S = __t.S; S.freeSpins = 0; S.sticky = []; __t.updateSticky(); });
      assert.deepEqual(await scenario({ fs: 0, sticky: [], n: 4 }), { afterSpinDeduct: 0, after: 5 });
      await g.page.evaluate(() => { const S = __t.S; S.freeSpins = 0; S.sticky = []; __t.updateSticky(); });
      assert.deepEqual(await scenario({ fs: 0, sticky: [], n: 5 }), { afterSpinDeduct: 0, after: 8 });
    });

    test('keine Konsolenfehler', () => { assert.deepEqual(g.errors, []); });
  });
}
