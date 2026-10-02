/** Symbol-Grafiken: Vektorzeichnung je Symbol und Walzenkacheln (Canvas → Textur und Gewinnplan). */
import { JOKER, SCATTER, SYMBOLS } from '../core/config.js';
import { roundRect } from './canvas2d.js';

/* =========================================================
   Symbol-Grafiken (Canvas → Textur und Gewinnplan)
   ========================================================= */
const TILE_W = 256, TILE_H = 208;
/* ----- Vektor-Symbole (eigene Grafik, keine Emoji) ----- */
/* drawSymbolArt(ctx, sid, cx, cy, size)
   sid: 0 Kirsche 1 Zitrone 2 Orange 3 Pfirsich 4 Wassermelone 5 Glocke 6 Stern
        7 Sieben 8 BAR 9 Joker 10 Bonus 11 Diamant 12 Kleeblatt
   Arbeitet intern in einem 100x100-Raster (-50..50), zeichnet nur in cx±size/2, cy±size/2. */
export function drawSymbolArt(ctx, sid, cx, cy, size) {
  var PI = Math.PI, OUT = '#2a1208', i, a;
  var FONT = "Bungee, Impact, 'Arial Black', sans-serif";
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 100, size / 100);
  ctx.beginPath(); ctx.rect(-50, -50, 100, 100); ctx.clip();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.setLineDash([]);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.miterLimit = 2;

  function lg(x0, y0, x1, y1, st) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (var k = 0; k < st.length; k += 2) g.addColorStop(st[k], st[k + 1]);
    return g;
  }
  function rg(x0, y0, r0, x1, y1, r1, st) {
    var g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
    for (var k = 0; k < st.length; k += 2) g.addColorStop(st[k], st[k + 1]);
    return g;
  }
  function shadow(yy, rx, ry) {
    ctx.save(); ctx.translate(0, yy); ctx.scale(1, ry / rx);
    ctx.fillStyle = rg(0, 0, 0, 0, 0, rx, [0, 'rgba(0,0,0,0.42)', 0.55, 'rgba(0,0,0,0.2)', 1, 'rgba(0,0,0,0)']);
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, PI * 2); ctx.fill(); ctx.restore();
  }
  function outline(lw, col) { ctx.lineWidth = lw || 4; ctx.strokeStyle = col || OUT; ctx.stroke(); }
  function hl(px, py, rx, ry, rot, al) {
    ctx.save(); ctx.translate(px, py); ctx.rotate(rot);
    ctx.fillStyle = lg(0, -ry, 0, ry, [0, 'rgba(255,255,255,' + al + ')', 1, 'rgba(255,255,255,' + (al * 0.12) + ')']);
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, PI * 2); ctx.fill(); ctx.restore();
  }
  function dot(px, py, r, al) {
    ctx.fillStyle = 'rgba(255,255,255,' + al + ')'; ctx.beginPath(); ctx.arc(px, py, r, 0, PI * 2); ctx.fill();
  }
  function spark(px, py, r, al) {
    var q = r * 0.14;
    ctx.fillStyle = 'rgba(255,255,255,' + al + ')'; ctx.beginPath();
    ctx.moveTo(px, py - r); ctx.quadraticCurveTo(px + q, py - q, px + r, py);
    ctx.quadraticCurveTo(px + q, py + q, px, py + r); ctx.quadraticCurveTo(px - q, py + q, px - r, py);
    ctx.quadraticCurveTo(px - q, py - q, px, py - r); ctx.fill();
  }
  function rr(px, py, w, h, r) {
    ctx.beginPath(); ctx.moveTo(px + r, py); ctx.lineTo(px + w - r, py); ctx.quadraticCurveTo(px + w, py, px + w, py + r);
    ctx.lineTo(px + w, py + h - r); ctx.quadraticCurveTo(px + w, py + h, px + w - r, py + h);
    ctx.lineTo(px + r, py + h); ctx.quadraticCurveTo(px, py + h, px, py + h - r);
    ctx.lineTo(px, py + r); ctx.quadraticCurveTo(px, py, px + r, py); ctx.closePath();
  }
  function leaf(x0, y0, x1, y1, bend) { // gruenes Blatt von (x0,y0) nach (x1,y1)
    var mx = (x0 + x1) / 2, my = (y0 + y1) / 2, nx = -(y1 - y0), ny = (x1 - x0);
    ctx.beginPath(); ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(mx + nx * bend, my + ny * bend, x1, y1);
    ctx.quadraticCurveTo(mx - nx * bend, my - ny * bend, x0, y0); ctx.closePath();
    ctx.fillStyle = lg(x0, y0, x1, y1, [0, '#c8f56a', 0.5, '#4fbf3a', 1, '#1d7a2a']); ctx.fill();
    outline(3.2);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * 0.85, y0 + (y1 - y0) * 0.85);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.1; ctx.stroke();
  }

  switch (sid) {
  case 0: { // Kirsche
    shadow(43, 34, 4.5);
    var stems = [[-17, 3, -14, -14, -3, -28, 6, -35], [20, 8, 19, -8, 15, -26, 6, -35]];
    for (i = 0; i < 2; i++) {
      var s = stems[i]; ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.bezierCurveTo(s[2], s[3], s[4], s[5], s[6], s[7]);
      ctx.strokeStyle = OUT; ctx.lineWidth = 6.4; ctx.stroke();
      ctx.strokeStyle = lg(0, -35, 0, 8, [0, '#9acb3c', 1, '#4f8a22']); ctx.lineWidth = 3; ctx.stroke();
    }
    leaf(6, -35, 40, -38, 0.3);
    var ch = [[-18, 21], [20, 26]];
    for (i = 0; i < 2; i++) {
      var ccx = ch[i][0], ccy = ch[i][1], r = 19;
      ctx.beginPath(); ctx.arc(ccx, ccy, r, 0, PI * 2);
      ctx.fillStyle = rg(ccx - 6, ccy - 8, 2, ccx + 1, ccy + 1, r + 2, [0, '#ff9ea4', 0.3, '#ee1c35', 0.8, '#a00020', 1, '#6e0014']); ctx.fill();
      ctx.save(); ctx.clip();
      ctx.beginPath(); ctx.arc(ccx + 7, ccy + 9, r - 1, 0, PI * 2);
      ctx.strokeStyle = 'rgba(255,120,130,0.45)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
      ctx.beginPath(); ctx.arc(ccx, ccy, r, 0, PI * 2); outline(4);
      ctx.fillStyle = 'rgba(60,0,10,0.55)'; ctx.beginPath(); ctx.ellipse(ccx, ccy - r + 3, 3.2, 1.6, 0, 0, PI * 2); ctx.fill();
      hl(ccx - 7, ccy - 7, 6.5, 3.6, -0.75, 0.95); dot(ccx + 8, ccy + 8, 1.6, 0.5);
    }
    break;
  }
  case 1: { // Zitrone
    shadow(40, 34, 4.5);
    ctx.save(); ctx.translate(0, 2); ctx.rotate(-0.3);
    ctx.beginPath(); ctx.moveTo(-46, 0);
    ctx.bezierCurveTo(-40, -1, -36, -29, 0, -29); ctx.bezierCurveTo(36, -29, 40, -1, 46, 0);
    ctx.bezierCurveTo(40, 1, 36, 29, 0, 29); ctx.bezierCurveTo(-36, 29, -40, 1, -46, 0); ctx.closePath();
    ctx.fillStyle = lg(0, -29, 0, 29, [0, '#fffa8a', 0.3, '#ffe22a', 0.75, '#f0b800', 1, '#b88400']); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(150,100,0,0.28)';
    for (i = 0; i < 16; i++) { a = i * 2.399; var rd = Math.sqrt((i + 0.5) / 16) * 30; ctx.beginPath(); ctx.arc(Math.cos(a) * rd, Math.sin(a) * rd * 0.8, 0.9, 0, PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(-46, 0);
    ctx.bezierCurveTo(-40, -1, -36, -29, 0, -29); ctx.bezierCurveTo(36, -29, 40, -1, 46, 0);
    ctx.bezierCurveTo(40, 1, 36, 29, 0, 29); ctx.bezierCurveTo(-36, 29, -40, 1, -46, 0); ctx.closePath();
    outline(4);
    hl(-10, -15, 17, 5, -0.05, 0.85); hl(-36, -4, 4, 1.8, -0.4, 0.7); dot(22, 14, 2.4, 0.4);
    ctx.restore();
    break;
  }
  case 2: { // Orange
    shadow(42, 32, 4.5);
    ctx.beginPath(); ctx.arc(0, 6, 36, 0, PI * 2);
    ctx.fillStyle = rg(-12, -8, 3, 2, 8, 42, [0, '#ffd88a', 0.3, '#ff9d1c', 0.75, '#ec6200', 1, '#a93a00']); ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(130,40,0,0.28)';
    for (i = 0; i < 24; i++) { a = i * 2.399; var r2 = Math.sqrt((i + 0.5) / 24) * 32; ctx.beginPath(); ctx.arc(Math.cos(a) * r2, 6 + Math.sin(a) * r2, 1, 0, PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 6, 36, 0, PI * 2); outline(4);
    ctx.fillStyle = 'rgba(90,30,0,0.6)'; ctx.beginPath(); ctx.ellipse(0, -28, 5, 2.4, 0, 0, PI * 2); ctx.fill();
    leaf(2, -29, 34, -40, 0.32);
    ctx.beginPath(); ctx.moveTo(0, -27); ctx.lineTo(0, -33); ctx.strokeStyle = OUT; ctx.lineWidth = 4.2; ctx.stroke();
    ctx.strokeStyle = '#7a5a20'; ctx.lineWidth = 1.8; ctx.stroke();
    hl(-14, -9, 11, 6, -0.7, 0.9); dot(-22, 2, 1.8, 0.7);
    break;
  }
  case 3: { // Pfirsich
    shadow(41, 32, 4.5);
    ctx.save(); ctx.translate(0, -1);
    var peach = function () {
      ctx.beginPath(); ctx.moveTo(0, -23);
      ctx.bezierCurveTo(10, -33, 38, -29, 38, -1); ctx.bezierCurveTo(38, 24, 18, 38, 0, 38);
      ctx.bezierCurveTo(-18, 38, -38, 24, -38, -1); ctx.bezierCurveTo(-38, -29, -10, -33, 0, -23); ctx.closePath();
    };
    peach();
    ctx.fillStyle = rg(-14, -8, 3, 4, 8, 50, [0, '#ffeab8', 0.28, '#ffb36c', 0.6, '#ff7660', 1, '#c02a52']); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = rg(22, 18, 2, 22, 18, 30, [0, 'rgba(210,30,70,0.55)', 1, 'rgba(210,30,70,0)']); ctx.fillRect(-50, -50, 100, 100);
    ctx.beginPath(); ctx.moveTo(0, -23); ctx.bezierCurveTo(9, -8, 10, 14, 2, 38);
    ctx.strokeStyle = 'rgba(150,20,50,0.55)'; ctx.lineWidth = 2.6; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3, -20); ctx.bezierCurveTo(5, -6, 6, 14, -2, 36);
    ctx.strokeStyle = 'rgba(255,230,190,0.5)'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore();
    peach(); outline(4);
    hl(-20, -9, 8, 13, 0.5, 0.9); dot(-26, 8, 1.8, 0.7);
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.quadraticCurveTo(0, -28, -3, -32);
    ctx.strokeStyle = OUT; ctx.lineWidth = 4.4; ctx.stroke(); ctx.strokeStyle = '#8a5a22'; ctx.lineWidth = 2; ctx.stroke();
    leaf(2, -28, 34, -36, 0.32);
    ctx.restore();
    break;
  }
  case 4: { // Wassermelone
    var wy = -31;
    var melon = function (r) {
      ctx.save(); ctx.translate(0, wy); ctx.scale(1, 1.38); ctx.beginPath(); ctx.arc(0, 0, r, 0, PI, false); ctx.closePath(); ctx.restore();
    };
    shadow(37, 36, 4.5);
    melon(45); ctx.fillStyle = lg(0, wy, 0, 32, [0, '#5fc24a', 0.5, '#2e9a34', 1, '#14602a']); ctx.fill();
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(10,70,25,0.45)'; ctx.lineWidth = 2.4;
    for (i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-34 + i * 22, wy + 50); ctx.quadraticCurveTo(-30 + i * 20, wy + 20, -44 + i * 29, wy); ctx.stroke(); }
    ctx.restore();
    melon(40); ctx.fillStyle = '#f2fbd0'; ctx.fill();
    melon(36); ctx.fillStyle = rg(0, wy, 2, 0, wy + 4, 46, [0, '#ff8f94', 0.5, '#ff3d52', 1, '#d90f2c']); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#1b0c0c';
    var sd = [[-22, 11], [0, 12], [22, 11], [-11, 28], [11, 28]];
    for (i = 0; i < 5; i++) {
      ctx.save(); ctx.translate(sd[i][0], wy + sd[i][1]); ctx.rotate(i % 2 ? 0.35 : -0.35);
      ctx.beginPath(); ctx.moveTo(0, -4.6); ctx.bezierCurveTo(3.4, -1.5, 2.8, 3.8, 0, 4.6); ctx.bezierCurveTo(-2.8, 3.8, -3.4, -1.5, 0, -4.6);
      ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-0.9, -1.4, 0.7, 1.4, 0, 0, PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#1b0c0c';
    }
    ctx.restore();
    melon(45); outline(4);
    ctx.beginPath(); ctx.moveTo(-45, wy); ctx.lineTo(45, wy); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.2; ctx.stroke();
    hl(-28, wy + 26, 3.2, 10, 0.4, 0.8); hl(-12, wy + 6, 9, 2.6, -0.1, 0.55);
    break;
  }
  case 5: { // Glocke
    shadow(44, 30, 4);
    var bell = function () {
      ctx.beginPath(); ctx.moveTo(0, -34);
      ctx.bezierCurveTo(-18, -34, -26, -16, -26, 2); ctx.bezierCurveTo(-26, 16, -34, 22, -42, 28);
      ctx.quadraticCurveTo(-45, 34, -38, 34); ctx.lineTo(38, 34); ctx.quadraticCurveTo(45, 34, 42, 28);
      ctx.bezierCurveTo(34, 22, 26, 16, 26, 2); ctx.bezierCurveTo(26, -16, 18, -34, 0, -34); ctx.closePath();
    };
    var gold = [0, '#a86200', 0.18, '#f0b21c', 0.36, '#fff5a8', 0.52, '#ffd23a', 0.8, '#d28f08', 1, '#8a5200'];
    ctx.beginPath(); ctx.arc(0, 37, 6.5, 0, PI * 2); ctx.fillStyle = rg(-2, 35, 1, 0, 37, 8, [0, '#fff0a0', 0.5, '#e8a810', 1, '#8a5200']); ctx.fill(); outline(3.6);
    ctx.beginPath(); ctx.arc(0, -37, 5.2, 0, PI * 2); ctx.fillStyle = rg(-1.5, -38.5, 1, 0, -37, 6, [0, '#fff6b0', 0.5, '#f0b020', 1, '#9a6000']); ctx.fill(); outline(3.6);
    bell(); ctx.fillStyle = lg(-42, 0, 42, 0, gold); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = lg(0, 22, 0, 35, [0, '#ffe064', 0.4, '#d99410', 1, '#8a5200']); ctx.fillRect(-50, 23, 100, 14);
    ctx.fillStyle = 'rgba(90,40,0,0.7)'; ctx.fillRect(-50, 22.4, 100, 1.4);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-50, 24.4, 100, 1.2);
    ctx.restore();
    bell(); outline(4);
    ctx.beginPath(); ctx.moveTo(-15, -26); ctx.bezierCurveTo(-21, -14, -21, 2, -19, 14);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 4; ctx.stroke();
    spark(-8, -24, 6, 0.9); dot(-31, 29, 1.4, 0.7);
    break;
  }
  case 6: { // Stern
    var Cx = 0, Cy = 3, R = 46, ri = 19.5;
    var pt = function (k, rad) { var an = -PI / 2 + k * PI / 5; return [Cx + Math.cos(an) * rad, Cy + Math.sin(an) * rad]; };
    var star = function () {
      ctx.beginPath(); for (var k = 0; k < 10; k++) { var p = pt(k, k % 2 ? ri : R); k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.closePath();
    };
    shadow(42, 30, 4.5);
    star(); ctx.fillStyle = rg(-8, -8, 2, 0, 3, 50, [0, '#fff3a0', 0.5, '#ffd23a', 1, '#e0a010']); ctx.fill();
    for (i = 0; i < 5; i++) {
      var T = pt(2 * i, R), L = pt(2 * i - 1, ri), Rt = pt(2 * i + 1, ri);
      ctx.beginPath(); ctx.moveTo(Cx, Cy); ctx.lineTo(T[0], T[1]); ctx.lineTo(L[0], L[1]); ctx.closePath();
      ctx.fillStyle = rg(Cx, Cy, 0, Cx, Cy, R, [0, '#fff0a0', 1, '#ffd02e']); ctx.fill();
      ctx.beginPath(); ctx.moveTo(Cx, Cy); ctx.lineTo(T[0], T[1]); ctx.lineTo(Rt[0], Rt[1]); ctx.closePath();
      ctx.fillStyle = rg(Cx, Cy, 0, Cx, Cy, R, [0, '#f5b41c', 1, '#b86e00']); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(110,50,0,0.55)'; ctx.lineWidth = 1.2;
    for (i = 0; i < 5; i++) { var T2 = pt(2 * i, R); ctx.beginPath(); ctx.moveTo(Cx, Cy); ctx.lineTo(T2[0], T2[1]); ctx.stroke(); }
    star(); outline(4);
    hl(-8, -13, 8, 3.2, -1.05, 0.85); spark(-22, -8, 7, 0.9); dot(-3, -27, 1.6, 0.8);
    break;
  }
  case 7: { // Sieben
    var seven = function () {
      ctx.beginPath(); ctx.moveTo(-34, -38); ctx.lineTo(37, -38); ctx.lineTo(37, -30);
      ctx.bezierCurveTo(24, -10, 12, 18, 8, 40); ctx.lineTo(-15, 40);
      ctx.bezierCurveTo(-11, 14, 0, -6, 13, -22); ctx.lineTo(-34, -22); ctx.closePath();
    };
    shadow(44, 28, 4);
    ctx.save(); ctx.translate(0, 1);
    seven(); ctx.strokeStyle = OUT; ctx.lineWidth = 12; ctx.stroke();
    ctx.strokeStyle = lg(0, -38, 0, 40, [0, '#fff8b8', 0.35, '#ffd02e', 0.7, '#e89c10', 1, '#a86a00']); ctx.lineWidth = 6.6; ctx.stroke();
    ctx.fillStyle = lg(0, -38, 0, 40, [0, '#ff8070', 0.3, '#f01a26', 0.75, '#c00a18', 1, '#800010']); ctx.fill();
    ctx.strokeStyle = 'rgba(70,0,10,0.7)'; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.fillStyle = lg(0, -38, 0, -25, [0, 'rgba(255,255,255,0.6)', 1, 'rgba(255,255,255,0)']); ctx.fillRect(-40, -38, 80, 13);
    ctx.beginPath(); ctx.moveTo(26, -20); ctx.bezierCurveTo(18, -4, 8, 16, 3, 34);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    spark(-28, -32, 5, 0.9);
    ctx.restore();
    break;
  }
  case 8: { // BAR
    shadow(43, 36, 4.5);
    var bars = [-38, 3];
    for (i = 0; i < 2; i++) {
      var by = bars[i], bh = 34;
      rr(-42, by, 84, bh, 7); ctx.fillStyle = lg(0, by, 0, by + bh, [0, '#fff0a0', 0.4, '#e8aa18', 1, '#8a5600']); ctx.fill();
      rr(-38.5, by + 3.5, 77, bh - 7, 4.5); ctx.fillStyle = lg(0, by, 0, by + bh, [0, '#5a5a66', 0.15, '#2a2a32', 0.6, '#0c0c10', 1, '#000']); ctx.fill();
      ctx.save(); rr(-38.5, by + 3.5, 77, bh - 7, 4.5); ctx.clip();
      ctx.fillStyle = lg(0, by + 3, 0, by + 17, [0, 'rgba(255,255,255,0.28)', 1, 'rgba(255,255,255,0.02)']); ctx.fillRect(-40, by + 3, 80, 14); ctx.restore();
      rr(-38.5, by + 3.5, 77, bh - 7, 4.5); ctx.strokeStyle = 'rgba(40,20,0,0.9)'; ctx.lineWidth = 1.2; ctx.stroke();
      rr(-42, by, 84, bh, 7); outline(4);
      ctx.font = '23px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var tw = ctx.measureText('BAR').width, px = 23; if (tw > 0) px = Math.max(14, Math.min(30, 23 * 56 / tw));
      ctx.font = px + 'px ' + FONT;
      var ty = by + bh / 2 + 1;
      ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText('BAR', 0, ty);
      ctx.fillStyle = lg(0, ty - 11, 0, ty + 11, [0, '#fff6b0', 0.5, '#ffd02e', 1, '#c88a08']); ctx.fillText('BAR', 0, ty);
    }
    break;
  }
  case 9: { // Joker
    shadow(44, 28, 3.8);
    // Kragen
    ctx.beginPath(); ctx.moveTo(-34, 24); ctx.lineTo(-34, 45); ctx.lineTo(-22.7, 35); ctx.lineTo(-11.3, 45); ctx.lineTo(0, 35);
    ctx.lineTo(11.3, 45); ctx.lineTo(22.7, 35); ctx.lineTo(34, 45); ctx.lineTo(34, 24); ctx.closePath();
    ctx.fillStyle = lg(0, 24, 0, 45, [0, '#b060f0', 1, '#5a1aa0']); ctx.fill(); outline(3.4);
    var tips = [-34, -11.3, 11.3, 34];
    for (i = 0; i < 4; i++) {
      var bxx = tips[i] + (i === 0 ? 3 : i === 3 ? -3 : 0);
      ctx.beginPath(); ctx.arc(bxx, 43, 2.6, 0, PI * 2); ctx.fillStyle = '#ffd23a'; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = OUT; ctx.stroke();
    }
    // Gesicht
    ctx.beginPath(); ctx.arc(0, 16, 25, 0, PI * 2);
    ctx.fillStyle = rg(-8, 8, 2, 0, 16, 30, [0, '#fff6e4', 0.5, '#fbd9b0', 1, '#e0a070']); ctx.fill(); outline(3.6);
    ctx.fillStyle = 'rgba(255,90,110,0.45)';
    ctx.beginPath(); ctx.arc(-15, 24, 5, 0, PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(15, 24, 5, 0, PI * 2); ctx.fill();
    for (var e = -1; e <= 1; e += 2) {
      ctx.beginPath(); ctx.ellipse(e * 9, 14, 5.2, 4.4, 0, 0, PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.beginPath(); ctx.arc(e * 8, 14.4, 2.5, 0, PI * 2); ctx.fillStyle = '#3a1070'; ctx.fill(); dot(e * 8 - 0.8, 13.4, 0.8, 1);
      ctx.beginPath(); ctx.moveTo(e * 15, 9); ctx.quadraticCurveTo(e * 9, 4.5, e * 3.5, 8); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 21, 4.2, 0, PI * 2); ctx.fillStyle = rg(-1, 19.5, 0.5, 0, 21, 5, [0, '#ff9a9a', 0.5, '#e8182a', 1, '#900018']); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = OUT; ctx.stroke(); dot(-1.3, 19.6, 1, 0.9);
    var mouth = function () { ctx.beginPath(); ctx.moveTo(-12, 28); ctx.bezierCurveTo(-8, 39, 8, 39, 12, 28); ctx.bezierCurveTo(6, 31, -6, 31, -12, 28); ctx.closePath(); };
    mouth(); ctx.fillStyle = '#8a0a24'; ctx.fill(); ctx.save(); mouth(); ctx.clip(); ctx.fillStyle = '#fff'; ctx.fillRect(-14, 27, 28, 3.4); ctx.restore();
    mouth(); ctx.lineWidth = 1.8; ctx.strokeStyle = OUT; ctx.stroke();
    hl(-12, 4, 9, 3.4, -0.6, 0.55);
    // Hut
    var hat = function () {
      ctx.beginPath(); ctx.moveTo(-27, -3); ctx.bezierCurveTo(-32, -12, -36, -22, -39, -27);
      ctx.bezierCurveTo(-28, -27, -16, -22, -10, -17); ctx.bezierCurveTo(-9, -26, -5, -33, 0, -37);
      ctx.bezierCurveTo(5, -33, 9, -26, 10, -17); ctx.bezierCurveTo(16, -22, 28, -27, 39, -27);
      ctx.bezierCurveTo(36, -22, 32, -12, 27, -3); ctx.closePath();
    };
    hat(); ctx.fillStyle = lg(-39, -30, 0, 0, [0, '#b25cf0', 1, '#7a2cc8']); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = lg(0, 2, 40, -26, [0, '#4e1696', 1, '#8a38d8']); ctx.beginPath(); ctx.moveTo(10, -17); ctx.lineTo(60, -40); ctx.lineTo(60, 4); ctx.lineTo(14, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10, -17); ctx.lineTo(-8, -45); ctx.lineTo(8, -45); ctx.lineTo(10, -17); ctx.lineTo(14, 0); ctx.lineTo(-14, 0); ctx.closePath();
    ctx.fillStyle = lg(-10, 0, 10, 0, [0, '#ffe36a', 0.5, '#fff3a8', 1, '#e0a010']); ctx.fill();
    ctx.strokeStyle = 'rgba(40,10,70,0.7)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-10, -17); ctx.lineTo(-14, 0); ctx.moveTo(10, -17); ctx.lineTo(14, 0); ctx.stroke();
    ctx.restore();
    hat(); outline(3.8);
    hl(-27, -20, 6, 2, -0.9, 0.6);
    var bells = [[-39, -27], [0, -38], [39, -27]];
    for (i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(bells[i][0], bells[i][1], 4.8, 0, PI * 2);
      ctx.fillStyle = rg(bells[i][0] - 1.5, bells[i][1] - 1.7, 0.5, bells[i][0], bells[i][1], 6, [0, '#fff8c0', 0.5, '#ffc828', 1, '#a86800']); ctx.fill(); outline(2.6);
    }
    rr(-29, -9, 58, 11, 5); ctx.fillStyle = lg(0, -9, 0, 2, [0, '#fff0a0', 0.45, '#ffc828', 1, '#a86800']); ctx.fill(); outline(3.2);
    for (i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 14, -7.2); ctx.lineTo(i * 14 + 2.6, -3.5); ctx.lineTo(i * 14, 0.2); ctx.lineTo(i * 14 - 2.6, -3.5); ctx.closePath(); ctx.fillStyle = '#7a2cc8'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = OUT; ctx.stroke(); }
    break;
  }
  case 10: { // Bonus
    var burst = function (n, Ro, Ri, rot, vary) {
      ctx.beginPath();
      for (var k = 0; k < n * 2; k++) {
        var an = rot + k * PI / n, rad = k % 2 ? Ri : Ro - (vary ? ((k >> 1) % 3) * 3.2 : 0);
        k ? ctx.lineTo(Math.cos(an) * rad, Math.sin(an) * rad) : ctx.moveTo(Math.cos(an) * rad, Math.sin(an) * rad);
      }
      ctx.closePath();
    };
    shadow(44, 30, 3.6);
    burst(16, 46, 32, -PI / 2, false); ctx.fillStyle = rg(-8, -10, 4, 0, 0, 50, [0, '#ff7a30', 0.55, '#e81c0c', 1, '#9a0600']); ctx.fill(); outline(4);
    burst(16, 46, 32, -PI / 2, false); ctx.strokeStyle = 'rgba(255,170,90,0.55)'; ctx.lineWidth = 1.4; ctx.save(); ctx.clip(); ctx.lineWidth = 3.2; ctx.stroke(); ctx.restore();
    burst(16, 38, 26, -PI / 2 + PI / 16, false); ctx.fillStyle = rg(-5, -6, 2, 0, 0, 38, [0, '#fffbb0', 0.4, '#ffc41e', 1, '#ff7a00']); ctx.fill();
    ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(150,30,0,0.8)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, PI * 2); ctx.fillStyle = rg(-4, -5, 1, 0, 0, 18, [0, '#ffffff', 0.45, '#fff2a0', 1, '#ffb01e']); ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(160,40,0,0.85)'; ctx.stroke();
    ctx.save(); ctx.translate(0, 1); ctx.beginPath();
    for (i = 0; i < 10; i++) { a = -PI / 2 + i * PI / 5; var q = i % 2 ? 5.2 : 12.5; i ? ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q) : ctx.moveTo(Math.cos(a) * q, Math.sin(a) * q); }
    ctx.closePath(); ctx.fillStyle = lg(0, -12, 0, 10, [0, '#ff5a1a', 1, '#c80c00']); ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = '#6a1000'; ctx.stroke(); ctx.restore();
    hl(-24, -26, 10, 3.6, -0.85, 0.8); spark(-33, -12, 5, 0.9); dot(26, 24, 1.8, 0.7);
    break;
  }
  case 11: { // Diamant
    ctx.save(); ctx.translate(0, -6);
    var P = { G0: [-44, -8], Ga: [-17, -8], Gm: [0, -8], Gb: [17, -8], G3: [44, -8], T0: [-24, -28], Tm: [0, -28], T1: [24, -28], B: [0, 42] };
    var DOUT = '#0a1a46';
    var facet = function (names, col) {
      ctx.beginPath(); for (var k = 0; k < names.length; k++) { var p = P[names[k]]; k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.closePath();
      ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1.1; ctx.stroke();
    };
    ctx.save(); ctx.translate(0, 6); shadow(40, 30, 4.2); ctx.restore();
    facet(['G0', 'T0', 'Ga'], lg(-44, -28, -17, -8, [0, '#b8ecff', 1, '#64c4f8']));
    facet(['T0', 'Tm', 'Gm', 'Ga'], lg(-24, -28, 0, -8, [0, '#f0fcff', 1, '#a8e6ff']));
    facet(['Tm', 'T1', 'Gb', 'Gm'], lg(0, -28, 24, -8, [0, '#c4f0ff', 1, '#6cc8fa']));
    facet(['T1', 'G3', 'Gb'], lg(24, -28, 44, -8, [0, '#58b4f4', 1, '#2a78d8']));
    facet(['G0', 'Ga', 'B'], lg(-44, -8, 0, 42, [0, '#3c9cf0', 1, '#1a64c8']));
    facet(['Ga', 'Gm', 'B'], lg(-17, -8, 0, 42, [0, '#7ad0ff', 1, '#2a86e0']));
    facet(['Gm', 'Gb', 'B'], lg(0, -8, 17, 42, [0, '#2c80dc', 1, '#1450b0']));
    facet(['Gb', 'G3', 'B'], lg(17, -8, 44, 42, [0, '#1c5cc0', 1, '#0c3488']));
    ctx.beginPath(); var order = ['G0', 'T0', 'T1', 'G3', 'B']; for (i = 0; i < 5; i++) { var pp = P[order[i]]; i ? ctx.lineTo(pp[0], pp[1]) : ctx.moveTo(pp[0], pp[1]); } ctx.closePath();
    ctx.save(); ctx.clip(); ctx.fillStyle = lg(0, -28, 0, 14, [0, 'rgba(255,255,255,0.35)', 1, 'rgba(255,255,255,0)']); ctx.fillRect(-50, -30, 100, 44); ctx.restore();
    outline(4, DOUT);
    ctx.beginPath(); ctx.moveTo(-44, -8); ctx.lineTo(44, -8); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
    spark(-26, -19, 9, 0.95); spark(28, 4, 5.5, 0.85); dot(-8, 16, 1.6, 0.6);
    ctx.restore();
    break;
  }
  case 12: { // Kleeblatt
    var rot0 = PI / 4, sc = 1.28, ox = 0, oy = -3;
    var heart = function (rot) {
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(rot); ctx.scale(sc, sc);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-4, -4, -20, -11, -20, -24); ctx.bezierCurveTo(-20, -33, -8, -35, 0, -26);
      ctx.bezierCurveTo(8, -35, 20, -33, 20, -24); ctx.bezierCurveTo(20, -11, 4, -4, 0, 0); ctx.closePath(); ctx.restore();
    };
    shadow(44, 24, 3.6);
    ctx.beginPath(); ctx.moveTo(0, -3); ctx.bezierCurveTo(2, 12, 11, 26, 3, 42);
    ctx.strokeStyle = OUT; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = lg(0, 0, 0, 42, [0, '#4cbf3c', 1, '#1a7a2a']); ctx.lineWidth = 3.2; ctx.stroke();
    for (i = 0; i < 4; i++) {
      var rt = rot0 + i * PI / 2;
      heart(rt); ctx.fillStyle = lg(-34, -40, 34, 32, [0, '#b8f870', 0.45, '#3cc040', 1, '#0e7228']); ctx.fill(); outline(4, '#08280f');
      ctx.save(); ctx.translate(ox, oy); ctx.rotate(rt); ctx.scale(sc, sc);
      ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(1.5, -14, 0, -23); ctx.strokeStyle = 'rgba(8,70,25,0.5)'; ctx.lineWidth = 1.5 / sc; ctx.stroke();
      hl(-10.5, -23, 5.2, 2.8, -0.55, 0.6);
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, -3, 3, 0, PI * 2); ctx.fillStyle = rg(-0.8, -4, 0.5, 0, -3, 3.5, [0, '#fff6b0', 1, '#d8920a']); ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = '#08280f'; ctx.stroke();
    break;
  }
  }
  ctx.restore();
}

