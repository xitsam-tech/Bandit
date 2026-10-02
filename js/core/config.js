// @ts-check
/** Spielregeln und feste Zahlen (Symbole, Gewichte, Auszahlungen, Glücksrad, Jackpot, Einsatzstufen). Keine DOM-/THREE-Abhängigkeit. */

/* =========================================================
   Konfiguration
   ========================================================= */
export const ROWS = 4, COLS = 5;
export const SYMBOLS = [
  { name:'Kirsche',  glyph:'🍒' },
  { name:'Zitrone',  glyph:'🍋' },
  { name:'Orange',   glyph:'🍊' },
  { name:'Pfirsich', glyph:'🍑' },
  { name:'Melone',   glyph:'🍉' },
  { name:'Glocke',   glyph:'🔔' },
  { name:'Stern',    glyph:'⭐' },
  { name:'Sieben',   glyph:'7' },
  { name:'BAR',      kind:'bar', glyph:'BAR' },   // kind: Debug-Raster zeigt Text statt Glyphe
  { name:'Joker',    glyph:'🃏', tag:'WILD' },
  { name:'Bonus',    glyph:'💥', tag:'BONUS' },
  { name:'Diamant',  glyph:'💎', tag:'JACKPOT' },
  { name:'Klee',     glyph:'🍀' }
];
export const JOKER = 9, SCATTER = 10, DIAMOND = 11;
// Gewichte pro Walzenfeld (Monte-Carlo-kalibriert: ≈ 92 % aus Linien, Klebe-Joker-Freispielen und Glücksrad, plus 5 % Jackpot-Topf)
export const WEIGHTS = [16,16,13,13,10,8,6,3,3,4,3,2,5];
// Gewinn für 3 / 4 / 5 in Folge, als Vielfaches des Einsatzes pro Linie
export const PAY = [
  [12,30,75],[12,30,75],[15,36,90],[15,36,90],[18,48,120],[24,60,180],[30,80,240],
  [60,180,720],[70,210,900],[100,300,1200],[0,0,0],[120,360,0],[36,100,300]
];
export const FS_AWARD = n => n >= 5 ? 8 : n === 4 ? 5 : n === 3 ? 3 : 0;
export const FS_MULT = 1;
export const CLOVER = 12, WHEEL_MIN = 4;
export const WHEEL = [3,5,3,8,3,5,3,15,3,5,3,8,3,5,25,4]; // × Gesamteinsatz
export const GAMBLE_MAX_STEPS = 5, GAMBLE_CAP = 2000;
export const JP_SEED = 250, JP_MAX = 5000, JP_FEED = 0.05;
export const BET_STEPS = [0.1, 0.2, 0.5, 1, 2, 5];
export const START_CREDITS = 100;
export const STORE_KEY = 'einarmigerBandit3d.v1';
