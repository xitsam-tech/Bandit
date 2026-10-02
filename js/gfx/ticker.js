/** LED-Laufschrift oben am Automaten (14-Segment-Anzeige auf Canvas). */
import { activeLines, betValue } from '../core/lines.js';
import { rt } from '../core/runtime.js';
import { S } from '../core/state.js';
import { fmt, now } from '../core/util.js';
import { segH, segV } from './canvas2d.js';

/* =========================================================
   LED-Laufschrift (Canvas-Textur oben am Automaten)
   ========================================================= */
export const Ticker = (() => {
  // 14-Segment-Anzeige (wie Textanzeigen echter Automaten): Ziffern, Buchstaben, Punkte
  const NCH = 22, W = 1680, H = 140, CW = W / NCH;
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  // Bits: A=1 B=2 C=4 D=8 E=16 F=32 G1=64 G2=128 H=256 J=512 K=1024 L=2048 M=4096 N=8192 DP=16384
  const FONT = {
    '0':0x0C3F, '1':0x0006, '2':0x00DB, '3':0x008F, '4':0x00E6, '5':0x00ED, '6':0x00FD, '7':0x0007, '8':0x00FF, '9':0x00EF,
    A:0x00F7, B:0x128F, C:0x0039, D:0x120F, E:0x0079, F:0x0071, G:0x00BD, H:0x00F6, I:0x1209, J:0x001E, K:0x2470, L:0x0038, M:0x0536,
    N:0x2136, O:0x003F, P:0x00F3, Q:0x203F, R:0x20F3, S:0x00ED, T:0x1201, U:0x003E, V:0x0C30, W:0x2836, X:0x2D00, Y:0x1500, Z:0x0C09,
    ' ':0, '-':0x00C0, '–':0x00C0, '=':0x00C8, '+':0x12C0, '/':0x0C00, '×':0x2D00, '!':0x4006, '?':0x5083, '·':0x4000, ':':0x4000, '*':0x3FC0
  };
  const ALIAS = { 'Ä':'A', 'Ö':'O', 'Ü':'U', 'ß':'S' };
  let cells = [], color = '#7fb2ff', key = '', scroll0 = 0, lastOffset = null, holdUntil = 0, idleIdx = 0, idleNext = 0, dirty = true, texture = null;

  function toCells(text){
    const out = [];
    for (const raw of text.toUpperCase()){
      const ch = ALIAS[raw] || raw;
      if ((ch === '.' || ch === ',') && out.length && !(out[out.length - 1] & 0x4000)){ out[out.length - 1] |= 0x4000; continue; }
      out.push(FONT[ch] !== undefined ? FONT[ch] : (ch === '.' ? 0x4000 : 0));
    }
    return out;
  }
  const hseg = (x, y, len, t) => segH(ctx, x, y, len, t);
  const vseg = (x, y, len, t) => segV(ctx, x, y, len, t);
  function dseg(x1, y1, x2, y2, t){
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), nx = -dy / l * t * 0.42, ny = dx / l * t * 0.42;
    ctx.beginPath(); ctx.moveTo(x1 + nx, y1 + ny); ctx.lineTo(x2 + nx, y2 + ny); ctx.lineTo(x2 - nx, y2 - ny); ctx.lineTo(x1 - nx, y1 - ny); ctx.closePath(); ctx.fill();
  }
  function glyph(bits, x, y, w, h){
    const t = w * 0.15, g = t * 0.18, hw = w / 2, hh = h / 2;
    const P = [
      () => hseg(x + t / 2 + g, y, w - t - 2 * g, t),                 // A
      () => vseg(x + w - t, y + t / 2 + g, hh - t / 2 - 2 * g, t),    // B
      () => vseg(x + w - t, y + hh + g, hh - t / 2 - 2 * g, t),       // C
      () => hseg(x + t / 2 + g, y + h - t, w - t - 2 * g, t),          // D
      () => vseg(x, y + hh + g, hh - t / 2 - 2 * g, t),               // E
      () => vseg(x, y + t / 2 + g, hh - t / 2 - 2 * g, t),            // F
      () => hseg(x + t / 2 + g, y + hh - t / 2, hw - t / 2 - 2 * g, t),  // G1
      () => hseg(x + hw + g, y + hh - t / 2, hw - t / 2 - 2 * g, t),     // G2
      () => dseg(x + t * 1.25, y + t * 1.25, x + hw - t * 0.7, y + hh - t * 0.75, t),   // H
      () => vseg(x + hw - t / 2, y + t + g, hh - t * 1.5 - 2 * g, t),                   // J
      () => dseg(x + w - t * 1.25, y + t * 1.25, x + hw + t * 0.7, y + hh - t * 0.75, t), // K
      () => dseg(x + t * 1.25, y + h - t * 1.25, x + hw - t * 0.7, y + hh + t * 0.75, t), // L
      () => vseg(x + hw - t / 2, y + hh + t / 2 + g, hh - t * 1.5 - 2 * g, t),          // M
      () => dseg(x + w - t * 1.25, y + h - t * 1.25, x + hw + t * 0.7, y + hh + t * 0.75, t), // N
      () => { ctx.beginPath(); ctx.arc(x + w + t * 0.75, y + h - t * 0.5, t * 0.5, 0, Math.PI * 2); ctx.fill(); } // DP
    ];
    for (let k = 0; k < 15; k++) if (bits & (1 << k)) P[k]();
  }
  function draw(offset){
    ctx.fillStyle = '#060208'; ctx.fillRect(0, 0, W, H);
    const gh = H * 0.74, gw = gh * 0.56, top = (H - gh) / 2;
    ctx.save(); ctx.transform(1, 0, -0.1, 1, top * 0.1 + 6, 0);
    for (let k = 0; k < NCH; k++){
      const x = k * CW + (CW - gw) / 2 - CW * 0.06;
      ctx.fillStyle = color + '12'; glyph(0x7FFF, x, top, gw, gh);
      const bits = cells[k - offset];
      if (!bits) continue;
      ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 16;
      glyph(bits, x, top, gw, gh);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
  function set(text, col = '#ffc83a', hold = 2600){
    const k2 = text + col;
    if (k2 !== key){ key = k2; cells = toCells(text); color = col; scroll0 = now(); dirty = true; }
    holdUntil = now() + hold;
  }
  function idleText(){
    const lines = activeLines().length;
    const list = [
      [`JACKPOT ${fmt(S.jackpot)}`, '#7fb2ff'],
      [lines ? `${lines} LINIEN × ${fmt(betValue())} = ${fmt(lines * betValue())}` : 'BITTE LINIEN WÄHLEN', lines ? '#35e2ff' : '#ff3d9a'],
      ['5× DIAMANT = JACKPOT', '#ffc83a'],
      ['3× BONUS = FREISPIELE', '#ff3d9a'],
      ['4× KLEE = GLÜCKSRAD', '#7dff9b'],
      [`LEVEL ${S.level}`, '#c79bff']
    ];
    return list[idleIdx % list.length];
  }
  function update(t){
    if (t > holdUntil && !rt.spinning && t > idleNext){ const [txt, col] = idleText(); set(txt, col, 0); holdUntil = 0; idleNext = t + 3600; idleIdx++; }
    let offset;
    if (cells.length > NCH){
      // Marquee: Zeichen für Zeichen von rechts herein
      const step = Math.floor((t - scroll0) / 170) % (cells.length + NCH);
      offset = NCH - step;
    } else offset = Math.floor((NCH - cells.length) / 2);
    if (offset !== lastOffset || dirty){ draw(offset); lastOffset = offset; dirty = false; if (texture) texture.needsUpdate = true; }
  }
  return { canvas, set, update, bindTexture(t){ texture = t; }, refreshFont(){ dirty = true; } };
})();
