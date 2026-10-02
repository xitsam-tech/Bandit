/** Hintergrundmusik: kleiner Synth-Sequencer (Am – F – C – G), schneller beim Drehen. */
import { Snd } from './sound.js';
import { rt } from '../core/runtime.js';
import { S } from '../core/state.js';

/* ----- Hintergrundmusik ----- */
// kleiner Synth-Sequencer (Am – F – C – G), wird beim Drehen schneller
export const Music = {
  gain:null, timer:0, step:0, nextT:0,
  sync(){ if (S.music && S.sound) this.start(); else this.stop(); },
  start(){
    if (this.timer) return;
    const c = Snd.ensure(); if (!c) return;
    this.gain = c.createGain();
    this.gain.gain.setValueAtTime(0.0001, c.currentTime);
    this.gain.gain.exponentialRampToValueAtTime(0.55, c.currentTime + 1.5);
    Snd.out(this.gain, 0, 0.22);
    this.nextT = c.currentTime + 0.08;
    this.timer = setInterval(() => this.sched(), 40);
  },
  stop(){
    if (!this.timer) return;
    clearInterval(this.timer); this.timer = 0;
    const c = Snd.ctx, g = this.gain; this.gain = null;
    if (c && g){
      g.gain.cancelScheduledValues(c.currentTime); g.gain.setValueAtTime(Math.max(0.0002, g.gain.value), c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.4); setTimeout(() => g.disconnect(), 600);
    }
  },
  sched(){
    const c = Snd.ctx; if (!c || !this.gain) return;
    const st = 60 / (rt.spinning ? 132 : 112) / 4;
    while (this.nextT < c.currentTime + 0.25){ this.play(this.step, this.nextT, st); this.nextT += st; this.step++; }
  },
  note(f, t, d, type, vol){
    const c = Snd.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(this.gain); o.start(t); o.stop(t + d + 0.05);
  },
  hat(t, vol){
    const c = Snd.ctx, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = Snd.noiseBuf; f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f).connect(g).connect(this.gain); src.start(t); src.stop(t + 0.07);
  },
  play(i, t, st){
    const PROG = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
    const ch = PROG[Math.floor(i / 16) % 4], s16 = i % 16;
    if (s16 % 4 === 0) this.note(ch[0] / 2, t, st * 3.4, 'triangle', 0.16);
    if (s16 % 8 === 6) this.note(ch[0] / 2 * 1.5, t, st * 1.6, 'triangle', 0.09);
    if (s16 % 2 === 0) this.note(ch[(s16 / 2) % 3] * 2, t, st * 1.7, 'square', 0.022);
    if (s16 % 4 === 2) this.hat(t, 0.05);
    if (s16 === 0) ch.forEach(f => this.note(f * 2, t, st * 15, 'sine', 0.022));
  }
};
