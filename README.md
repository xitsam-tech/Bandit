# Einarmiger Bandit 3D

Ein Spielautomat im Browser: 5 Walzen × 4 Reihen, bis zu 10 Gewinnlinien, Joker, Freispiele mit Klebe-Jokern,
Glücksrad, Risiko-Leiter, progressiver Jackpot und vier Gehäuse-Optiken. Die 3D-Szene läuft mit Three.js r128.

Das Projekt besteht aus nativen ES-Modulen – **ohne Bundler, ohne Build, ohne Laufzeit-Abhängigkeiten aus npm**.
Three.js und seine Zusatzmodule (Bloom, Reflector …) werden wie bisher als klassische Scripts vom CDN geladen
und stellen das globale `THREE` bereit.

## Starten

ES-Module brauchen `http://` (über `file://` blockiert der Browser sie). Ein kleiner Server liegt bei:

```sh
npm run serve          # = node tools/serve.mjs 8080
# dann http://127.0.0.1:8080/ öffnen
npm run build:single   # Ein-Datei-Fassung nach dist/einarmiger-bandit.html (braucht esbuild)
```

Jeder andere statische Server funktioniert genauso (z. B. `python3 -m http.server`).

`index.html` ist bewusst ein **HTML-Fragment** ohne `<html>/<head>/<body>` (wie die ursprüngliche Datei):
claude.ai-Artifacts betten es in ihr eigenes Gerüst ein. Browser stellen es auch direkt korrekt dar.

## Struktur

```
index.html              Markup (Bühne, Bedienpult, Dialoge) + Script-Tags
css/style.css           gesamtes Styling
js/main.js              Einstieg: Zustand laden, Szene aufbauen, UI binden, Schleife starten, window.__bandit
js/loop.js              Render-Schleife pro Bild (Walzen, Präsentation, Kamera-Rig, Lichter, Overlay)
js/dom.js               $(), Bühne, Overlay-Canvas, prefers-reduced-motion, Vibration
js/core/                reine Spiellogik – ohne DOM und ohne THREE, in Node testbar
  config.js             Symbole, PAY, WHEEL, FS_AWARD, Jackpot, Einsatzstufen
  strips.js             feste Walzenstreifen REEL_STRIPS, matrixFromStops, findStops, checkStrips
  util.js               fmt, clamp, mod, now
  rng.js                Zufall, randomStops/nextStops (+ austauschbare Quellen für Tests)
  state.js              gespeicherter Zustand S (inkl. Stopppositionen), loadState/snapshot/saveState
  lines.js              buildLines, evaluate, heldReels …
  wheel-math.js         wheelIndexAt, wheelTarget
  progression.js        xpNeed
  runtime.js            rt – Laufzeit-Zustand des Spielablaufs (spinning, busy, gamble …), selectionLocked
js/audio/               sound.js (Effekte, Web Audio), music.js (Synth-Sequencer)
js/gfx/                 2D-Canvas-Grafik: symbols.js (Vektor-Symbole), ticker.js (14-Segment-Laufschrift),
                        lcd.js (7-Segment-LCDs), canvas2d.js (gemeinsame Formen)
js/scene/               Three.js-Szene
  context.js            world – gemeinsame Szene-Objekte (renderer, scene, camera, wheel, card, lever …)
  renderer.js           initGL (Renderer, Licht, Bloom) und Raum/Boden
  cabinet.js            oberes Gehäuse; lower-cabinet.js Tasten-Deck, Belly-Glass, Münzschale
  styles.js             Gehäuse-Stile (Neon, Holz, Klavierlack, Glas), Helligkeit
  reels.js              Walzen, Slots, sichtbare Matrix; reel-motion.js Walzen-Animation
  mechanics.js          Innenleben (Glas-Gehäuse) und Münzlauf
  lamps.js, lever.js, bulbs.js, coins.js, wheel.js, card.js, sticky.js, lights.js
  camera.js             Orbit, Ansichten, Zeiger-Parallaxe, Größenanpassung
js/game/                Spielablauf: flow.js (spin/settle, Auto), wheel-flow.js, gamble.js,
                        presentation.js, banner.js, effects.js
js/ui/                  sync.js (Pult ↔ Zustand), bind.js (Ereignisse), controls.js (Linien/Einsatz),
                        input.js (Raycast, Hebel, Orbit), overlay.js (Linien-Overlay), paytable.js, debug.js
tools/serve.mjs         statischer HTTP-Server (auch von den Browser-Tests benutzt)
tools/strip-sim.mjs     Mathematik der Walzenstreifen (exakte Basisspiel-Auswertung, Monte Carlo der Freispiele)
tools/calibrate-strips.mjs  Kalibrier-Skript (Kennzahlen, Vergleich mit dem früheren Modell, Streifensuche)
tests/unit/             node:test, ohne Abhängigkeiten
tests/e2e/              Playwright-Browser-Tests; screens/ enthält die Referenzbilder des Regressionstests
legacy/                 ursprüngliche Ein-Datei-Version (Referenz, unverändert)
```

### Zustand und Abhängigkeiten

