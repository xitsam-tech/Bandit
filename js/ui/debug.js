/** Debug-Dialog und Self-Tests. */
import { CLOVER, COLS, DIAMOND, FS_AWARD, JOKER, PAY, ROWS, SCATTER, SYMBOLS, WEIGHTS, WHEEL, WHEEL_MIN } from '../core/config.js';
import { applySticky, buildLines, evaluate, heldReels } from '../core/lines.js';
import { xpNeed } from '../core/progression.js';
import { randomMatrix } from '../core/rng.js';
import { rt } from '../core/runtime.js';
import { S } from '../core/state.js';
import { fmt } from '../core/util.js';
import { wheelIndexAt, wheelTarget } from '../core/wheel-math.js';
import { $ } from '../dom.js';
import { N } from '../scene/constants.js';
import { reels } from '../scene/context.js';
import { readVisibleMatrix } from '../scene/reels.js';

export function renderDebug(){
  const grid = $('dbgGrid'); grid.innerHTML = '';
  const m = rt.glOK ? readVisibleMatrix() : (S.matrix || randomMatrix());
  const winSet = new Set(); (rt.lastResult ? rt.lastResult.wins : []).forEach(w => w.cells.forEach(({ r, c }) => winSet.add(r * COLS + c)));
  m.forEach((row, r) => row.forEach((sid, c) => {
    const d = document.createElement('div'); d.className = 'dbg-cell' + (winSet.has(r * COLS + c) ? ' win' : '');
    d.textContent = SYMBOLS[sid].kind === 'bar' ? 'BAR' : SYMBOLS[sid].glyph;
    if (SYMBOLS[sid].kind === 'bar') d.style.fontSize = '13px';
    const tag = document.createElement('span'); tag.textContent = sid; d.appendChild(tag); grid.appendChild(d);
  }));
  const st = S.stats, rtp = st.wagered ? (st.won / st.wagered * 100).toFixed(1) + ' %' : '–';
  $('dbgStats').innerHTML = '';
  [['Drehungen', st.spins], ['Eingesetzt', fmt(st.wagered)], ['Ausgezahlt', fmt(st.won)], ['Quote', rtp],
   ['Höchster Gewinn', fmt(st.biggest)], ['Bonusrunden', st.fsTriggers], ['Glücksräder', st.wheels],
   ['Risiko netto', fmt(st.gambleNet)], ['Jackpots', st.jackpots], ['Level', S.level]]
    .forEach(([k, v]) => {
      const d = document.createElement('div'); d.textContent = k;
      const b = document.createElement('b'); b.textContent = v;
      d.appendChild(b); $('dbgStats').appendChild(d);
    });
}

export function runSelfTests(){
  const out = [], ok = (name, cond) => out.push([name, !!cond]);
  ok('5 Walzen mit je 16 Feldern', reels.length === COLS && reels.every(r => r.slots.length === N));
  if (rt.glOK && !rt.spinning) ok('3D-Walzen zeigen die gespeicherte Matrix', JSON.stringify(readVisibleMatrix()) === JSON.stringify(S.matrix));
  ok('Paar 3–4 erzeugt 4 Linien inkl. Reihe 4', (() => { const L = buildLines([false,false,false,false], [false,false,true]); return L.length === 4 && L.some(l => l.pat.every(v => v === 3)); })());
  ok('Alle Paare = 10 Linien', buildLines([false,false,false,false], [true,true,true]).length === 10);
  ok('Einzelreihe unter Paar wird nicht doppelt gezählt', buildLines([true,false,false,false], [true,false,false]).length === 4);
  const row1 = buildLines([true,false,false,false], [false,false,false]);
  const fill = v => Array.from({ length:ROWS }, () => Array(COLS).fill(v));
  ok('5× Orange auf Reihe 1 zahlt 90×', evaluate(fill(2), row1).lineTotal === PAY[2][2]);
  const mj = fill(1); mj[0] = [JOKER, JOKER, 0, 0, 0];
  ok('Joker ersetzt: J J 🍒 🍒 🍒 = 5× Kirsche', evaluate(mj, row1).lineTotal === PAY[0][2]);
  const mj3 = fill(1); mj3[0] = [JOKER, JOKER, JOKER, 4, 5];
  ok('3 Joker zahlen mehr als 4× Melone', evaluate(mj3, row1).lineTotal === Math.max(PAY[JOKER][0], PAY[4][1]));
  const ms = fill(1); ms[0] = [SCATTER, JOKER, JOKER, JOKER, 0];
  ok('Joker ersetzt kein Bonus-Symbol', evaluate(ms, row1).wins.every(w => w.sym !== SCATTER));
  const md = fill(1); md[0] = [DIAMOND, DIAMOND, JOKER, DIAMOND, DIAMOND];
  ok('5× Diamant (mit Joker) löst Jackpot aus', evaluate(md, row1).jackpot === true);
  const m2 = fill(1); m2[0] = [0, 0, 4, 0, 0];
  ok('Nur 2 in Folge zahlt nichts', evaluate(m2, row1).lineTotal === 0);
  const msc = fill(1); msc[0][0] = msc[1][2] = msc[3][4] = SCATTER;
  ok('3 / 4 / 5 Bonus = 3 / 5 / 8 Freispiele', FS_AWARD(evaluate(msc, row1).scatter.count) === 3 && FS_AWARD(4) === 5 && FS_AWARD(7) === 8);
  ok('Glücksrad landet immer auf dem gezogenen Feld', (() => {
    const seg = Math.PI * 2 / WHEEL.length;
    for (let i = 0; i < WHEEL.length; i++) for (const j of [-0.34, 0, 0.34]) for (const p0 of [0, 1.234, 77.7]){
      if (wheelIndexAt(wheelTarget(p0, i, j * seg, 6)) !== i) return false;
    }
    return true;
  })());
  const mcl = fill(1); mcl[0][0] = mcl[1][1] = mcl[2][3] = mcl[3][4] = CLOVER;
  ok('4× Klee irgendwo zählt fürs Glücksrad', evaluate(mcl, row1).clover.count >= WHEEL_MIN);
  ok('Klebe-Joker landen auf ihren Feldern', (() => { const mm = applySticky(fill(0), [0, 7, 19]); return mm[0][0] === JOKER && mm[1][2] === JOKER && mm[3][4] === JOKER && mm[2][2] === 0; })());
  ok('Walzen mit Klebe-Joker werden gehalten', JSON.stringify(heldReels([1, 7, 13])) === JSON.stringify([false, true, true, true, false]));
  ok('XP-Schwelle steigt pro Level', xpNeed(2) > xpNeed(1) && xpNeed(10) > xpNeed(9));
  ok('Gewichte decken alle Symbole ab', WEIGHTS.length === SYMBOLS.length && PAY.length === SYMBOLS.length);
  const list = $('testList'); list.innerHTML = '';
  out.forEach(([n, pass]) => { const li = document.createElement('li'); li.className = pass ? 'ok' : 'no'; li.textContent = (pass ? '✔ ' : '✖ ') + n; list.appendChild(li); });
  const passed = out.filter(x => x[1]).length;
  const li = document.createElement('li'); li.className = passed === out.length ? 'ok' : 'no'; li.textContent = `${passed}/${out.length} bestanden`; list.appendChild(li);
  return passed === out.length;
}
