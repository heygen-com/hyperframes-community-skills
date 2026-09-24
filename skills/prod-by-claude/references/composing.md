# Composing the track

Rules for writing a Strudel track that plays well and films well. The recorder reads the code as
written, so every rule here is about the code itself.

## Shape

- One cycle is one bar: `setcpm(bpm / 4)`. Pick the tempo first; everything below counts bars.
- Write a fixed-length arrangement (32 bars is the default) and set `bars` in `video.json` to it.
- Give each part its own label on its own paragraph (`stabs:`, `bass:`, `kick:`). The video
  powers a paragraph on at its first note, so a blank line between parts is a visual cut.
- Arrange with one mask per part, one step per bar: `.mask("<0!4 1!16 0!2 1!10>")`. Count the
  steps: they must sum to `bars`.
- A standard arc: 1-4 intro (one part), 5-8 add bass and hats, 9-12 build, 13-20 drop,
  21-24 breakdown into build 2, 25-32 drop 2. Keep `builds` and `drops` in `video.json` in sync.
- Put the opener comment on line 1 (it types on). Keep lines to 56 characters or fewer so they
  fit the frame in close shots. Break long chains after a `.`.

## Labels

- Never start a label with a capital S (`SUB:`, `STABS:`): Strudel treats it as solo and mutes
  every other part. `record.mjs` refuses these. Use lowercase labels.
- `_name:` mutes a part. Use it to audition, not in the final track.

## Parts that read on screen

- Stabs: `note(ROOTS).seg(16).trans("[0, 12, 7]")` puts root, octave and fifth on every 16th.
  Busy parts flash softly in the video; sparse parts get rings.
- Bass: a dotted rhythm reads well, e.g. `.struct("x - - x - - x - x - - x - - x <- x>")`.
- Chord or root progressions as a `const` string (`const ROOTS = "<a2 f2 c3 [g2@3 e2]>"`) light
  up once per bar in the video, so the harmony is visible.
- A vocal-style chop chain without samples: a saw through `.vowel("[a o e o]*4")` with a short
  `.decay(.12).sustain(0)` and a dotted-8th delay.
- Add `._punchcard()` under parts worth watching and `._scope()` under one part (usually the
  lead or vocal chain). Both become live widgets in the video.
- Sliders (`slider(4000, 400, 6000)`) render as Strudel's slider widget at their written value.

## Drums

- Built-in synths are free to use: `sbd` (kick), `white` / `pink` noise with a short decay and a
  high-pass (hats, snares, rolls). The example track uses only these.
- Samples need rights. Anything loaded with `samples(...)` or a `.bank(...)` is someone's
  recording: use sounds the user owns or has cleared, and say so in the delivery.
- Breakbeats (only with a cleared break): slice with `splice(16, pattern)`, not `slice`, so every
  slice is stretched to its step and the hits land on the grid at your tempo. Play the slices
  mostly in order with fills; random order sounds broken. If the file has silence before its first
  hit, pull it forward with `.early(cycles)` (lead-in seconds × cps).
- Never layer a second drum kit on top of a break: the two kicks and snares flam and read as
  "doubled". For more weight, layer the break's own kick slices through a low-pass:
  `.superimpose(x => x.lpf(150).gain(1.2).mask(...kick slices...))`.

## Space and effects

- Reverb size and delay settings belong to an orbit, not a sound. Give each group its own orbit
  (`.o(2)` bass, `.o(3)` pads and hats) and keep `size` / `delaysync` identical inside an orbit.
- Sidechain with the kick: `.duck("2:3")` (the kick ducks orbits 2 and 3).
- Tempo-synced echoes: `.delay(.3).delaysync(3/16).delayfeedback(.4)`.
- `chorus` does not widen a mix; supersaw `.spread(1)` does.
- Builds: sweep a high-pass and the reverb over everything from one `all(...)`:

```js
const BUILD = saw.mul(.25)
  .add("<0!8 0 .25 .5 .75 0!8 0 .25 .5 .75 0!8>")
  .mul("<0!8 1!4 0!8 1!4 0!8>")
all(x => x
  .hpf(BUILD.mul(BUILD).mul(1800))
  .hpq(BUILD.mul(5).add(.7))
  .room(BUILD.mul(.5).add(.2))
  .velocity(.6))
```

  The video reads this sweep back: it drives the build wash and the code corruption.
  Only one `all(...)` counts; a second one replaces the first.

## Levels

- Measure before anyone listens. `record.mjs` prints peak and RMS per 4 bars and warns on any
  clipped sample. Aim for drops at or below -2 dBFS peak and about -18 dBFS RMS, with the intro
  and breakdown 5-10 dB quieter.
- Trim everything at once with `.velocity(...)` inside the `all(...)`.
- Resonance (`hpq`) and kicks are the usual culprits when a build clips.

## The ending

- `ending` in `video.json` is Strudel code played once after the arrangement (for example a final
  hit), plus bars of tail. It is only used for the render, so the track itself still loops.
