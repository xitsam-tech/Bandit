// Gemeinsame Helfer für die Browser-Tests (Playwright + lokaler Server).
// Pfade lassen sich per Umgebungsvariable überschreiben:
//   PLAYWRIGHT_DIR  – Ordner des Pakets „playwright“, falls es nicht per npm installiert ist
//   THREE_DIR       – Ordner mit dem Paket three@0.128.0 (build/, examples/js/); CDN-Anfragen werden dorthin umgeleitet
//   CHROMIUM_PATH   – ausführbares Chromium
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../../tools/serve.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRATCH = '/tmp/claude-0/-home-user-bitget-scanner/7273a71e-7b86-504a-99de-1e0fdfe7f08b/scratchpad';
export const SCREENS = path.join(ROOT, 'tests/e2e/screens');

function firstExisting(list){ return list.find(p => p && existsSync(p)); }

function loadPlaywright(){
  const dir = firstExisting([process.env.PLAYWRIGHT_DIR, path.join(ROOT, 'node_modules/playwright'), path.join(SCRATCH, 'node_modules/playwright')]);
  if (!dir) throw new Error('Playwright nicht gefunden – „npm install“ ausführen oder PLAYWRIGHT_DIR setzen.');
  return require(dir);
}
const THREE_DIR = firstExisting([process.env.THREE_DIR, path.join(ROOT, 'node_modules/three'), path.join(SCRATCH, 'three128/package')]);
const CHROMIUM = firstExisting([process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium']);

export const FILES = { neu: 'index.html', legacy: 'legacy/einarmiger-bandit-3d.html' };
/**
 * Welche Fassung(en) getestet werden: E2E_TARGET=neu (Standard) | legacy | beide.
 * „legacy“ prüft dieselben Erwartungen gegen die Ein-Datei-Referenz (Gleichwertigkeit) – aber nur für Tests, die
 * nicht von den Walzeninhalten abhängen: Die neue Fassung hat feste Walzenstreifen, die Referenz zieht jedes Feld einzeln.
 * @param {{ reels?: boolean }} [opts]  reels: Test hängt von Walzeninhalten/Stopppositionen ab → nur die neue Fassung
 * @returns {[string, string][]} Paare [Name, Datei]
 */
export function targets({ reels = false } = {}){
  const t = process.env.E2E_TARGET || 'neu';
  if (!(t === 'beide' || FILES[t])) throw new Error('E2E_TARGET unbekannt: ' + t);
  const list = t === 'beide' ? Object.entries(FILES) : [[t, FILES[t]]];
  return reels ? list.filter(([n]) => n === 'neu') : list;
}

// Einheitlicher Testzugang `window.__t` für beide Fassungen: die Modulversion liefert alles über __bandit,
// die Legacy-Datei über ihre globalen Namen. Wird lazy beim ersten Zugriff gebaut (nach start()).
const ADAPTER = `Object.defineProperty(window, '__t', { configurable: true, get(){
  const b = window.__bandit; let t;
  if (b.rt){
    t = { legacy:false, b, S:b.S, get spinning(){ return b.rt.spinning; }, get busy(){ return b.rt.busy; }, get autoOn(){ return b.rt.autoOn; },
      get gamble(){ return b.rt.gamble; }, reels:b.reels, holdFrames:b.holdFrames, orbit:b.orbit, mech:b.mech,
      get coins(){ return b.coins; }, get lacquerMat(){ return b.lacquerMat; }, updateSticky:b.updateSticky,
      setStops: fn => b.setStopSource(fn), findStops: b.findStops, readStops: b.readStops, strips: b.REEL_STRIPS,
      clearAuto: () => clearTimeout(b.rt.autoTimer), get camera(){ return b.camera; } };
  } else {
    t = { legacy:true, b, S:b.S, get spinning(){ return spinning; }, get busy(){ return b.busy; }, get autoOn(){ return autoOn; },
      get gamble(){ return b.gamble; }, reels, holdFrames, orbit, mech,
      get coins(){ return coins; }, get lacquerMat(){ return lacquerMat; }, updateSticky,
      clearAuto: () => clearTimeout(autoTimer), get camera(){ return camera; } };
  }
  Object.defineProperty(window, '__t', { value: t, configurable: true });
  return t;
} });`;

/**
 * Startet Server + Browser und öffnet eine Seite des Projekts.
 * @param {{ file?: string, viewport?: { width:number, height:number }, wait?: number, init?: string }} [opts]  init: zusätzliches Init-Script (läuft vor jedem Laden)
 */
export async function openGame({ file = 'index.html', viewport = { width: 1440, height: 900 }, wait = 3000, init } = {}){
  if (!THREE_DIR) throw new Error('three@0.128.0 nicht gefunden – „npm install“ ausführen oder THREE_DIR setzen.');
  const { chromium } = loadPlaywright();
  const srv = await startServer({ port: 0, root: ROOT });
  const browser = await chromium.launch({
    executablePath: CHROMIUM,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']
  });
  const page = await browser.newPage({ viewport });
  await page.route(/cdn\.jsdelivr\.net\/npm\/three@0\.128\.0\/(.*)/, r => {
    const m = r.request().url().match(/three@0\.128\.0\/(.*)$/);
    r.fulfill({ path: path.join(THREE_DIR, m[1]), contentType: 'application/javascript' });
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.addInitScript(ADAPTER);
  if (init) await page.addInitScript(init);
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR ' + e.message + (process.env.STACK ? '\n' + e.stack : '')));
  page.on('console', m => {
    if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('ERR_FAILED')) errors.push(m.type() + ': ' + m.text().slice(0, 300));
  });
  const url = srv.url + file;
  await page.goto(url);
  if (wait) await page.waitForTimeout(wait);
  return {
    page, errors, url, browser,
    /** Neu laden (gleicher Ursprung → localStorage bleibt) und warten. */
    async reload(ms = wait){ await page.reload(); if (ms) await page.waitForTimeout(ms); },
    async close(){ await browser.close(); await srv.close(); }
  };
}

/** Anzahl der Self-Tests im Spiel (bei ruhenden Walzen). */
export const SELFTEST_OK = '20/20 bestanden';

/** Self-Tests im Debug-Dialog ausführen und die Ergebniszeile liefern. */
export function selfTests(page){
  return page.evaluate(() => { __bandit.runSelfTests(); return document.querySelector('#testList li:last-child').textContent; });
}

/**
 * Bedienelement klicken, das im Einstellungsmenü liegt: Menü öffnen, klicken, Menü wieder schließen.
 * Elemente außerhalb des Menüs (oder in der Legacy-Fassung ohne Menü) werden direkt geklickt.
 * @param {any} page  @param {string} sel
 */
export async function clickSetting(page, sel){
  const inMenu = await page.evaluate(s => { const el = document.querySelector(s); return !!(el && el.closest('#setModal')); }, sel);
  if (!inMenu) return page.click(sel);
  if (await page.evaluate(() => document.getElementById('setModal').hidden)) await page.click('#settingsBtn');
  await page.click(sel);
  if (!(await page.evaluate(() => document.getElementById('setModal').hidden))) await page.click('#setClose');
}
