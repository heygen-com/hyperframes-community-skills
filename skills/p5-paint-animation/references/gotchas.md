# Gotchas — failure modes already paid for

Engine / p5 runtime:
- p5 2.x has NO `preload()`. Load images with `await loadImage(...)` inside an
  async `setup()`.
- p5 global mode doesn't auto-boot when scripts are injected after page load —
  the harnesses call `new p5()` explicitly. Setup errors surface as unhandled
  REJECTIONS (p5 lifecycle is async); the harnesses listen for both.
- `sq` is a p5 global — don't define your own. Same for other p5 names.
- `brush.scaleBrushes()` multiplies cumulatively. Call exactly once per page.
- Pixel sampling: `img.pixels` indices must be integers — `floor()` coordinates
  or colors come back NaN (renders as "Invalid color string").
- Vendored p5.brush ships brushes: pen rotring 2B HB 2H cpencil pastel crayon
  charcoal spray marker. No `marker2`/`hatch_brush` (older docs lie).

Strokes / animation:
- Splitting one stroke into multiple `brush.spline()` calls BEADS (each call
  restarts the stamp train). Tip-to-tail growth = progressive redraw from the
  stroke's start; the ink build-up reads as hand pressure.
- Short strokes bead too — strokes under ~60px with fat brushes read as dabs.
- The brush compositor reaches steady state one frame in: paint the first
  frame twice and discard the first (render-video does this automatically).
- Determinism: the whole pipeline is seeded and byte-stable. If frames "shimmer"
  on identical input, suspect your TEST (x264-looped stills decode with drift) —
  verify with canvas hashes, not encoded frames.

Cameras:
- Never track the pen tip's y — lock camera height to the text baseline or the
  camera bounces on every ascender/descender/t-cross.
- Do camera moves in post (zoompan or per-frame crop along a smoothed track):
  reframing becomes a 30-second iteration instead of a re-render.
- Follow with exponential lag (gain 0.1–0.15) — dead-locked tracking reads
  robotic; lag reads like an operator.

Video repaint:
- Fixed lattice assumes a roughly held camera. Parallax-heavy handheld footage
  (two people at selfie distance) breaks the WORLD tracker — prefer the calm
  window + fixed lattice.
- Face size in frame is destiny. Crop to the subject before painting.
- Grade dark sources with gamma ONLY. Saturation boosts turn iPhone shadow
  chroma noise into saturated paint blotches (the "teal face" bug). Add color
  richness with the stroke-level SAT dial instead.
- Backlit/deep-shadow faces paint as shadow. The painter can't invent light
  that isn't in the pixels — say so rather than dial-fishing.
- 12 fps is the sweet spot for painted motion; duplicate frames to sit on a
  24/30 fps timeline (the 12 fps cadence reads as hand-made, not cheap).

Assembly:
- x264 needs even dimensions — pad odd heights (`pad=W:H+1`) or pick even sizes.
- Composite text/effects behind people with per-frame person mattes
  (`npx hyperframes remove-background in.png -o out.png`). Batch via a
  shell loop over PNGs; the .mov video path can silently drop alpha — verify
  `alpha=0` fraction on one frame before trusting a batch.
- Surgical re-edits: trim + processed segment + concat (n-way) re-encode, map
  the original audio with `-c:a copy`. Never re-render what didn't change.
