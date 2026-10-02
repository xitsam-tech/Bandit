/** Soundeffekte über Web Audio (startet erst nach einer Interaktion). */
import { rand } from '../core/rng.js';
import { S } from '../core/state.js';
import { clamp, now } from '../core/util.js';

/* =========================================================
   Sound (Web Audio, startet erst nach einer Interaktion)
   ========================================================= */
export const Snd = {
  ctx:null, master:null, bus:null, rev:null, noiseBuf:null, loop:null, lastTick:new Array(8).fill(0), lastCount:0,
  ensure(){
    if (!this.ctx){
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
      try { this.ctx = new AC(); } catch(e){ return null; }
      const c = this.ctx;
      // Signalweg: Quellen → Bus → Kompressor → Master; Hall als Send parallel
      this.master = c.createGain(); this.master.gain.value = 0.8; this.master.connect(c.destination);
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.22;
      comp.connect(this.master);
      this.bus = c.createGain(); this.bus.gain.value = 0.75; this.bus.connect(comp);
      try {
        const conv = c.createConvolver(), len = Math.floor(c.sampleRate * 2.2), ir = c.createBuffer(2, len, c.sampleRate);
        for (let ch = 0; ch < 2; ch++){
          const d = ir.getChannelData(ch);
          for (let i = 0; i < len; i++){ const x = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - x, 3.2) * (i < 80 ? i / 80 : 1); }
        }
        conv.buffer = ir;
        const wet = c.createGain(); wet.gain.value = 0.32;
        conv.connect(wet).connect(comp);
        this.rev = conv;
      } catch(e){ this.rev = null; }
      const len = c.sampleRate, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = b;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },
  // Ausgang mit Panorama und Hall-Anteil
  out(node, pan = 0, rev = 0.15){
    const c = this.ctx; let n = node;
    if (pan && c.createStereoPanner){ const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); n.connect(p); n = p; }
    n.connect(this.bus);
    if (this.rev && rev > 0){ const s = c.createGain(); s.gain.value = rev; n.connect(s); s.connect(this.rev); }
  },
  tone(f, d, o = {}){
    if (!S.sound) return; const c = this.ensure(); if (!c) return;
    const t = c.currentTime + (o.at || 0), osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + d * (o.glide || 1));
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.vol ?? 0.2, t + (o.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    let src = osc;
    if (o.lp){ const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.setValueAtTime(o.lp, t); if (o.lpTo) f2.frequency.exponentialRampToValueAtTime(o.lpTo, t + d); f2.Q.value = o.q || 0.8; osc.connect(f2); src = f2; }
    src.connect(g); this.out(g, o.pan || 0, o.rev ?? 0.15);
    osc.start(t); osc.stop(t + d + 0.05);
  },
  // FM-Glocke: klingt nach Münze / Glockenspiel
  bell(f, d, o = {}){
    if (!S.sound) return; const c = this.ensure(); if (!c) return;
    const t = c.currentTime + (o.at || 0), car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.value = f; mod.frequency.value = f * (o.ratio || 3.5);
    mg.gain.setValueAtTime(f * (o.index || 2.2), t); mg.gain.exponentialRampToValueAtTime(f * 0.05, t + d * 0.7);
    mod.connect(mg).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.vol ?? 0.12, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    car.connect(g); this.out(g, o.pan || 0, o.rev ?? 0.3);
    car.start(t); mod.start(t); car.stop(t + d + 0.05); mod.stop(t + d + 0.05);
  },
  noise(d, o = {}){
    if (!S.sound) return; const c = this.ensure(); if (!c) return;
    const t = c.currentTime + (o.at || 0), src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf; src.playbackRate.value = o.rate || 1;
    f.type = o.type || 'bandpass'; f.frequency.value = o.freq || 2000; f.Q.value = o.q || 1;
    g.gain.setValueAtTime(o.vol ?? 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f).connect(g); this.out(g, o.pan || 0, o.rev ?? 0.08);
    src.start(t, Math.random() * 0.5); src.stop(t + d + 0.02);
  },

  /* ----- Walzen ----- */
  // Motor/Surren während des Drehens; Pegel folgt der mittleren Geschwindigkeit
  spinLoop(level){
    if (!S.sound){ if (this.loop) this.stopLoop(); return; }
    const c = this.ensure(); if (!c) return;
    if (!this.loop && level > 0.02){
      // Walzen-Surren: Rauschen mit fester Tonlage, rhythmisch zerhackt (Stepper-Rattern) – keine Tonhöhenfahrt
      const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2300; bp.Q.value = 0.7;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const am = c.createGain(); am.gain.value = 0.55;
      const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 17;
      const depth = c.createGain(); depth.gain.value = 0.45; lfo.connect(depth).connect(am.gain);
      const g = c.createGain(); g.gain.value = 0.0001;
      src.connect(bp).connect(hp).connect(am).connect(g);
      this.out(g, 0, 0.04); src.start(); lfo.start();
      this.loop = { src, lfo, g };
    }
    if (this.loop){
      this.loop.g.gain.setTargetAtTime(Math.max(0.0001, Math.min(1, level) * 0.05), c.currentTime, 0.08);
      if (level <= 0.02) this.stopLoop();
    }
  },
  stopLoop(){
    if (!this.loop) return;
    const l = this.loop, c = this.ctx; this.loop = null;
    l.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.06);
    setTimeout(() => { try { l.src.stop(); l.lfo.stop(); } catch(e){} }, 400);
  },
  // Rasterklick, wenn ein Symbol beim Abbremsen am Fenster vorbeiläuft
  ratchet(reel, speed){
    const t = now(); if (t - this.lastTick[reel] < 28) return; this.lastTick[reel] = t;
    const pan = (reel - 2) * 0.32;
    this.noise(0.035, { vol:0.09 + 0.06 * (1 - speed), freq:3000 - speed * 900, q:6, pan, rev:0.04 });
    this.tone(1900 - speed * 500, 0.02, { type:'square', vol:0.012, pan, rev:0 });
  },
  lever(){
    for (let i = 0; i < 7; i++) this.noise(0.03, { vol:0.15, freq:2800 - i * 220, q:7, at:i * 0.035, pan:0.5 });
    // Feder: leicht vibrierender Ton
    this.tone(320, 0.5, { type:'sine', vol:0.05, to:180, at:0.2, pan:0.55, rev:0.25 });
    this.tone(90, 0.3, { type:'triangle', vol:0.28, to:50, at:0.24, pan:0.4, rev:0.1 });
    this.noise(0.08, { vol:0.25, freq:600, q:1.5, at:0.24, pan:0.4 });
  },
  stop(i){
    const pan = (i - 2) * 0.35;
    this.tone(105 - i * 4, 0.28, { type:'sine', vol:0.38, to:48, pan, rev:0.12 });
    this.tone(210, 0.07, { type:'triangle', vol:0.12, to:140, pan, rev:0.05 });
    this.noise(0.05, { vol:0.28, freq:2600, q:1.8, pan, rev:0.06 });
    this.bell(1650 + i * 40, 0.18, { ratio:1.41, index:1.2, vol:0.035, pan, rev:0.2 });
  },
  // Besondere Symbole landen: aufsteigende Töne
  land(kind, n, reel){
    const pan = (reel - 2) * 0.35;
    if (kind === 'scatter'){ const f = [523, 659, 784, 988, 1175, 1397][Math.min(n, 5)]; this.bell(f, 0.9, { ratio:2, index:3, vol:0.16, pan }); this.bell(f * 2, 0.6, { ratio:3, index:1.5, vol:0.06, pan, at:0.03 }); }
    else if (kind === 'clover'){ const f = [392, 494, 587, 698, 784, 988][Math.min(n, 5)]; this.tone(f, 0.35, { type:'sine', vol:0.14, pan, rev:0.25 }); this.tone(f * 4, 0.12, { type:'sine', vol:0.04, pan, rev:0.25 }); }
    else if (kind === 'diamond'){ [0, 0.05, 0.1].forEach((a, k) => this.bell(2093 * (1 + k * 0.25), 0.5, { ratio:1.5, index:1, vol:0.06, at:a, pan })); }
  },
  tension(){
    this.tone(110, 1.3, { type:'sawtooth', vol:0.07, to:440, lp:400, lpTo:2600, rev:0.3 });
    this.tone(165, 1.3, { type:'sawtooth', vol:0.04, to:660, lp:400, lpTo:2600, rev:0.3 });
    [0, 0.45, 0.9].forEach(a => this.tone(70, 0.18, { type:'sine', vol:0.3, to:40, at:a }));
  },
  lose(){ this.tone(330, 0.12, { type:'triangle', vol:0.06, to:280, rev:0.2 }); this.tone(262, 0.2, { type:'triangle', vol:0.05, to:220, at:0.1, rev:0.2 }); },

  /* ----- Gewinne ----- */
  win(level){
    const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7, 1318.5, 1568, 1760];
    const n = level >= 2 ? 10 : level >= 1 ? 8 : 5;
    for (let i = 0; i < n; i++) this.bell(PENTA[i], 0.6, { ratio:3.5, index:2, vol:0.09, at:i * 0.065, pan:(i % 2 ? 0.35 : -0.35) });
    if (level >= 1){
      // Akkord mit Filterfahrt
      [261.63, 329.63, 392, 523.25].forEach(f => this.tone(f, 1.6, { type:'sawtooth', vol:0.045, lp:500, lpTo:4200, at:0.1, rev:0.35 }));
      for (let i = 0; i < 18; i++) this.bell(2200 + rand() * 2400, 0.25, { ratio:2.7, index:1.2, vol:0.035, at:0.5 + i * 0.06, pan:(rand() - 0.5) * 1.6 });
    }
  },
  fanfare(){
    const chords = [[392, 493.88, 587.33], [523.25, 659.25, 783.99], [587.33, 739.99, 880], [783.99, 987.77, 1174.7]];
    chords.forEach((ch, i) => ch.forEach(f => {
      this.tone(f, i === 3 ? 1.8 : 0.42, { type:'sawtooth', vol:0.05, lp:900, lpTo:5000, at:i * 0.32, rev:0.4 });
      this.tone(f / 2, i === 3 ? 1.8 : 0.42, { type:'square', vol:0.025, lp:700, at:i * 0.32, rev:0.3 });
    }));
    for (let i = 0; i < 30; i++) this.bell(1800 + rand() * 3000, 0.3, { ratio:2.7, index:1.4, vol:0.04, at:1.0 + i * 0.05, pan:(rand() - 0.5) * 1.8 });
  },
  countTick(p){
    const t = now(); if (t - this.lastCount < 55) return; this.lastCount = t;
    this.bell(1400 + p * 900, 0.12, { ratio:3.1, index:1.1, vol:0.045, rev:0.1, pan:(rand() - 0.5) * 0.6 });
  },
  bonus(){ [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => this.bell(f, 0.7, { ratio:2, index:2.5, vol:0.11, at:i * 0.07, pan:(i / 3) - 1 })); },
  flip(){ this.noise(0.1, { vol:0.22, freq:3200, q:0.6, type:'highpass', rev:0.1 }); this.noise(0.05, { vol:0.1, freq:900, q:1, at:0.04 }); },
  peg(){ this.noise(0.02, { vol:0.2, freq:4600, q:6, rev:0.05 }); this.bell(2600, 0.06, { ratio:1.5, index:0.8, vol:0.03, rev:0.05 }); },
  right(){ [784, 988, 1175, 1568].forEach((f, i) => this.bell(f, 0.45, { ratio:3, index:2, vol:0.1, at:i * 0.06 })); },
  wrong(){ this.tone(196, 0.5, { type:'sawtooth', vol:0.07, to:98, lp:900, lpTo:200, rev:0.3 }); this.tone(185, 0.5, { type:'sawtooth', vol:0.05, to:92, lp:900, lpTo:200, rev:0.3 }); },
  levelUp(){ [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => this.bell(f, 0.5, { ratio:2, index:2, vol:0.1, at:i * 0.075, pan:(i % 2 ? 0.4 : -0.4) })); },
  ui(){ this.noise(0.02, { vol:0.06, freq:5000, q:3, rev:0 }); this.tone(1200, 0.03, { type:'triangle', vol:0.025, rev:0 }); }
};
