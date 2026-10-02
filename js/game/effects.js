/** Hochzählende Gewinnanzeige (LCD und Pult). */
import { Snd } from '../audio/sound.js';
import { fmt, now } from '../core/util.js';
import { $ } from '../dom.js';
import { LCD } from '../gfx/lcd.js';

export function animateCount(lcd, target){
  const id = lcd._anim = (lcd._anim || 0) + 1;
  const t0 = now(), from = parseFloat(lcd.value) || 0, dur = target > from ? Math.min(2200, 500 + (target - from) * 20) : 0;
  const stepFn = () => {
    if (lcd._anim !== id) return;
    const x = dur ? Math.min(1, (now() - t0) / dur) : 1, v = from + (target - from) * (1 - Math.pow(1 - x, 3));
    if (x < 1 && lcd === LCD.win) Snd.countTick(x);
    lcd.set(fmt(v)); $('lastWin').textContent = fmt(v);
    if (x < 1) requestAnimationFrame(stepFn);
  };
  stepFn();
}
