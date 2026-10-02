/** Einstieg: Zustand laden, Szene aufbauen, UI binden, Render-Schleife starten. */
import { WHEEL_MIN } from './core/config.js';
import { buildLines, evaluate } from './core/lines.js';
import { defaultRandomMatrix, randomMatrix, setMatrixSource, setRandomSource } from './core/rng.js';
import { rt } from './core/runtime.js';
import { S, loadState, saveState, snapshot } from './core/state.js';
import { fmt } from './core/util.js';
import { $, stage } from './dom.js';
import { settle, spin } from './game/flow.js';
import { gambleCollect, gamblePick, offerGamble } from './game/gamble.js';
import { runWheel } from './game/wheel-flow.js';
import { LCD, drawLCD } from './gfx/lcd.js';
import { SYM, buildSymbolCanvases } from './gfx/symbols.js';
import { Ticker } from './gfx/ticker.js';
import { orbit, resize } from './scene/camera.js';
import { holdFrames, lamps, reels, stickyMeshes, world } from './scene/context.js';
import { canvasTex, circleTex } from './scene/helpers.js';
import { updateLamps } from './scene/lamps.js';
import { loop } from './scene/loop.js';
import { deck } from './scene/lower-cabinet.js';
import { mech } from './scene/mechanics.js';
import { readVisibleMatrix, showMatrixOnReels } from './scene/reels.js';
import { initGL } from './scene/renderer.js';
import { buildSticky, updateSticky } from './scene/sticky.js';
import { applyBrightness, applyCabinetStyle } from './scene/styles.js';
import { drawWheelCanvas } from './scene/wheel.js';
import { bindUI } from './ui/bind.js';
import { say } from './ui/controls.js';
import { runSelfTests } from './ui/debug.js';
import { bindStageInput, ndc, raycaster } from './ui/input.js';
import { syncUI } from './ui/sync.js';

/* =========================================================
   Start
   ========================================================= */
function start(hotData){
  loadState(hotData || {});
  buildSymbolCanvases();
  rt.glOK = initGL();
  if (rt.glOK){
    SYM.forEach(o => { o.tex = canvasTex(o.canvas); o.tex.anisotropy = 8; });
    if (!S.matrix) S.matrix = randomMatrix();
    showMatrixOnReels(S.matrix);
    buildSticky(); updateSticky();
    applyCabinetStyle(S.cabinet);
    applyBrightness();
    bindStageInput();
    if (S.pending){ rt.spinCtx = S.pending; setTimeout(() => { say('Die unterbrochene Runde wird ausgewertet.'); settle(); }, 400); }
    else if (S.wheelPending){
      const stake = S.wheelPending.stake;
      setTimeout(async () => { rt.busy = true; syncUI(); await runWheel(stake, WHEEL_MIN); rt.busy = false; syncUI(); saveState(); }, 700);
    }
    if (S.gambleRefund > 0){
      S.credits = +(S.credits + S.gambleRefund).toFixed(4);
      say(`Unterbrochenes Risiko: ${fmt(S.gambleRefund)} wurden zurückgebucht.`, 'good');
      S.gambleRefund = 0; saveState();
    }
  } else {
    $('glfail').hidden = false; $('stageHint').hidden = true;
  }
  bindUI();
  resize();
  new ResizeObserver(resize).observe(stage);
  window.addEventListener('resize', resize);
  LCD.win.set(fmt(0));
  syncUI();
  if (S.freeSpins > 0) say(`Bonusrunde läuft weiter: ${S.freeSpins} Freispiele übrig, ${S.sticky.length} Joker kleben.`, 'good');
  if (document.fonts && document.fonts.ready){
    document.fonts.ready.then(() => {
      buildSymbolCanvases(); Ticker.refreshFont();
      Object.values(LCD).forEach(o => { drawLCD(o); if (o.tex) o.tex.needsUpdate = true; });
      if (rt.glOK && world.wheel){ drawWheelCanvas(world.wheel.canvas); world.wheel.tex.needsUpdate = true; }
      if (rt.glOK){
        lamps.rows.concat(lamps.pairs).forEach((l, i) => {
          const lbl = i < 4 ? String(i + 1) : `${i - 3}-${i - 2}`;
          l.off = circleTex(lbl, false); l.on = circleTex(lbl, true);
        });
        updateLamps();
      }
    });
  }
  window.claude?.hot?.snapshot?.(() => ({ state: snapshot() }));
  window.__bandit = {
    S, evaluate, buildLines, readVisibleMatrix, runSelfTests, spin, runWheel, offerGamble, gamblePick, get gamble(){ return rt.gamble; }, get busy(){ return rt.busy; },
    // Erweiterter Test-/Debug-Zugang (ersetzt die früheren globalen Namen des Ein-Datei-Scripts)
    rt, world, get spinning(){ return rt.spinning; }, get autoOn(){ return rt.autoOn; },
    get renderer(){ return world.renderer; }, get scene(){ return world.scene; }, get camera(){ return world.camera; }, get composer(){ return world.composer; },
    get coins(){ return world.coins; }, get lever(){ return world.lever; }, get lacquerMat(){ return world.lacquerMat; }, get bokeh(){ return world.bokeh; },
    reels, holdFrames, stickyMeshes, lamps, deck, mech, orbit, stage, raycaster, ndc, Ticker, LCD,
    updateSticky, applyCabinetStyle, gambleCollect,
    randomMatrix: defaultRandomMatrix, setMatrixSource, setRandomSource
  };
  loop();
}
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
