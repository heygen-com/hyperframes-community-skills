# Look: the ink kit

Two tones, drawn in brush strokes, boiling at 8 fps. One character: the blot, which is Claude's starburst as an ink
splat. People are silhouettes. Every cut goes through ink.

## The grammar

| Rule | Value |
|---|---|
| Palette | ink `#121110`, paper `#EEE9E0`, nothing else (the ink floor enforces it) |
| Drawing rate | a new drawing every 1/8 s. The whole picture steps, motion included (`q8()`), and the linework re-rolls each drawing |
| Sketchiness | `SKETCH = 1.8` (0 is clean). It scales wobble, pen lifts, overshoot, ragged edges, misregistration and gaps |
| Marks | every outline drawn twice, side by side (`twice: 2`); rectangles as four overshooting strokes (`sketchPoly`) |
| Fills | only important faces get a solid wash (`roughWash`). Suggest the rest with strokes and gaps (`hatchFill`) |
| Captions | one lowercase label in a paper card top left, typed on (`caption(txt, typed(u, t0))`), Gochi Hand drawn heavy |
| Frame | a cream margin and a doubled ink panel line on every shot (`frame()`) |
| Seams | ink band wiping LEFT (the default); blot/ink swallow → ragged iris (Z forward, 2 per film); caused blackout (lamp) |
| Motion | every chapter names a sustained-motion route: camera with intent, staged reveals, sequenced UI life, or an animated sequence. The boil is texture, not motion; something narrative is always mid-flight |

## Files

- `kit/brush-ink.js`: canvas, brushes (`ink`, `sumi`, `flat`, `dry`), `pen`, `wash`, `roughWash`, `sketchPoly`,
  `hatchFill`, `strays`, `blot`, `figure`, `backOfHead`, `caption`, `frame`, camera (`camBegin`/`camEnd`), the frame loop.
- `kit/props.js`: set pieces (`room`, `air`, `monitor`, `bubble`, `fileChip`, `pinned`, `paperBall`, `lampCone`,
  `shelf`, `windowPanes`, `sun`, `desk`, `inkPot`, `doorway`, `seats`, `muted`, `magnifier`, `filmFrame`), hand
  lettering (`handwrite`, single-stroke a-z), and `terminal`.
- `kit/film.js`: `chapters()`, easing, `cam()` (adds the seam pan), the three seams, `drawWorld`.
- `kit/hf-bridge.js`: runs the async painter inside HyperFrames through `hf-seek` + `waitUntil`, and skips a repaint
  when a seek lands on the drawing already on the canvas.
- `scenes.js`: one function per chapter type: `intro`, `shelf`, `first-message`, `watching` (reel or web page),
  `frames`, `building`, `terminal` (command, output, red to green), `diff` (strike and write lines, stamp),
  `restart`, `knock`, `notes`, `ship` (seal, stamp, send, status), `side-by-side`, `good-part`, `kept`, `tag`.
- `archetypes.json`: bars, default seam, event times and the design-pass `check` time per type.

## Rules that bite

- **Light pass.** p5.brush mixes stroke colour like pigment, so a paper stroke over ink would come out grey. `pen()`
  with `PAPER` queues the stroke for a second pass, which paints it as exact paper on top of the ink pass. So paper
  strokes always sit above ink shapes: never draw a paper stroke that an ink shape should cover.
- **Ink floor.** Overlapping ink strokes paint darker than a washed room. Every pixel is floored at ink after the ink
  pass, which keeps the frame strictly two-tone. Put silhouettes on ink as exact washes (`roughWash`); use
  `brush.mass` only on paper.
- **Visibility.** An ink shape only reads against paper. Put the blot in a lamp cone, on a screen, or against a
  doorway. In the dark, draw it in paper (`col: PAPER`).
- **p5 globals.** Never declare a global function whose name p5 or the window already uses (`line`, `dot`, `box`,
  `screen`...). p5 throws "Cannot redefine property" and the page never starts.
- **Seeds.** Call `boilSeed(key)` before each element. Stable keys keep still things identical within a drawing,
  whatever moving things upstream consumed. `layRng(key)` holds layout that must not boil.
- **Letters.** `letter()` and `caption()` draw on the 2D compositor, through the camera, above all brush work. Seam ink
  masks them (`INKMASK`). A paper face that must hide letters under it calls `occlude(pts, z)`; give its own label
  `{ z: z + 1 }`.
- **Short strokes.** A two-point `pen()` is resampled internally; `brush.spline` needs three or more points.

## Adding a chapter type

1. Add `archetypes.json` → `types.<name>` with `bars`, `out`, `events` (seconds, on the 0.625 s grid) and `check`.
   Set `"selfSwallow": true` only if the scene draws its own swallow; otherwise `film.js` spreads ink for you.
2. Add `ARCHETYPES['<name>'] = (C, E) => (u, dur, ci) => { ... }` to `scenes.js`. Paint the whole frame, start with
   `room()`, call `cam(ci, u, ...)`, `camEnd()`, then `caption(C.caption, typed(u, .15))`. Keep it a pure function of `u`.
3. Add a recipe to `scripts/score.py` (`RECIPES['<name>']`). See `references/score.md`.
4. Add its required fields to `REQUIRED` in `scripts/new-film.mjs`, then shoot stills and check them before rendering.
