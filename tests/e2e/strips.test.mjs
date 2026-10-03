// Invariante der festen Walzenstreifen: Die sid-Folge aller Kacheln jeder Walze bleibt in jeder Lage identisch mit
// REEL_STRIPS (normal, Turbo, Quick-Stop, Freispiele mit gehaltenen Walzen, Neuladen mitten im Dreh), und die sichtbare
// Matrix passt immer zu den Stopppositionen.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, targets, selfTests, SELFTEST_OK } from './helpers.mjs';

// Im Browser: Kachel-sids, Erwartung aus REEL_STRIPS, Prüfungen und Warten
const PAGE_HELPERS = `(() => {
  const mod = (a, n) => ((a % n) + n) % n;
  window.__strips = {
    sids: () => __t.reels.map(r => r.slots.map(s => s.sid)),
    // Kachel k zeigt Streifenfeld (1 − k) mod N; beim Lesen von oben nach unten ergibt sich der Streifen
    expected: () => __t.strips.map(st => st.map((_, k) => st[mod(1 - k, st.length)])),
    // Walze von oben nach unten ablesen, beginnend an der Stoppposition → muss der Streifen ab dort sein
    readStripOrder: () => __t.reels.map(r => { const n = r.slots.length, s = Math.round(r.s); return r.slots.map((_, i) => r.slots[mod(s + 1 - i, n)].sid); }),
    check(){
      const b = __bandit, J = JSON.stringify, stops = b.readStops(), vis = b.readVisibleMatrix();
      const order = this.readStripOrder(), rot = stops.map((p, c) => __t.strips[c].map((_, i) => __t.strips[c][(p + i) % __t.strips[c].length]));
      return { tilesOk: J(this.sids()) === J(this.expected()), orderOk: J(order) === J(rot),
        visOk: J(vis) === J(b.matrixFromStops(stops)), stateOk: J(stops) === J(__t.S.stops) && J(vis) === J(__t.S.matrix), stops };
    },
    async idle(ms = 40000){
      const t0 = performance.now();
      while (__t.spinning || __t.busy){ await new Promise(r => setTimeout(r, 100)); if (performance.now() - t0 > ms) return false; }
      __t.clearAuto(); return true;
    }
  };
})();`;

