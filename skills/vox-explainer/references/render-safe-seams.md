# Seam Craft — render prerequisites for scene-to-scene transitions

This is the **render-correctness rules** for scene-to-scene seams: the
prerequisites and master-timeline mechanics that make any transition composite
correctly, independent of which specific transition is chosen. The per-transition
catalog (crossfade, push-slide, zoom-through, velocity-matched transitions, …) lives in
[velocity-matched-transitions.md](velocity-matched-transitions.md); this page contains
the rules underneath all of them.

The transitions these rules govern are **Tier-B-ready**: pure transform / opacity /
filter on the two scene **clip wrappers** (`#el-<sid>`), no injected overlay DOM, no
per-scene cooperation. Overlay families (staggered blocks, blinds, light leak, grid
dissolve, page burn) and shader transitions are deferred to later phases.

## Stage ground prerequisite (white-flash guard)

Several templates open a window where the two wrappers' summed opacity < 1 (the
velocity-matched-transitions mid-window cut, zoom-through's 0.15 floor, plain crossfade's
power-curve dip). Whatever is BEHIND the wrappers shows through during that
window. If the assembled `index.html` `#root` has no opaque background, the
renderer composites the dip over its default **white** page → a white flash at
every seam, especially on dark films.
**The assembler must paint the stage:** `#root { background:
var(--canvas-deep, var(--canvas, #000)) }`. Any assembler or consumer of these
templates owns the same guarantee.

## How the injector applies a transition

At a `break` boundary between scene _i_ (`from`) and scene _i+1_ (`to`), the
injector:

1. Extends `#el-<from>` wrapper `data-duration` by `duration_s` (holds its final
   frame — verified: `core/src/runtime/init.ts:1393-1410` external-slot branch).
2. Pulls `#el-<to>` wrapper `data-start` earlier by `duration_s` (creates the
   overlap window).
3. Reassigns **all** clip `data-track-index` as a 0/1 ping-pong so the two
   overlapping wrappers never share a track (same-track overlap is illegal —
   `core/src/lint/rules/composition.ts`). Higher track composites on top.
4. Stamps the `gsap_template` into `window.__timelines["main"]` at `T = overlap-start`.

Verified by prototype render (2026-05-31): the master-timeline wrapper tween is
seeked and rendered (no double-seek with the sub-comp's own paused timeline —
the runtime drives them independently), the extended wrapper holds scene _i_'s
final frame, and the higher-track incoming wrapper composites over + blends with
the outgoing one.

## Template placeholders

The injector substitutes these tokens in each `gsap_template` line:

| Token                              | Meaning                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `__OLD__`                          | `"#el-<from>"` — outgoing clip wrapper selector (quoted)                 |
| `__NEW__`                          | `"#el-<to>"` — incoming clip wrapper selector (quoted)                   |
| `__T__`                            | overlap-start time in seconds (master clock)                             |
| `__DUR__`                          | `duration_s` for this boundary                                           |
| `__DX__`                           | horizontal travel for directional types: `-1920` (LEFT) / `1920` (RIGHT) |
| `__DY__`                           | vertical travel: `-1080` (UP) / `1080` (DOWN)                            |
| `__ORIGIN_OUT__` / `__ORIGIN_IN__` | transformOrigin pair for `squeeze`                                       |

`filter` / `scaleX` / `transformOrigin` are lint-clean on the master timeline
(verified: `core/src/lint/rules/gsap.ts` has no per-property whitelist and scopes
its checks to `data-composition-id` ranges; the x/y/scale/rotation/opacity
whitelist is a _scene-worker_ prompt rule only — it does not bind index.html).
