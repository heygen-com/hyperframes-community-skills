# Vox Collage Layout

White stage. Everything is a printed object: photos are cards, history is
clippings, data is specimens. One yellow circle is the brand carrier — it
backs the hook, names the reveal, and returns in the ident.

## Tokens (measured from the source)

- Ink #1A1A1A · yellow #FFE619 · process blue #66CFFF · specimen blue
  #58BCEC · greys #F2F2F2 / #E9E9EB · white ground.
- Use process blue as a fill or large accent. Use #3E87A8 or darker for small
  text on white, and pass HyperFrames contrast checks.
- Headline: Archivo Black (stand-in for the source grotesque). Period type:
  Georgia/serif. UI mocks: system sans.
- Photo cards: rounded ~18px, soft shadow, ±1.5-3° rotation, white margins.

## Frame recipes

- **Evidence stack**: uniform card sizes (same ratio — crop to match), piled
  nearly on top of each other with jitter, NOT walking down the screen; one
  card per VO phrase; credit slot labels in the left margin. Photos must be
  in-situ (subject in a real location), except when the beat's point is the
  object itself.
- **Zoom-isolation pair**: one wide in-situ plate where the subject sits
  small; zoom into it; background drops to white leaving the subject cutout +
  labeled arrow. The isolated state starts EVIDENCE, ends DIAGRAM.
- **Two-panel compare**: two near-full-frame panels 865×977 at #F2F2F2,
  radius ~28, 28px gap, 81px outer margins, y=51. Asset left, word/pair
  right. Floating small cards on white read off-brand.
- **Specimen grid**: full-bleed specimen blue; subjects as white/bright
  cells in a spaced grid; the surviving/highlighted cell stays bright while
  others dim to ~0.45.
- **Lower-third**: black bar (~0.94 opacity) across the plate's bottom;
  Archivo name in white; role line as a yellow highlight chip (which SWEEPS —
  see [vox-text-overlays.md](vox-text-overlays.md)).
- **Newsprint layering**: a pale clipping strip UNDER the words plus a
  low-opacity copy ON TOP so texture rides the glyphs. Never tween an
  overlay's alpha to 1 — animate to its inline design opacity.
- **Circle reveal**: the yellow circle expands from behind its subject with
  the measured curve 0.30→0.72→0.943→1.0 in ~0.45s of steps.

## Assets — real only

- Sign art, patents, government documents: PD (FHWA, USPTO, FHWA MUTCD).
- Photos/scans: Wikimedia Commons API (generator=search, gsrnamespace=6,
  iiprop=url) → download originals with a proper User-Agent; LOC blocks
  direct jpg — use IIIF or Commons mirrors.
  LOC clips, the working recipe: search → confirm the OCR page actually
  matches the image resource (off-by-one page indexes are common) → scale
  ALTO word coordinates into the IIIF info.json pixel space before cropping
  (the two coordinate spaces differ by ~4x).
- Missing PHOTOS vs missing documents: never recreate a photograph — an
  invented photo reads as slop where a recreated document reads as
  typesetting (flag-on-frame covers documents only). When no PD/CC photo
  exists, the beat goes typographic, or uses a real successor artifact
  labeled as such ("successor of the 1997 fleet").
- Fonts: google/fonts GitHub raw (OFL), embedded via @font-face with the
  LITERAL family name on the element.
- Missing artifact: recreate in period style and FLAG ON FRAME
  ("TYPESETTING RECREATED FROM THE 1839 TEXT"); honest mock-UI is allowed
  only for software/dialog beats.
- Credit sources in the design-pass footer; keep the license note per asset.

## Composition integrity (hard rules — check per frame on the contact sheet)

Numeric seam/dead-time gates cannot see bad layout; these rules are the check.
Audit every frame of the contact sheet against them item by item, and log the
audit. In unattended runs this replaces nobody — it is the minimum bar BELOW
the human design-pass gate, not a substitute for it.

- **No orphan elements.** Every element anchors to the frame grid or to
  another element. A frame is at least two composed elements in relation; a
  lone card drifting on empty ground, or the brand circle floating in an
  unrelated corner, is a failed frame.
- **Coverage.** The composed content (cards, panels, promoted text) occupies
  a clear majority of the frame's visual weight. Large empty ground is a
  deliberate stillness choice made at most once per film, never a default.
- **Labels live on their subjects.** A credit, name chip, or annotation sits
  within one grid-gap of the thing it describes, and never crosses a card
  edge or sits on a border.
- **Grid cells are never empty.** A specimen/comparison grid renders with
  uniform cells and uniform gaps that fully tile their panel, every cell
  filled. An empty cell means the recipe failed — cut the grid to the cells
  you can fill.
- **Annotations are measured.** A circle or arrow drawn onto a photo targets
  the feature's actual pixel position — crop the rendered frame and verify
  the mark sits on the feature (a highlight ellipse missing its key reads as
  broken, not loose).
- **Nothing escapes its container.** Any run of cells, chips, or text inside
  a panel is measured at build time: the children's total extent plus padding
  must fit inside the parent's bounds. If the content count exceeds the fit,
  scale the cells down — a child bleeding past its parent's edge is a failed
  frame. The vertical variant: a glyph's line-box overflowing a tight box —
  center with line-height, and never trust a width measured before the
  webfont loaded.
- **The circle composes over the film, never over void.** The thesis/brand
  circle is the TOP LAYER of the collage: receipts from earlier beats recede
  beneath or around it (dimmed, smaller, pushed to the edges) so the frame
  keeps its evidence. Circle text is one optically centered block — centered
  in the circle on both axes, lines broken at phrase boundaries, no per-line
  indents, the block within ~70% of the diameter. A highlight treatment on
  one word never changes the block's alignment.
- **Captions never truncate.** Caption cues segment at clause boundaries;
  a cue that ends mid-sentence is a bug in cue segmentation, not a style.
- **Protect the caption rail.** Keep the bottom caption zone clear of credits,
  labels, and panel text. Move those elements upward instead of allowing an
  overlap exception.