for (const [name, file] of targets({ reels: true })){
  describe(`Feste Walzenstreifen (${name})`, { timeout: 420000 }, () => {
    let g, initial;
    before(async () => {
      g = await openGame({ file, wait: 3000 });
      await g.page.evaluate(() => localStorage.clear());
      await g.reload(3000);
      await g.page.addScriptTag({ content: PAGE_HELPERS });
      initial = await g.page.evaluate(() => __strips.sids());
    });
    after(() => g && g.close());

    const check = async (label) => {
      const r = await g.page.evaluate(() => __strips.check());
      assert.ok(r.tilesOk, label + ': Kacheln = REEL_STRIPS');
      assert.ok(r.orderOk, label + ': von oben gelesen ergibt sich der Streifen ab der Stoppposition');
      assert.ok(r.visOk, label + ': sichtbare Matrix = Streifen an den Stopppositionen');
      assert.ok(r.stateOk, label + ': gespeicherte Stopps/Matrix = Anzeige');
      assert.deepEqual(await g.page.evaluate(() => __strips.sids()), initial, label + ': keine Kachel verändert');
      return r.stops;
    };

    test('Start: Kacheln tragen REEL_STRIPS, Walzen unterscheiden sich', async () => {
      await check('Start');
      const distinct = await g.page.evaluate(() => new Set(__t.strips.map(s => s.join())).size);
      assert.equal(distinct, 5);
      // sid ist schreibgeschützt: ein Schreibversuch ändert nichts (in Modulen würde er werfen)
      const kept = await g.page.evaluate(() => { const sl = __t.reels[0].slots[0], v = sl.sid; try { sl.sid = (v + 1) % 13; } catch(e){} return sl.sid === v; });
      assert.ok(kept);
    });

    test('normaler Dreh mit erzwungenen Stopps landet exakt; Kacheln ändern sich auch während des Drehs nicht', async () => {
      const r = await g.page.evaluate(async () => {
        const want = [3, 9, 14, 0, 7], seen = [];
        __t.setStops(() => want.slice());
        __bandit.spin(); __t.setStops(null);
        const J = JSON.stringify, exp = J(__strips.expected());
        while (__t.spinning){ seen.push(J(__strips.sids()) === exp); await new Promise(r => setTimeout(r, 120)); }
        await __strips.idle();
        return { want, got: __bandit.readStops(), samples: seen.length, allSame: seen.every(Boolean) };
      });
      assert.deepEqual(r.got, r.want);
      assert.ok(r.samples > 3 && r.allSame, `während des Drehs unverändert (${r.samples} Proben)`);
      await check('normal');
    });

    test('Turbo: mehrere Zufallsdrehungen', async () => {
      await g.page.evaluate(() => { __t.S.turbo = true; });
      for (let i = 0; i < 3; i++){
        const ok = await g.page.evaluate(async () => { if (__t.gamble) document.getElementById('gTake').click(); __bandit.spin(); await new Promise(r => setTimeout(r, 200)); return __strips.idle(); });
        assert.ok(ok, 'Dreh endet');
        await check('Turbo ' + (i + 1));
      }
      await g.page.evaluate(() => { __t.S.turbo = false; });
    });

    test('Quick-Stop: Ziel trotzdem exakt, Reihenfolge links → rechts', async () => {
      const r = await g.page.evaluate(async () => {
        if (__t.gamble) document.getElementById('gTake').click();
        const want = [15, 1, 6, 11, 2], order = [], t0 = performance.now();
        __t.setStops(() => want.slice()); __bandit.spin(); __t.setStops(null);
        await new Promise(r => setTimeout(r, 450));
        __bandit.spin();   // = Quick-Stop
        const tq = performance.now(), done = [false, false, false, false, false];
        while (__t.spinning){
          __t.reels.forEach((rl, c) => { if (!done[c] && rl.phase === 'idle'){ done[c] = true; order.push(c); } });
          await new Promise(r => setTimeout(r, 30));
        }
        __t.reels.forEach((rl, c) => { if (!done[c]) order.push(c); });
        const stopMs = performance.now() - tq;
        await __strips.idle();
        return { want, got: __bandit.readStops(), order, stopMs, total: performance.now() - t0 };
      });
      assert.deepEqual(r.got, r.want);
      assert.deepEqual(r.order, [0, 1, 2, 3, 4], 'gestaffelt von links nach rechts: ' + r.order);
      await check('Quick-Stop');
    });

    test('Freispiele: Auslösung, Joker kleben, gehaltene Walzen stehen still und behalten ihre Position', async () => {
      const r = await g.page.evaluate(async () => {
        if (__t.gamble) document.getElementById('gTake').click();
        const S = __t.S, J = JSON.stringify, BONUS = 10, JOKER = 9;
        const trig = __t.findStops(m => m.flat().filter(v => v === BONUS).length === 3 && !m.flat().includes(JOKER));
        // 1. Freispiel: Joker auf Walze 2 und 3, kein Bonus (kein Retrigger)
        const jk = __t.findStops(m => m.some(r => r[1] === JOKER) && m.some(r => r[2] === JOKER) && !m.flat().includes(BONUS));
        const q = [trig, jk];
        __t.setStops(() => q.length ? q.shift() : __bandit.randomStops());
        __bandit.spin(); await __strips.idle(60000);
        const fs0 = S.freeSpins;
        __bandit.spin(); await __strips.idle(60000);
        const sticky = S.sticky.slice(), stopsBefore = __bandit.readStops(), rotBefore = __t.reels.map(r => r.group.rotation.x);
        const visBefore = __bandit.readVisibleMatrix();
        const stickyOnJokers = sticky.every(k => visBefore[Math.floor(k / 5)][k % 5] === JOKER);
        // 2. Freispiel: Walzen 2 und 3 gehalten
        const fsLeft = S.freeSpins;
        let moved = [0, 0, 0, 0, 0], held = null;
        if (fsLeft > 0){
          __bandit.spin(); held = __t.reels.map(r => !!r.held);
          while (__t.spinning){ __t.reels.forEach((r, c) => { moved[c] = Math.max(moved[c], Math.abs(r.group.rotation.x - rotBefore[c])); }); await new Promise(r => setTimeout(r, 60)); }
          await __strips.idle(60000);
        }
        const stopsAfter = __bandit.readStops();
        // Rest der Bonusrunde ablaufen lassen
        while (S.freeSpins > 0){ __bandit.spin(); await __strips.idle(60000); }
        __t.setStops(null);
        return { trig, jk, fs0, sticky, stickyOnJokers, fsLeft, held, moved, stopsBefore, stopsAfter, check: __strips.check() };
      });
      assert.equal(r.fs0, 3, 'drei Bonus → 3 Freispiele');
      assert.ok(r.sticky.length >= 2 && r.stickyOnJokers, 'Klebe-Joker liegen auf echten Jokern: ' + r.sticky);
      assert.ok(r.fsLeft > 0);
      assert.deepEqual(r.held.slice(1, 3), [true, true], 'Walzen 2 und 3 gehalten');
      assert.equal(r.moved[1], 0); assert.equal(r.moved[2], 0);
      assert.deepEqual(r.stopsAfter.slice(1, 3), r.stopsBefore.slice(1, 3), 'gehaltene Walzen behalten ihre Stoppposition');
      await check('Freispiele');
    });

    test('Neuladen mitten im Dreh: Walzen zeigen exakt die Ziel-Stopps, Kacheln unverändert', async () => {
      const want = [5, 12, 8, 1, 10];
      await g.page.evaluate((want) => { if (__t.gamble) document.getElementById('gTake').click(); __t.setStops(() => want.slice()); __bandit.spin(); __t.setStops(null); }, want);
      await g.page.waitForTimeout(350);
      const saved = await g.page.evaluate(() => JSON.parse(localStorage.getItem('einarmigerBandit3d.v1')));
      assert.deepEqual(saved.pending.stops, want, 'Ziel-Stopps des unterbrochenen Drehs gespeichert');
      await g.reload(3500);
      await g.page.addScriptTag({ content: PAGE_HELPERS });
      await g.page.waitForFunction(() => !__t.spinning && !__t.busy && !__t.S.pending, null, { timeout: 30000 });
      await g.page.evaluate(() => __t.clearAuto());
      const stops = await check('nach Neuladen');
      assert.deepEqual(stops, want);
      assert.equal(await selfTests(g.page), SELFTEST_OK);
    });

    test('keine Konsolenfehler', () => { assert.deepEqual(g.errors, []); });
  });
}