function drawSymbol(ctx, sid){
  const w = TILE_W, h = TILE_H, s = SYMBOLS[sid];
  ctx.clearRect(0, 0, w, h);
  // bedruckter Walzenstreifen: cremefarben, Mitte heller, oben/unten goldene Trennlinie
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#e9d9b4'); g.addColorStop(0.18, '#fbf3df'); g.addColorStop(0.5, '#fffaf0'); g.addColorStop(0.82, '#fbf3df'); g.addColorStop(1, '#e9d9b4');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const rg = ctx.createRadialGradient(w / 2, h * 0.45, 8, w / 2, h / 2, w * 0.62);
  rg.addColorStop(0, '#ffffff99'); rg.addColorStop(1, '#ffffff00');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  const sg = ctx.createLinearGradient(0, 0, w, 0);
  sg.addColorStop(0, '#00000030'); sg.addColorStop(0.07, '#00000000'); sg.addColorStop(0.93, '#00000000'); sg.addColorStop(1, '#00000030');
  ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#b8924a'; ctx.fillRect(0, 0, w, 2); ctx.fillRect(0, h - 2, w, 2);
  ctx.fillStyle = '#ffffff80'; ctx.fillRect(0, 2, w, 1); ctx.fillRect(0, h - 3, w, 1);
  const cy = s.tag ? h * 0.42 : h * 0.5;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // Vektorgrafik steht im selben Script; ein Zeichenfehler soll nur die Kachel leer lassen, nicht den Start abbrechen
  try { drawSymbolArt(ctx, sid, w / 2, cy, s.tag ? 138 : 164); } catch(e){ console.error(e); }
  if (s.tag){
    const col = sid === JOKER ? ['#8b4dff', '#4b1aa8'] : sid === SCATTER ? ['#ff4d8a', '#a80d45'] : ['#2fc6ef', '#086c8c'];
    const bg = ctx.createLinearGradient(0, h - 50, 0, h - 14); bg.addColorStop(0, col[0]); bg.addColorStop(1, col[1]);
    roundRect(ctx, 40, h - 48, w - 80, 32, 16); ctx.fillStyle = bg; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#ffe9a0'; ctx.stroke();
    ctx.font = '700 22px "Chakra Petch", system-ui, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(s.tag, w / 2, h - 31);
  }
}
export const SYM = SYMBOLS.map(() => ({ canvas:null, tex:null }));
export function buildSymbolCanvases(){
  SYM.forEach((o, sid) => {
    if (!o.canvas){ o.canvas = document.createElement('canvas'); o.canvas.width = TILE_W; o.canvas.height = TILE_H; }
    drawSymbol(o.canvas.getContext('2d'), sid);
    if (o.tex) o.tex.needsUpdate = true;
  });
}
