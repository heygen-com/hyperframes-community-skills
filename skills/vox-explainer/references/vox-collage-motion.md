# Vox Collage Motion

Two speeds exist: ELEMENTS move in 12fps micro-holds over smooth eases;
CAMERA moves smoothly. Hand-authored sparse tl.set holds (3-10Hz) read as
chop — that is the failure this skill prevents.

## The stepEase helper (elements)

```js
const stepEase = (base, dur, fps = 12) => {
  const e = gsap.parseEase(base);
  const n = Math.max(1, Math.round(dur * fps));
  return (p) => e(Math.floor(p * n) / n);
};
```
Pure function ⇒ deterministic, seek-safe, render-safe. Card pops:
`fromTo(scale 1.10→1.0, 0.3s, stepEase("back.out(1.6)"), immediateRender:
false)` after an autoAlpha set. Block settles: one tween 1.24→1.0 over the
beat, stepEase("power2.out").

## Camera moves (always smooth)

- Zoom-isolation push: power4.in, ~1.2s, scale to the measured overflow
  (4.5-7×), translate x/y in the SAME tween so travel shares the ease.
- Inverse zoom-through (arrival): expo.out ~1.1s from scale ~3.2 with the
  target cell pinned — the previous beat's subject docks as a grid cell.
- Plate pushes: linear 3-4% over the beat (camera intent, not idle).
- Drive-pasts (viewer is moving): power3/4.in, blur ramps with speed, and the
  object VANISHES the frame it fills the screen — never hold a blurred wall.

## Seam mechanics (zoom-isolation swap)

1. End the push tween ON the last pre-swap frame — a tween ending between
   frame samples never renders its final state.
2. Align EMPIRICALLY: render last-pre and first-post frames, mask-detect the
   carrier in both, and correct the tween's x/y by the measured delta (1:1).
   Use unclipped edges when the carrier overflows frame. Repeat until centers
   agree within ~30px and sizes within ~10%. Never trust origin math —
   helpers may override transformOrigin (script order wins).
3. The incoming cutout enters at 0.90-0.93 still GROWING (scale-velocity sign
   carried), decelerates in ~0.5s, then creeps ~1%/s (camera intent).

## Choreography rules

- Show-before-tell: when VO is slow to the point, the visual may lead by
  ~1-1.5s (tags, morse taps, anchors). Reactions start ~100ms BEFORE their
  cause completes; never after.
- Word-synced events land ON word timestamps from the transcript. Decoupled
  sequences (promoted text staircases) run their own fast cadence instead of
  waiting for VO.
- Stillness before climax: 0.3-0.75s dead hold before a reveal is
  deliberate; longer than ~3s is a planning bug.

## Gates

- Dead-time: MAD every consecutive frame pair of the render; no still run
  >3s. Fill with staged reveals/camera intent — NEVER idle wobble
  ([motion-continuity.md](motion-continuity.md) still governs).
  **Measure at >=640x360 with TWO metrics** — mean abs diff AND a changed-pixel
  count (pixels moving >12 levels). A frame pair is still only if BOTH are
  negligible (mean <0.25, changed <150px). At 320x180 mean-only, a 30px text
  reveal vanishes into the average and the sweep invents dead time that is not
  there — verify any reported run by snapshotting inside it before "fixing" it.
  Slow camera creeps (<=2% over a beat) also score ~0: they are legitimate
  intent, not motion the gate can see.
- Seam measurement as above, per zoom swap.
- Keyframe sheet: one rendered frame per beat, reviewed by eye — MAD alone
  misses blank-but-white failures.

## Event-density gate (timeline-side; the pixel sweep cannot replace it)

The frame-difference (MAD) sweep is blind to creep-only stretches: a slow
camera drift defeats the threshold while reading as dead air. So verify
density on the TIMELINE, not pixels: no 3.0s window of any beat without a
discrete authored event — a pop, a swap, a highlight igniting, a zoom
starting, a caption promoting. Walk the timeline's event times per beat and
log the largest gap. A beat that holds one composition for its whole duration
with only camera drift is a planning bug: add a staged reveal.
