/** Gemeinsame 2D-Canvas-Formen: abgerundetes Rechteck, Segmentformen für 7-/14-Segment-Anzeigen. */

export function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* =========================================================
   Segmentanzeigen: gemeinsame Segmentformen
   ========================================================= */
// Sechseckiges Segment mit spitzen Enden, waagrecht bzw. senkrecht (Breite t, Länge len)
export function segH(ctx, x, y, len, t){
  ctx.beginPath(); ctx.moveTo(x, y + t / 2); ctx.lineTo(x + t / 2, y); ctx.lineTo(x + len - t / 2, y);
  ctx.lineTo(x + len, y + t / 2); ctx.lineTo(x + len - t / 2, y + t); ctx.lineTo(x + t / 2, y + t);
  ctx.closePath(); ctx.fill();
}
export function segV(ctx, x, y, len, t){
  ctx.beginPath(); ctx.moveTo(x + t / 2, y); ctx.lineTo(x + t, y + t / 2); ctx.lineTo(x + t, y + len - t / 2);
  ctx.lineTo(x + t / 2, y + len); ctx.lineTo(x, y + len - t / 2); ctx.lineTo(x, y + t / 2);
  ctx.closePath(); ctx.fill();
}
