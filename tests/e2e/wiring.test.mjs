// Verkabelung des Innenlebens: Kabelenden an Ports, nichts durch Walzen/Bauteile, alles im Gehäuse,
// alle Lampen und Tasten angeschlossen, Platinen-Leiterbahnen nur 0°/45°/90°, Rückholfeder gespannt.
// Nur die Modulfassung hat ein Innenleben mit Kabelbaum (legacy wird übersprungen).
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { clickSetting, openGame, targets } from './helpers.mjs';

for (const [name, file] of targets()){
  if (name === 'legacy') continue;
  describe(`Verkabelung (${name})`, { timeout: 240000 }, () => {
    let g;
    before(async () => { g = await openGame({ file, wait: 3000 }); await clickSetting(g.page, '#cab-glass'); await g.page.waitForTimeout(800); });
    after(() => g && g.close());

    test('Prüfung im Spiel: keine offenen Enden, nichts durch Walzen/Bauteile, alles im Gehäuse', async () => {
      const r = await g.page.evaluate(() => __bandit.mech.checkWiring());
      console.log(`  Kabel ${r.cables}, Ports ${r.ports}, Kabelbinder ${r.ties}, Clips ${r.clips}, min. Walzenabstand ${r.minReelClearance}`);
      assert.ok(r.cables >= 40, 'Kabelanzahl: ' + r.cables);
      assert.deepEqual(r.open, [], 'offene Kabelenden');
      assert.deepEqual(r.reelHits, [], 'Kabel durch Walzen');
      assert.deepEqual(r.solidHits, [], 'Kabel durch Bauteile');
      assert.deepEqual(r.outside, [], 'Kabel außerhalb des Gehäuses');
      assert.deepEqual(r.unconnected, [], 'nicht angeschlossene Pflicht-Anschlüsse');
      assert.deepEqual(r.unusedPorts, [], 'Ports ohne Kabel');
      assert.ok(r.minReelClearance > 0, 'Abstand zu den Walzen');
    });

    test('unabhängige Geometrieprüfung: Enden an Ports, kein Kabelpunkt im Walzenzylinder', async () => {
      const r = await g.page.evaluate(() => {
        const w = __bandit.mech.wiring, reels = __bandit.reels, R = 2.1, half = 0.49 + 0.03;
        const bad = [], far = [];
        w.cables.forEach(c => {
          const s = c.samples, a = w.ports.get(c.from), b = w.ports.get(c.to);
          if (!a || !b || s[0].distanceTo(a.pos) > 0.02 || s[s.length - 1].distanceTo(b.pos) > 0.02) far.push(c.id);
          s.forEach(p => reels.forEach(rl => {
            const o = rl.group.position;
            if (Math.abs(p.x - o.x) < half + c.r && Math.hypot(p.y - o.y, p.z - o.z) < R + 0.08 + c.r) bad.push(c.id);
          }));
        });
        return { bad:[...new Set(bad)], far };
      });
      assert.deepEqual(r.far, [], 'Kabelenden nicht an ihren Ports');
      assert.deepEqual(r.bad, [], 'Kabelpunkte im Walzenzylinder');
    });

    test('jede Lampe, jede Taste, jede Walze, Glühbirnenkranz und Aufsatz haben ein Kabel', async () => {
      const r = await g.page.evaluate(() => {
        const w = __bandit.mech.wiring, ends = new Set(w.cables.flatMap(c => [c.from, c.to]));
        const need = [...__bandit.lamps.rows.map((_, i) => 'lamp.row' + i), ...__bandit.lamps.pairs.map((_, i) => 'lamp.pair' + i),
          ...__bandit.deck.buttons.map(b => 'btn.' + b.id), 'bulbs.feed', 'mq.feed', 'hopper', 'coin.main', 'reject', 'speaker', 'lever.switch',
          'ticker.in', 'lcd.in', 'psu.out', 'mb.power',
          ...__bandit.reels.flatMap((_, c) => ['reel' + c + '.motor', 'reel' + c + '.opto', 'reel' + c + '.led', 'mb.reel' + c])];
        return { missing: need.filter(id => !ends.has(id)), lamps: __bandit.lamps.rows.length + __bandit.lamps.pairs.length, buttons: __bandit.deck.buttons.length };
      });
      assert.equal(r.lamps, 7); assert.equal(r.buttons, 7);
      assert.deepEqual(r.missing, []);
    });

    test('Platinen: alle Leiterbahnen 0°/45°/90°', async () => {
      const r = await g.page.evaluate(() => __bandit.mech.pcbs.map(p => ({ name:p.name, bad:p.stats.bad, seg:p.stats.segments })));
      assert.ok(r.length >= 7, 'Platinen: ' + r.length);
      r.forEach(p => { assert.ok(p.seg > 10, p.name + ': Bahnen'); assert.equal(p.bad, 0, p.name + ': schräge Bahnen'); });
    });

    test('Rückholfeder hängt an Anker und Nockenstift und wird beim Ziehen gestreckt', async () => {
      const len0 = await g.page.evaluate(() => __bandit.mech.spring.userData.len);
      await g.page.evaluate(() => { const l = __bandit.lever; l.drag = true; l.target = 1.35; });
      await g.page.waitForFunction(() => __bandit.lever.angle > 1.3, null, { timeout: 30000 });
      await g.page.waitForTimeout(300);
      const r = await g.page.evaluate(() => {
        const s = __bandit.mech.spring, cam = __bandit.mech.cam;
        const pin = new THREE.Vector3(-0.07, 0, -0.26).applyMatrix4(cam.matrixWorld);
        const top = s.userData.top.getWorldPosition(new THREE.Vector3()), bot = s.userData.bot.getWorldPosition(new THREE.Vector3());
        return { len: s.userData.len, topToPin: top.distanceTo(pin), botToAnchor: bot.distanceTo(s.position) };
      });
      await g.page.evaluate(() => { const l = __bandit.lever; l.drag = false; l.target = 0; });
      assert.ok(r.len > len0 * 1.1, `Feder gestreckt: ${len0.toFixed(3)} → ${r.len.toFixed(3)}`);
      assert.ok(Math.abs(r.topToPin - 0.05) < 0.01, 'obere Öse am Nockenstift');
      assert.ok(Math.abs(r.botToAnchor - 0.05) < 0.01, 'untere Öse am Anker');
    });

    test('keine Konsolenfehler', () => { assert.deepEqual(g.errors, []); });
  });
}