- **`S`** (`core/state.js`) ist der gespeicherte Spielstand (localStorage).
- **`rt`** (`core/runtime.js`) hält den flüchtigen Ablauf-Zustand. ES-Modul-Exporte lassen sich von außen nicht
  neu zuweisen, deshalb schreiben alle Module `rt.spinning = …` statt früherer globaler `let`s.
- **`world`** (`scene/context.js`) hält die veränderlichen Szene-Objekte, die die `build*`-Funktionen in
  `initGL()` anlegen. `context.js` importiert nichts und erzeugt so keine Zyklen.
- Abhängigkeitsrichtung: `core` ← `audio`/`gfx` ← `scene` ← `game`/`ui` ← `loop`/`main`. `core` kennt weder DOM
  noch THREE. `game` nutzt aus `ui` nur die Anzeige (`say()`, `syncUI()`); `ui/bind.js` und `ui/input.js` lösen
  Spielaktionen aus. Gegen die Richtung gibt es genau zwei Rückrufe aus der Szene: die Walzen-Animation ruft nach dem
  letzten Stopp `settle()` auf, das Glücksrad nach dem Auslaufen `finishWheel()`.
- Bewusste Import-Zyklen gibt es nur zwischen Funktionen: `game/flow.js` ↔ `scene/reel-motion.js` (`settle`)
  und `game/flow.js` ↔ `game/gamble.js` (`scheduleNext`). Beim Laden der Module wird davon nichts aufgerufen.
- `core/*` ist mit `// @ts-check` und JSDoc typisiert (geprüft mit `tsc --allowJs --checkJs --strict --noEmit`).

## Walzen und Spielmathematik

Jede Walze trägt einen **festen Symbolstreifen** `REEL_STRIPS[c]` mit `STRIP_LEN = 16` Feldern (`js/core/strips.js`),
jede Walze in einer anderen Reihenfolge. Der Zufall wählt pro drehender Walze nur eine **Stoppposition** p (gleichverteilt
0..15); sichtbar sind die vier Felder p, p+1, p+2, p+3 (Reihe 0 oben, zyklisch). Symbole auf den Walzen werden nie
ausgetauscht – die `sid` einer Kachel wird nur beim Aufbau gesetzt und ist danach schreibgeschützt. Das gilt auch in
Freispielen (gehaltene Walzen stehen still, ihr Joker steht wirklich dort), bei Turbo, Quick-Stop und nach dem Neuladen.

- Kachel k zeigt Streifenfeld (1 − k) mod 16; die Walzenstellung s gehört zur Stoppposition (−s) mod 16. Beim Drehen
  wächst s, die Symbole laufen nach unten, von oben kommt das vorige Streifenfeld nach.
- Die Animation (Anlauf, Lauf, Abbremsen mit easeOutBack, Nachfedern) plant im Lauf das Ziel: Die Laufgeschwindigkeit wird
  um bis zu ±25 % angeglichen, damit das Abbremsen zur geplanten Zeit genau so beginnt, dass die Walze auf der
  Ziel-Stoppposition landet. Passt kein Ziel in die Zeit, dreht die Walze etwas länger. Stopps bleiben gestaffelt
  (links vor rechts), auch bei Quick-Stop und Spannung. Die Spannung (2 Bonus auf den linken Walzen → die restlichen
  kriechen) wird beim Bremsbeginn geprüft, weil das Ziel dann feststeht. Mittlere Dauer eines Drehs (60 Bilder/s):
  normal ≈ 3,4 s, mit Spannung ≈ 5,7 s, Turbo ≈ 2,7 s.
- Gespeichert werden `S.stops` (Stopppositionen; während eines Drehs dessen Ziel) und `S.pending.stops`.
  `S.matrix` wird daraus abgeleitet. Ältere Spielstände mit nur `matrix` laden ohne Fehler: Die Walzen starten auf
  zufälligen Positionen, Klebe-Joker bleiben nur dort, wo wirklich ein Joker steht (`pruneSticky`).

Aufbau der Streifen: Bonus auf Walze 1, 3, 5 (je einmal), Klee auf jeder Walze (je einmal), Diamant auf Walze 1, 3, 5,
Joker auf Walze 2, 3, 4; die normalen Symbole 1–3× je Walze, kein Symbol zweimal im selben sichtbaren Fenster.
Kennzahlen (10 Linien, `node tools/calibrate-strips.mjs`, Seed 1; Basisspiel exakt über alle 16⁵ Kombinationen):

| Kennzahl | früher (Einzelsymbole) | feste Streifen |
|---|---|---|
| Quote ohne Jackpot | 88,1 % | 89,2 % (MC 2 Mio.) / 89,4 % (exakt + MC) |
| davon Linien / Freispiele / Glücksrad | 67,5 / 11,1 / 9,4 % | 72,5 / 6,8 / 9,9 % |
| Freispiel-Auslöser | 2,0 % | 1,5625 % (= 1/64, exakt) |
| Glücksrad | 1,55 % | 1,5625 % (= 1/64, exakt) |
| Trefferquote (inkl. Features) | 25,3 % | 25,0 % |
| Standardabweichung je Dreh | 2,79× Einsatz | 2,79× Einsatz |
| Jackpot (5× Diamant) | 1 von ≈ 74 000 | 1 von ≈ 52 000 |

