// Gehäusewahl, Glas-Innenleben, Münzschale, Ansichten (Vorlagen: run8.js, glass.js, traytest.js, mechlook.js).
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, targets, selfTests } from './helpers.mjs';

for (const [name, file] of targets()){
  describe(`Gehäuse & Münzschale (${name})`, { timeout: 300000 }, () => {
    let g;
    before(async () => { g = await openGame({ file, wait: 3000 }); });
    after(() => g && g.close());

    test('Gehäusewahl Holz: Zustand, Knopfstatus, kein horizontaler Überlauf', async () => {
      await g.page.click('#cab-wood'); await g.page.waitForTimeout(1500);
      assert.equal(await g.page.evaluate(() => __t.S.cabinet), 'wood');
      assert.equal(await g.page.getAttribute('#cab-wood', 'aria-pressed'), 'true');
      assert.equal(await g.page.getAttribute('#cab-neon', 'aria-pressed'), 'false');
      assert.equal(await g.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await g.page.textContent('#status'), 'Gehäuse: Holz.');
    });

    test('Glas zeigt das Innenleben, Holz verbirgt es wieder', async () => {
      await g.page.click('#cab-glass'); await g.page.waitForTimeout(1500);
      const glass = await g.page.evaluate(() => ({ cab: __t.S.cabinet, parts: __t.mech.parts.length, visible: __t.mech.parts.every(o => o.visible),
        back: __t.mech.backPlate.visible, transparent: __t.lacquerMat.transparent, opacity: __t.lacquerMat.opacity }));
      assert.deepEqual(glass, { cab: 'glass', parts: glass.parts, visible: true, back: false, transparent: true, opacity: 0.09 });
      assert.ok(glass.parts > 100, 'viele Innenteile');
      await g.page.click('#cab-wood'); await g.page.waitForTimeout(800);
      assert.deepEqual(await g.page.evaluate(() => ({ hidden: __t.mech.parts.every(o => !o.visible), transparent: __t.lacquerMat.transparent, back: __t.mech.backPlate.visible })),
        { hidden: true, transparent: false, back: true });
    });

    test('Mega Win: Münzen landen in der Schale', async () => {
      await g.page.evaluate(() => { const orig = __t.defaultMatrix; let n = 0; __t.setMatrix(() => (++n === 1 ? Array.from({ length: 4 }, () => Array(5).fill(5)) : orig())); __bandit.spin(); });
      await g.page.waitForTimeout(1000);
      await g.page.waitForFunction(() => !__t.spinning && !__t.busy, null, { timeout: 40000 });
      await g.page.evaluate(() => { __t.setMatrix(null); if (__t.gamble) document.getElementById('gTake').click(); __t.orbit.yaw = 0.36; __t.orbit.pitch = 0.1; __t.orbit.zoom = 1; });
      // Münzphysik rechnet pro Bild (dt ≤ 50 ms); Software-Rendering liefert nur wenige Bilder pro Sekunde → großzügig warten
      await g.page.waitForFunction(() => __t.coins.items.some(i => i.alive && i.rest), null, { timeout: 90000 }).catch(() => {});
      const r = await g.page.evaluate(() => ({ rest: __t.coins.items.filter(i => i.alive && i.rest).length, flying: __t.coins.items.filter(i => i.alive && !i.rest).length, won: __t.S.stats.won }));
      assert.equal(r.won, 900, '10 Linien × 180 × 0,50');
      assert.ok(r.rest >= 1, `Münzen in der Schale: ${r.rest} (noch unterwegs: ${r.flying})`);
    });

    test('Glas: keine Innenteile außerhalb des Gehäuses', async () => {
      await g.page.click('#cab-glass'); await g.page.waitForTimeout(500);
      const bad = await g.page.evaluate(() => { const bad = [], bb = new THREE.Box3(), c = new THREE.Vector3();
        __t.mech.parts.forEach(o => o.traverse(m => { if (!m.isMesh) return; bb.setFromObject(m); bb.getCenter(c);
          if (Math.abs(c.x) > 4.2 || c.y < -5.6 || c.y > 5.2 || c.z < -4.5 || c.z > 1.6) bad.push(m.geometry.type); })); return bad; });
      assert.deepEqual(bad, []);
    });

    test('Ansicht: 3D → Frontal → Drehteller; Drehteller dreht', async () => {
      await g.page.click('#viewBtn'); assert.equal(await g.page.textContent('#viewBtn'), 'Ansicht: Frontal');
      await g.page.click('#viewBtn'); assert.equal(await g.page.textContent('#viewBtn'), 'Ansicht: Drehteller');
      const y0 = await g.page.evaluate(() => __t.orbit.yaw); await g.page.waitForTimeout(3000);
      const dy = await g.page.evaluate(() => __t.orbit.yaw) - y0;
      // Software-Rendering liefert nur wenige Bilder pro Sekunde (dt ist pro Bild auf 50 ms begrenzt) → nur Richtung prüfen
      assert.ok(dy > 0.01, 'Drehung in 3 s: ' + dy.toFixed(2) + ' rad');
      await g.page.click('#viewBtn'); assert.equal(await g.page.textContent('#viewBtn'), 'Ansicht: 3D');
      assert.equal(await selfTests(g.page), '18/18 bestanden');
    });

    test('keine Konsolenfehler', () => { assert.deepEqual(g.errors, []); });
  });
}
