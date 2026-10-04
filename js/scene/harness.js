/**
 * Kabelbaum: alle Leitungen mit ihren Wegpunkten. Die Hauptplatine liegt hinten im Unterteil: Walzen-Kabel laufen
 * unter den Walzen nach hinten, Anzeigen und Tasten über den Boden an der linken Wand, Laufschrift über die Walzen und
 * die hintere linke Ecke, Hebel/Münzprüfer/Hopper an der rechten Wand. Die Lampen hängen am Lampentreiber (linke Wand).
 * Bündel bekommen Kabelbinder, Stränge P-Clips an Wand bzw. Traverse. Wegpunkte hängen an Ports und Rahmenmaßen.
 */
import { AXIS_Z, BACK_Z, BACK_Z_LOW, TOP_Y, reelX } from './constants.js';
import { addClip, addTie, cable, wiring } from './cables.js';
import { deck } from './lower-cabinet.js';
import { V } from './geo.js';

const C = { red:'#c42020', black:'#1d1d21', blue:'#2050c0', yellow:'#e0c020', green:'#2f9a40', white:'#ecebe6', orange:'#e07818', brown:'#6e4320', grey:'#8d9097', violet:'#7a3cb0' };
const port = id => wiring.ports.get(id).pos;

export function buildHarness(){
  const zc = AXIS_Z, over = -3.4;   // Ebene knapp über der Hauptplatine (Bauteile reichen bis ≈ −3,5)
  /* ----- Walzen: Motor, Lichtschranke, LED kurz im Spalt zur Walzenplatine; Walzenplatine → Hauptplatine ----- */
  for (let c = 0; c < 5; c++){
    const X = reelX(c), t = port('mb.reel' + c);
    cable('motor' + c, 'reel' + c + '.motor', 'rp' + c + '.motor', [V(X + 0.54, -0.6, zc - 0.11), V(X + 0.54, -2.85, zc - 0.11)], { wires:[C.red, C.blue, C.yellow, C.black], r:0.006, lead:0.05, tieStep:0.5 });
    cable('opto' + c, 'reel' + c + '.opto', 'rp' + c + '.opto', [], { wires:[C.orange, C.black, C.white], r:0.006, lead:0.03, ties:false });
    cable('led' + c, 'reel' + c + '.led', 'rp' + c + '.led', [], { wires:[C.red, C.black], r:0.006, lead:0.05, tieStep:0.5 });
    // unter dem Band nach hinten, dann hinab zur Steckerleiste an der Vorderkante der Hauptplatine
    cable('walze' + c, 'rp' + c + '.top', 'mb.reel' + c, [V(X, -3.03, zc - 0.5), V(X, -3.08, t.z + 0.25), V(t.x, -3.3, t.z)], { wires:[C.red, C.black, C.blue, C.yellow, C.green, C.white], r:0.0075, bend:0.1, lead:0.03 });
  }

  /* ----- Netzteil → Hauptplatine (hinter der Platine hoch), Netzeingang → Netzteil ----- */
  const BW = BACK_Z_LOW, pw = port('mb.power'), sp = port('mb.speaker');
  cable('versorgung', 'psu.out', 'mb.power', [V(-2.2, -4.885, -1.5), V(-1.62, -4.885, -1.5), V(-1.62, -4.885, BW + 0.12), V(-1.62, over, BW + 0.12), V(pw.x, over, BW + 0.12), V(pw.x, over, pw.z)],
    { wires:[C.red, C.black, C.orange, C.black], r:0.014, bend:0.15 });
  cable('netz', 'mains.in', 'psu.mains', [V(-3.4, -4.7, BW + 0.3), V(-3.58, -4.98, BW + 0.45), V(-3.58, -4.98, -1.55), V(-3.0, -4.885, -1.55)],
    { wires:[C.brown, C.blue, C.green], r:0.014, bend:0.15 });
  cable('lautsprecher', 'speaker', 'mb.speaker', [V(-2.4, -4.0, -0.4), V(-2.4, -4.1, BW + 0.1), V(-2.4, over, BW + 0.1), V(sp.x, over, BW + 0.1), V(sp.x, over, sp.z)],
    { wires:[C.red, C.black], r:0.008, bend:0.14 });

  /* ----- Flachbandkabel: Anzeigen und Tasten über die linke Wand nach hinten, Lampentreiber, Laufschrift ----- */
  const rw = id => { const p = wiring.ports.get(id).plug; return Math.max(p.w, p.d) - 0.05; };
  const lc = port('mb.lcd'), bt = port('mb.buttons'), lp = port('mb.lamps'), tk = port('mb.ticker');
  cable('lcd', 'lcd.in', 'mb.lcd', [V(1.5, -2.62, -0.25), V(-3.9, -2.62, -0.25), V(-3.9, -2.62, -0.45), V(-3.9, -3.3, -0.6), V(-3.9, -3.3, lc.z), V(lc.x - 0.3, over + 0.02, lc.z), V(lc.x, over + 0.02, lc.z)],
    { ribbon:rw('lcd.in'), normal:V(1, 0, 0), normal0:V(0, 1, 0), bend:0.1, lead:0.06 });
  const bbP = port('bb.bus');
  cable('tasten', 'bb.bus', 'mb.buttons', [V(bbP.x, -3.42, 0.32), V(-3.92, -3.42, 0.2), V(-3.93, -3.42, -0.1), V(-3.93, -3.42, bt.z), V(bt.x - 0.3, over, bt.z), V(bt.x, over, bt.z)],
    { ribbon:rw('bb.bus'), normal:V(1, 0, 0), normal0:V(0, 1, 0), bend:0.1, lead:0.05 });
  const lb = port('ld.bus');
  cable('lampenbus', 'ld.bus', 'mb.lamps', [V(-3.4, lb.y, lb.z), V(-3.4, -3.2, lb.z), V(-3.4, -3.2, lp.z), V(lp.x, over, lp.z)],
    { ribbon:rw('ld.bus'), normal:V(0, 0, 1), normal0:V(0, 1, 0), bend:0.1, lead:0.06 });
  // Laufschrift: über die Walzen nach hinten, in der hinteren linken Ecke hinab, über der Platine zur Steckerleiste
  const top = TOP_Y - 0.06, cz = BACK_Z + 0.5;
  cable('laufschrift', 'ticker.in', 'mb.ticker', [V(0.34, 2.62, -0.15), V(0.34, top, -0.45), V(0.34, top, cz), V(-3.7, top, cz), V(-3.7, over + 0.08, cz), V(tk.x, over + 0.08, cz), V(tk.x, over + 0.08, tk.z)],
    { ribbon:rw('ticker.in'), normal:V(0, 1, 0), normal0:V(0, 1, 0), bend:0.12, lead:0.06 });

  /* ----- Rechte Seite: Hopper, Hebelschalter und Münzprüfer (Stränge an der rechten Wand), Rückgabetaste ----- */
  const hp = port('mb.hopper'), lv = port('mb.lever'), cn = port('mb.coin');
  cable('hopper', 'hopper', 'mb.hopper', [V(2.6, -4.75, -3.45), V(3.6, -4.75, -3.6), V(3.6, -4.75, hp.z), V(3.6, over, hp.z), V(hp.x, over, hp.z)],
    { wires:[C.red, C.black, C.violet, C.white], r:0.01, bend:0.14 });
  cable('hebel', 'lever.switch', 'mb.lever', [V(3.66, 0.85, zc + 0.51), V(3.8, 0.85, zc + 0.25), V(3.8, 0.85, lv.z), V(3.8, over, lv.z), V(lv.x, over, lv.z)],
    { wires:[C.white, C.black, C.grey], r:0.008, bend:0.12 });
  cable('muenzpruefer', 'coin.main', 'mb.coin', [V(3.45, 2.0, -0.92), V(3.75, 2.0, -1.1), V(3.75, 2.0, cn.z), V(3.75, over, cn.z), V(cn.x, over, cn.z)],
    { wires:[C.red, C.black, C.blue, C.yellow, C.green, C.white], r:0.0075, bend:0.12, lead:0.06 });
  cable('rueckgabe', 'reject', 'coin.aux', [V(3.55, 1.84, 0.06), V(3.32, 1.78, -0.1)], { wires:[C.orange, C.black], r:0.007, lead:0.05, bend:0.06 });

  /* ----- Lampen: Reihen links direkt nach hinten zum Lampentreiber, Paare rechts über die vordere Traverse ----- */
  const ldX = id => port(id).x + 0.1;
  for (let r = 0; r < 4; r++){
    const s = port('lamp.row' + r), t = port('ld.row' + r), lane = -3.5 - r * 0.03;
    cable('reihe' + r, 'lamp.row' + r, 'ld.row' + r, [V(lane, s.y, -0.4), V(lane, t.y, -0.4), V(lane, t.y, -1.45), V(ldX('ld.row' + r), t.y, -1.62)], { wires:[C.yellow, C.black], r:0.008, bend:0.08, lead:0.08 });
  }
  for (let i = 0; i < 3; i++){
    const s = port('lamp.pair' + i), t = port('ld.pair' + i), o = i * 0.03;
    cable('paar' + i, 'lamp.pair' + i, 'ld.pair' + i, [V(3.78 + o, s.y, -0.12), V(3.78 + o, 2.42 + o, -0.12), V(3.6, 2.42 + o, -0.12), V(-3.6, 2.42 + o, -0.12), V(-3.66 - o, 2.42 + o, -0.12), V(-3.66 - o, t.y, -0.12), V(-3.66 - o, t.y, -1.45), V(ldX('ld.pair' + i), t.y, -1.62)],
      { wires:[C.yellow, C.black], r:0.008, bend:0.1, lead:0.08, tieStep:0.7 });
  }
  { const s = port('bulbs.feed'), t = port('ld.bulbs');
    cable('kranz', 'bulbs.feed', 'ld.bulbs', [V(s.x, s.y, -0.1), V(-3.42, s.y, -0.5), V(-3.42, t.y, -0.5), V(-3.42, t.y, -1.45), V(ldX('ld.bulbs'), t.y, -1.62)], { wires:[C.red, C.black, C.grey], r:0.009, bend:0.1, lead:0.06 }); }
  { const t = port('ld.marquee');
    cable('aufsatz', 'mq.feed', 'ld.marquee', [V(-3.12, 3.47, -1.4), V(-3.12, 3.15, -1.4), V(-3.7, 2.95, -1.4), V(-3.7, t.y + 0.25, -1.4), V(-3.7, t.y, -1.75), V(ldX('ld.marquee'), t.y, -2.05)], { wires:[C.brown, C.blue, C.green], r:0.009, bend:0.12 });
    cable('roehre', 'mq.out', 'mq.tube', [V(-2.16, 3.47, -1.1), V(-2.16, 3.7, -0.8), V(-2.56, 3.8, -0.6)], { wires:[C.brown, C.blue], r:0.008, bend:0.1, lead:0.06 }); }

  /* ----- Tasten: je Schaltblock ein kurzes Kabel zur Steckerplatine darunter ----- */
  deck.buttons.forEach(b => cable('taste-' + b.id, 'btn.' + b.id, 'bb.' + b.id, [], { wires:[C.white, C.black], r:0.006, lead:0.03, ties:false }));

  /* ----- Clips und Kabelbinder an den Strängen ----- */
  [-2.0, -0.5].forEach(y => { addClip(V(3.8, y, lv.z), V(0, 1, 0), V(1, 0, 0), 0.03); addClip(V(3.75, y + 0.6, cn.z), V(0, 1, 0), V(1, 0, 0), 0.032); });
  [-3.6, -1.2, 1.2].forEach(x => addClip(V(x, 2.44, -0.12), V(1, 0, 0), V(0, -1, 0), 0.04));
  [-4.6, -4.1].forEach(y => addTie(V(-1.62, y, BW + 0.12), V(0, 1, 0), 0.06));
  [-4.3, -3.9].forEach(y => addTie(V(3.6, y, hp.z), V(0, 1, 0), 0.055));
  [-1.5, 0.0].forEach(y => addTie(V(3.8, y, lv.z), V(0, 1, 0), 0.04));
  [-1.0, 0.0, 1.0].forEach(x => addTie(V(x, 2.452, -0.12), V(1, 0, 0), 0.05));
}