Dazu kommen 5 % jedes Einsatzes in den Jackpot-Topf. Mit nur 16 Feldern ist ein Bonus-Symbol auf einer Walze in
4 von 16 Stopps sichtbar; mehr als drei Bonus-Walzen würden die Freispiele auf über 5 % treiben. Darum sind höchstens
drei Bonus-Symbole sichtbar und es gibt je Auslösung 3 Freispiele (`FS_AWARD` für 4/5 Bonus bleibt als Regel bestehen).

## Tests

```sh
npm test               # Unit-Tests (node --test tests/unit/*.test.mjs), keine Abhängigkeiten nötig
npm install            # einmalig für die Browser-Tests: playwright + three@0.128.0 (nur devDependencies)
npm run test:e2e       # Browser-Tests gegen index.html
node --test tests/e2e/strips.test.mjs   # einzelner Browser-Test
UPDATE_SNAPSHOTS=1 node --test tests/e2e/screens.test.mjs   # Referenzbilder bewusst neu schreiben
node tools/calibrate-strips.mjs          # Kennzahlen der Walzenstreifen (--legacy: früheres Modell, --search: Suche)
```

`E2E_TARGET=legacy|beide` prüft zusätzlich die Ein-Datei-Referenz `legacy/` – **nur noch für Tests, die nicht von den
Walzeninhalten abhängen** (derzeit die Gehäuse-Tests ohne den erzwungenen Mega Win). Walzenbezogene Tests
(`targets({ reels: true })`: Self-Test, Freispiele, Neuladen, Auto-Stopp, Streifen) laufen nur gegen die neue Fassung,
weil die Referenz jedes Feld einzeln zieht.

- **Unit** (`tests/unit`): Linienaufbau (Paare, Reihen, Duplikate), Auswertung (Joker, Scatter, Jackpot,
  3 Joker vs. 4 gleiche, nur 2 in Folge), `FS_AWARD`, `heldReels`, `wheelIndexAt ∘ wheelTarget`, `xpNeed`,
  Laden/Speichern (Stopppositionen, alte Spielstände, `pruneSticky`), Walzenstreifen (Länge, verschieden, keine Klumpen,
  `matrixFromStops`, `findStops`, Testszenarien erreichbar), gleichverteilte Stopps, exakte Basisspiel-Kennzahlen und
  seed-feste Monte-Carlo-Quote inkl. Freispielen und Glücksrad (Ziel 88–90 %).
- **E2E** (`tests/e2e`): Self-Test 20/20 und Dreh, Walzenstreifen-Invariante (`strips.test.mjs`: Kacheln = `REEL_STRIPS`
  bei normal, Turbo, Quick-Stop, Freispielen und Neuladen; Matrix = Stopppositionen), Freispiele mit gehaltenen Walzen und
  Retrigger, Neuladen mitten im Dreh / im Risiko / im Glücksrad, Auto + Turbo, Auto-Stopp bei Mega Win, Gehäusewahl,
  Glas-Innenleben, Münzschale, Ansichten, sowie ein optischer Regressionstest (`screens.test.mjs`, Referenzbilder in
  `tests/e2e/screens/`, neu schreiben nur mit `UPDATE_SNAPSHOTS=1`).
  Alle Tests prüfen, dass keine Konsolenfehler oder -warnungen auftreten (blockierte Fonts ausgenommen).
- CDN-Anfragen an `cdn.jsdelivr.net/npm/three@0.128.0/…` werden in den Tests auf eine lokale Kopie umgeleitet,
  Google Fonts werden abgebrochen. Pfade lassen sich per Umgebungsvariable setzen:
  `THREE_DIR` (Ordner des Pakets three@0.128.0), `PLAYWRIGHT_DIR`, `CHROMIUM_PATH`.

### Debug-/Testzugang

`window.__bandit` bietet die bisherigen Funktionen (`S`, `spin`, `evaluate`, `buildLines`, `readVisibleMatrix`,
`runSelfTests`, `runWheel`, `offerGamble`, `gamblePick`, `gamble`, `busy`) und zusätzlich `rt`, `world`,
Getter wie `spinning`, `autoOn`, `renderer`, `camera`, `coins`, `lever`, `lacquerMat`, die Sammlungen `reels`,
`holdFrames`, `deck`, `mech`, `orbit`, sowie für die Walzen `REEL_STRIPS`, `STRIP_LEN`, `readStops()`,
`matrixFromStops(stops)`, `findStops(pred, { fixed })`, `randomStops()` und `setStopSource(fn)` / `setRandomSource(fn)`
(mit `null` zurücksetzen). Tests erzwingen Ergebnisse, indem sie passende Stopppositionen auf den Streifen suchen –
z. B. `setStopSource(() => findStops(m => …))`. Der Debug-Dialog im Spiel zeigt die sichtbare Matrix,
Statistiken und den Self-Test.
