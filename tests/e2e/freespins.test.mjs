// Freispiele: gehaltene Walzen mit Klebe-Jokern, alle Walzen gehalten, Retrigger (Vorlagen: run5.js, fstest.js, fstestB.js).
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, targets, selfTests } from './helpers.mjs';

for (const [name, file] of targets()){
  describe(`Freispiele (${name})`, { timeout: 180000 }, () => {
    let g;
    before(async () => { g = await openGame({ file, wait: 3000 }); });
    after(() => g && g.close());

    /** Wartet, bis Dreh und Ablaufkette fertig sind, und hält den automatischen Weiterlauf an. */
    const settleAndHold = () => g.page.evaluate(async () => {
      const t0 = performance.now();
      while (__t.spinning || __t.busy){ await new Promise(r => setTimeout(r, 100)); if (performance.now() - t0 > 40000) return false; }
      __t.clearAuto();
      return true;
    });

    test('Self-Test vorab 18/18', async () => {
      assert.equal(await selfTests(g.page), '18/18 bestanden');
    });

    test('Klebe-Joker halten ihre Walzen fest, die anderen drehen', async () => {
      const r = await g.page.evaluate(async () => {
        const S = __t.S; S.freeSpins = 1; S.fsLines = __bandit.buildLines(); S.fsBetIdx = S.betIdx; S.sticky = [1, 7];
        const before = __bandit.readVisibleMatrix(); const rot0 = __t.reels.map(r => r.group.rotation.x);
        __bandit.spin();
        // Drehwinkel während des ganzen Drehs beobachten (robust gegen langsame Software-Frames)
        const moved = [0, 0, 0, 0, 0], sample = () => __t.reels.forEach((r, c) => { moved[c] = Math.max(moved[c], Math.abs(r.group.rotation.x - rot0[c])); });
        await new Promise(r => setTimeout(r, 600)); sample();
        const phases = __t.reels.map(r => r.phase), held = __t.reels.map(r => !!r.held);
        while (__t.spinning){ sample(); await new Promise(r => setTimeout(r, 50)); }
        while (__t.spinning || __t.busy) await new Promise(r => setTimeout(r, 200));
        const after = __bandit.readVisibleMatrix();
        const keep = c => before.every((row, r) => (r * 5 + c === 1 || r * 5 + c === 7) ? after[r][c] === 9 : row[c] === after[r][c]);
        return { phases, held, heldStill: [1, 2].every(c => moved[c] === 0), othersMoved: [0, 3, 4].every(c => moved[c] > 0),
          col2: keep(1), col3: keep(2), fsLeft: S.freeSpins, sticky: S.sticky.length, holdFramesAfter: __t.holdFrames.filter(f => f.visible).length };
      });
      assert.deepEqual(r.held, [false, true, true, false, false]);
      assert.equal(r.phases[1], 'idle'); assert.equal(r.phases[2], 'idle');
      assert.ok(r.heldStill, 'gehaltene Walzen bewegen sich nicht');
      assert.ok(r.othersMoved, 'freie Walzen drehen ' + JSON.stringify(r));
      assert.ok(r.col2 && r.col3, 'gehaltene Spalten unverändert, Joker auf ihren Feldern');
      // Retrigger nur über neu gelandete Bonus-Symbole möglich; sonst ist die Bonusrunde vorbei
      if (r.fsLeft === 0){ assert.equal(r.sticky, 0); assert.equal(r.holdFramesAfter, 0); }
    });

    test('alle fünf Walzen gehalten: Runde endet ohne Hänger', async () => {
      await settleAndHold();
      const r = await g.page.evaluate(async () => {
        const S = __t.S; S.freeSpins = 1; S.fsLines = __bandit.buildLines(); S.sticky = [0, 1, 2, 3, 4];
        __bandit.spin(); const t0 = performance.now();
        while (__t.spinning || __t.busy){ await new Promise(r => setTimeout(r, 100)); if (performance.now() - t0 > 20000) return 'HANG'; }
        return { ms: Math.round(performance.now() - t0), fs: S.freeSpins, sticky: S.sticky.length };
      });
      assert.notEqual(r, 'HANG');
      assert.equal(r.fs, 0); assert.equal(r.sticky, 0);
    });

    const scenario = (scen) => g.page.evaluate(async (scen) => {
      const S = __t.S;
      S.freeSpins = scen.fs; S.fsLines = __bandit.buildLines(); S.fsBetIdx = S.betIdx; S.sticky = scen.sticky.slice(); S.fsWon = 0;
      __t.updateSticky();
      const orig = __t.defaultMatrix;
      __t.setMatrix(() => { const m = orig(); for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) if (m[r][c] === 10) m[r][c] = 0; scen.sc.forEach(([r, c]) => m[r][c] = 10); return m; });
      __bandit.spin();
      __t.setMatrix(null);
      const before = S.freeSpins; // nach Abzug
      const t0 = performance.now();
      while (__t.spinning || __t.busy){ await new Promise(r => setTimeout(r, 100)); if (performance.now() - t0 > 30000) return 'HANG'; }
      __t.clearAuto();
      return { afterSpinDeduct: before, after: S.freeSpins };
    }, scen);

    test('Retrigger: 3 Bonus auf freien Walzen bei 2 Freispielen → 1 + 3', async () => {
      await settleAndHold();
      assert.deepEqual(await scenario({ fs: 2, sticky: [], sc: [[0, 0], [1, 2], [2, 4]] }), { afterSpinDeduct: 1, after: 4 });
    });

    test('Retrigger im letzten Freispiel → 0 + 3', async () => {
      await settleAndHold();
      assert.deepEqual(await scenario({ fs: 1, sticky: [], sc: [[0, 0], [1, 2], [2, 4]] }), { afterSpinDeduct: 0, after: 3 });
    });

    test('Retrigger mit gehaltener Walze 2 → 1 + 3', async () => {
      await settleAndHold();
      assert.deepEqual(await scenario({ fs: 2, sticky: [1], sc: [[0, 0], [1, 2], [2, 4]] }), { afterSpinDeduct: 1, after: 4 });
    });

    test('keine Konsolenfehler', () => { assert.deepEqual(g.errors, []); });
  });
}
