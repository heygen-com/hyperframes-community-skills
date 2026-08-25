# Keyframe Overlap — the intra-object velocity law

`motion-continuity`'s vector law says velocity must not die at a seam between SCENES.
This is the same law one level down: velocity must not die between two STAGES of one
element's own motion. Overlap the stages and an L-shaped move stops having a corner and
starts having an arc.

**Why it exists.** A single element doing two things in sequence is the most common
motion unit in any film, and the default scheduling — stage two begins on the frame
stage one lands — puts a dead frame in the middle of it. That frame is what reads as
cheap. Overlapping costs nothing: same elements, same eases, one changed start time.

## The rig

One wrapper per stage, nested. The artwork is the leaf. Each wrapper owns exactly one
property so the transforms never fight.

```html
<div id="outer">            <!-- stage 2 -->
  <div id="inner">          <!-- stage 1 -->
    <div id="art">…</div>
  </div>
</div>
```

In After Effects these wrappers are parented nulls (`Null 191` → `Null 190` → shape).
Convert an AE rig by mapping one null to one wrapper, in order.

## The two invariants

| | Value | Notes |
|---|---|---|
| **Overlap** | **39% of a stage** | stage 2 starts when stage 1 is 61% through (29f into a 75f stage @60) |
| **Ease** | **`cubic-bezier(.857, 0, .143, 1)`** | symmetric; peak velocity **7.0×** the average |

**The ease is not optional and it is the half everyone drops.** After Effects' stock
Easy Ease is 33% influence — peak/mean **1.49**. Overlap two eases that gentle and you
get mush, not the effect. GSAP's `expo.inOut` (peak/mean `10·ln2` = 6.93) is a valid
drop-in for the measured curve.

**Reading any speed graph into a bezier.** For a symmetric `cubic-bezier(a, 0, 1−a, 1)`,
midpoint velocity ÷ mean velocity = `1/(1−a)` exactly. Measure a graph's peak-to-mean
height ratio, invert, done. A 7× spike is `a = 0.857`.

**Overlap range.** Below ~25% the corner hardens back toward a stop. Past ~50% the two
stages stop reading as two and become one diagonal. 35–45% is the usable band.

## It is property-agnostic — this is the whole point

Nothing in the law mentions position, corners, or the number two. Any two animatable
properties hand off, in either order:

- position → position (any two directions, including both axes in one stage = a diagonal)
- position → scale / rotation / skew
- scale → rotation
- position → letter-spacing, blur, colour
- **and backwards**: rotation → position, letter-spacing → position

Chain three or more stages by overlapping each with the previous. Non-transform
properties (tracking, blur, colour) apply to the leaf instead of a wrapper; the
scheduling is identical.

## Make stage two do a job

The strongest use is not decorative. Pick a second stage that earns its place in the
layout or the story: a word slides in, then **lifts to clear the space** the next lines
reveal into. The motion and the layout become one decision. Reach for a purely
decorative second stage last.

## Apply it between elements too

The same offset works across a boundary: start the next element's entry before the
current element finishes its move. That removes the dead beat between an arrival and the
reveal that follows it, and it is how a single-element technique scales to a scene.
Cascades: see [velocity-matched-transitions.md](velocity-matched-transitions.md) §6.

## Implementation

Drive stages from one analytic clock, not from chained tweens — nothing accumulates
across frames, so a cold seek lands on the same state the render produces.

```js
var MOVE = 1.25, OVERLAP = 0.39, START2 = MOVE * (1 - OVERLAP); // 0.7625s
var EASE = cubicBezierEase(0.857, 0, 0.143, 1);                 // or "expo.inOut"

function draw(t) {
  var p1 = EASE(clamp01(t / MOVE));
  var p2 = EASE(clamp01((t - START2) / MOVE));
  inner.style.transform = "translate3d(" + (DX * (1 - p1)).toFixed(3) + "px,0,0)";
  outer.style.transform = "translate3d(0," + (DY * p2).toFixed(3) + "px,0)";
}
```

Paint one frame synchronously at init. `requestAnimationFrame` does not fire while
`document.visibilityState` is `hidden`, and unset transforms render as a broken frame.

## Verify

**The composite speed between the two stages must never reach zero.** Sample the leaf's
position per frame across the hand-off and check the minimum: a butt-joined rig passes
through exactly 0, an overlapped one bottoms out well above it. That number is the
technique; "looks smoother" is not a check.

Do not measure an ease off player seek timestamps — seeks snap to the frame grid
(`seek(1.422)` lands at 1.400), which manufactures error that is not there. Compare the
ease function, or sample on-grid only.

## Provenance

Derived by measuring an After Effects tutorial's rig, easing, and overlap frame
by frame. Treat the numeric values as a calibrated starting point and verify the
result in the current composition.
