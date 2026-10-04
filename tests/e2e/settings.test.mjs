// Einstellungsmenü: Bedienung (Fokus, Esc), Gewinnlinien-Schalter (Standard aus, Overlay leer bzw. gezeichnet),
// Lautstärke und „Bewegung reduzieren“ überleben ein Neuladen, Lautstärke kommt am Master-Gain an, schmale Ansicht.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { clickSetting, openGame, targets } from './helpers.mjs';

/** Anzahl sichtbarer Pixel im Overlay-Canvas (Linien, Hover-Bänder). */
/** Schieberegler setzen wie bei einer Eingabe. */
const setRange = (page, sel, v) => page.evaluate(([sel, v]) => { const el = document.querySelector(sel); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, [sel, String(v)]);

const OVERLAY_PIXELS = () => {
  // auf eine frische Leinwand kopieren (sonst warnt Chromium bei mehrfachem Auslesen des Overlay-Kontexts)
  const src = document.getElementById('fx'), c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
  return n;
};

for (const [name, file] of targets({ reels: true })){
  describe(`Einstellungen (${name})`, { timeout: 300000 }, () => {
    let g;
    before(async () => {
      g = await openGame({ file, wait: 2500 });
      await g.page.evaluate(() => localStorage.clear());
      await g.reload(2500);
    });
    after(() => g && g.close());

    test('Menü: Knopf öffnet den Dialog, Fokus hinein, Esc schließt und gibt den Fokus zurück', async () => {
      // Seitenleiste enthält nur noch Spielbedienung; die Optionen liegen im Menü
      const where = await g.page.evaluate(() => ['cab-neon', 'brightRange', 'soundBtn', 'musicBtn', 'viewBtn', 'debugBtn', 'linesBtn', 'refillBtn', 'volRange', 'reducedBtn']
        .map(id => !!document.getElementById(id).closest('#setModal')));
      assert.ok(where.every(Boolean), 'alle Optionen im Einstellungsmenü: ' + where);
      assert.equal(await g.page.isVisible('#turboBtn'), true, 'Turbo bleibt in der Seitenleiste');
      await g.page.focus('#settingsBtn'); await g.page.keyboard.press('Enter');
      assert.equal(await g.page.isVisible('#setModal'), true);
      assert.equal(await g.page.evaluate(() => !!document.activeElement.closest('#setModal')), true, 'Fokus im Dialog');
      assert.equal(await g.page.getAttribute('#setModal .sheet', 'aria-modal'), 'true');
      await g.page.keyboard.press('Escape');
      assert.equal(await g.page.isVisible('#setModal'), false);
      assert.equal(await g.page.evaluate(() => document.activeElement.id), 'settingsBtn', 'Fokus zurück am Knopf');
    });

    test('Gewinnlinien: Standard aus – nach einem Gewinn bleibt das Overlay leer, Gewinnfelder leuchten', async () => {
      assert.equal(await g.page.evaluate(() => __t.S.showLines), false);
      assert.equal(await g.page.getAttribute('#linesBtn', 'aria-pressed'), 'false');
      const r = await g.page.evaluate(async () => {
        const lines = __bandit.buildLines();
        const st = __t.findStops(m => { const e = __bandit.evaluate(m, lines); return e.lineTotal > 0 && e.lineTotal < 40 && !e.jackpot && e.scatter.count < 3 && e.clover.count < 4; });
        __t.setStops(() => st); __bandit.spin(); __t.setStops(null);
        const t0 = performance.now();
        while ((__t.spinning || __t.busy || !__bandit.rt.present) && performance.now() - t0 < 40000) await new Promise(r => setTimeout(r, 100));
        __t.clearAuto(); if (__t.gamble) document.getElementById('gTake').click();
        __t.orbit.yaw = 0; __t.orbit.pitch = 0.04; __t.orbit.lastInput = performance.now() + 1e9;
        await new Promise(r => setTimeout(r, 4000));
        return { wins: __bandit.rt.present ? __bandit.rt.present.res.wins.length : 0, frames: __bandit.world && __bandit.rt.present ? [...__bandit.rt.present.cells].length : 0 };
      });
      assert.ok(r.wins > 0, 'Gewinn liegt vor');
      assert.ok(r.frames > 0, 'Gewinnfelder werden hervorgehoben');
      assert.equal(await g.page.evaluate(OVERLAY_PIXELS), 0, 'keine Linien im Overlay');
    });

    test('Gewinnlinien an: Overlay zeichnet die Gewinnlinien, Einstellung überlebt ein Neuladen', async () => {
      await clickSetting(g.page, '#linesBtn');
      assert.equal(await g.page.getAttribute('#linesBtn', 'aria-pressed'), 'true');
      await g.page.waitForTimeout(2500);
      assert.ok(await g.page.evaluate(OVERLAY_PIXELS) > 200, 'Linien gezeichnet');
      await g.reload(3000);
      assert.equal(await g.page.evaluate(() => __t.S.showLines), true);
      assert.equal(await g.page.getAttribute('#linesBtn', 'aria-pressed'), 'true');
      await clickSetting(g.page, '#linesBtn');
      assert.equal(await g.page.evaluate(() => __t.S.showLines), false);
    });

    test('Lautstärke und „Bewegung reduzieren“ überleben ein Neuladen, Lautstärke wirkt auf den Master-Gain', async () => {
      const sys = await g.page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
      assert.equal(await g.page.getAttribute('#reducedBtn', 'aria-pressed'), String(sys), 'Standard = Systemeinstellung');
      await g.page.click('#settingsBtn');
      await setRange(g.page, '#volRange', 30);
      await g.page.click('#reducedBtn');
      assert.equal(await g.page.textContent('#volVal'), '30 %');
      assert.equal(await g.page.getAttribute('#reducedBtn', 'aria-pressed'), String(!sys));
      await g.page.click('#setClose');
      await g.reload(3000);
      const st = await g.page.evaluate(() => ({ vol: __t.S.volume, red: __t.S.reduced, fn: __bandit.reducedMotion(), mirror: __bandit.world.mirror ? __bandit.world.mirror.visible : null }));
      assert.equal(st.vol, 30); assert.equal(st.red, !sys); assert.equal(st.fn, !sys);
      if (st.mirror !== null) assert.equal(st.mirror, sys, 'Spiegelboden folgt der Einstellung');
      assert.equal(await g.page.textContent('#volVal'), '30 %');
      assert.equal(await g.page.getAttribute('#reducedBtn', 'aria-pressed'), String(!sys));
      // Audio entsteht erst nach einer Interaktion; dann muss der gespeicherte Wert am Master-Gain anliegen
      await g.page.click('#settingsBtn'); await g.page.waitForTimeout(500);
      const gain = await g.page.evaluate(() => __bandit.Snd.master && __bandit.Snd.master.gain.value);
      assert.ok(Math.abs(gain - 0.3) < 0.02, 'Master-Gain ' + gain);
      await setRange(g.page, '#volRange', 0); await g.page.waitForTimeout(800);
      assert.ok(await g.page.evaluate(() => __bandit.Snd.master.gain.value) < 0.01, 'bei 0 % stumm');
      await g.page.click('#reducedBtn'); await setRange(g.page, '#volRange', 80); await g.page.click('#setClose');
    });

    test('schmale Ansicht: Menü scrollbar, kein horizontaler Überlauf', async () => {
      await g.page.setViewportSize({ width: 360, height: 640 });
      await g.page.waitForTimeout(800);
      await g.page.click('#settingsBtn');
      const m = await g.page.evaluate(() => { const s = document.querySelector('#setModal .sheet'), cs = getComputedStyle(s);
        return { scroll: s.scrollHeight > s.clientHeight, overflow: cs.overflowY, wide: document.documentElement.scrollWidth > innerWidth, fits: s.getBoundingClientRect().right <= innerWidth + 0.5 }; });
      assert.ok(['auto', 'scroll'].includes(m.overflow), 'Sheet scrollt: ' + JSON.stringify(m));
      assert.equal(m.wide, false); assert.equal(m.fits, true);
      await g.page.click('#setClose');
      await g.page.setViewportSize({ width: 1440, height: 900 });
    });

    test('keine Konsolenfehler', () => { assert.deepEqual(g.errors, []); });
  });
}
