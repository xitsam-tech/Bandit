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
  config.js             Symbole, WEIGHTS, PAY, WHEEL, FS_AWARD, Jackpot, Einsatzstufen
  util.js               fmt, clamp, mod, now
  rng.js                Zufall, sampleSymbol, randomMatrix (+ austauschbare Quellen für Tests)
  state.js              gespeicherter Zustand S, loadState/snapshot/saveState
  lines.js              buildLines, evaluate, heldReels, applySticky …
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
tests/unit/             node:test, ohne Abhängigkeiten
tests/e2e/              Playwright-Browser-Tests; screens/ enthält die Vergleichsbilder legacy ↔ neu
legacy/                 ursprüngliche Ein-Datei-Version (Referenz für Gleichwertigkeitstests)
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

## Tests

```sh
npm test               # Unit-Tests (node --test tests/unit/*.test.mjs), keine Abhängigkeiten nötig
npm install            # einmalig für die Browser-Tests: playwright + three@0.128.0 (nur devDependencies)
npm run test:e2e       # Browser-Tests gegen index.html
E2E_TARGET=beide npm run test:e2e   # dieselben Erwartungen zusätzlich gegen legacy/ (Gleichwertigkeit)
```

- **Unit** (`tests/unit`): Linienaufbau (Paare, Reihen, Duplikate), Auswertung (Joker, Scatter, Jackpot,
  3 Joker vs. 4 gleiche, nur 2 in Folge), `FS_AWARD`, `heldReels`/`applySticky`, `wheelIndexAt ∘ wheelTarget`,
  `xpNeed`, Laden/Speichern, seed-feste Monte-Carlo-Prüfung der Linienquote (≈ 67 % aus Linien; zusammen mit
  Freispielen und Glücksrad ≈ 92 %).
- **E2E** (`tests/e2e`): Self-Test 18/18 und Dreh, Freispiele mit gehaltenen Walzen und Retrigger, Neuladen mitten
  im Dreh / im Risiko / im Glücksrad, Auto + Turbo, Auto-Stopp bei Mega Win, Gehäusewahl, Glas-Innenleben,
  Münzschale, Ansichten, sowie ein optischer Vergleich (`screens.test.mjs`, Bildpaare in `tests/e2e/screens/`).
  Alle Tests prüfen, dass keine Konsolenfehler oder -warnungen auftreten (blockierte Fonts ausgenommen).
- CDN-Anfragen an `cdn.jsdelivr.net/npm/three@0.128.0/…` werden in den Tests auf eine lokale Kopie umgeleitet,
  Google Fonts werden abgebrochen. Pfade lassen sich per Umgebungsvariable setzen:
  `THREE_DIR` (Ordner des Pakets three@0.128.0), `PLAYWRIGHT_DIR`, `CHROMIUM_PATH`.

### Debug-/Testzugang

`window.__bandit` bietet die bisherigen Funktionen (`S`, `spin`, `evaluate`, `buildLines`, `readVisibleMatrix`,
`runSelfTests`, `runWheel`, `offerGamble`, `gamblePick`, `gamble`, `busy`) und zusätzlich `rt`, `world`,
Getter wie `spinning`, `autoOn`, `renderer`, `camera`, `coins`, `lever`, `lacquerMat`, die Sammlungen `reels`,
`holdFrames`, `deck`, `mech`, `orbit`, sowie `setMatrixSource(fn)` / `setRandomSource(fn)` (mit `null` zurücksetzen)
und `randomMatrix` (die ursprüngliche Zufallsmatrix). Der Debug-Dialog im Spiel zeigt die sichtbare Matrix,
Statistiken und den Self-Test.
