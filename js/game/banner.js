/** Gewinn-Banner über der Bühne. */
import { rt } from '../core/runtime.js';
import { S } from '../core/state.js';
import { fmt, now } from '../core/util.js';
import { $ } from '../dom.js';

/* ----- Banner ----- */
export function showBanner(title, amount, sub, opts = {}){
  return new Promise(resolve => {
    if (rt.bannerState) closeBanner();
    const b = $('banner'), st = { resolve, celebrate: !!opts.celebrate };
    rt.bannerState = st;
    $('bannerTitle').textContent = title; $('bannerSub').textContent = sub || 'Tippen zum Fortfahren';
    $('bannerAmt').textContent = amount == null ? '' : '0.00';
    b.hidden = false;
    const inner = b.querySelector('.banner-inner'); inner.style.animation = 'none'; void inner.offsetWidth; inner.style.animation = '';
    if (amount != null){
      const dur = 2600 * (S.turbo ? 0.5 : 1), t0 = now();
      const run = () => {
        if (rt.bannerState !== st) return;
        const x = Math.min(1, (now() - t0) / dur);
        $('bannerAmt').textContent = fmt(amount * (1 - Math.pow(1 - x, 3)));
        if (x < 1) requestAnimationFrame(run);
      };
      run();
    }
    st.timer = setTimeout(closeBanner, (opts.dur || (amount == null ? 3200 : 5000)) * (S.turbo ? 0.6 : 1));
  });
}
export function closeBanner(){
  if (!rt.bannerState) return;
  const st = rt.bannerState; clearTimeout(st.timer); rt.bannerState = null;
  $('banner').hidden = true; if (st.resolve) st.resolve();
}
$('banner').addEventListener('click', closeBanner);
