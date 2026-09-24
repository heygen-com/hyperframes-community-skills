# The video

One Strudel editor on a 1080×1080 canvas, painted from the recorded events. Every frame is a
function of time, so any frame renders on its own.

## Grammar

| Moment | What the viewer sees |
| --- | --- |
| Opener (`pre` seconds, default 2) | Line 1 types on. The rest of the program fades in, muted, and the camera pans down to the first part, landing as the music starts with a ctrl+enter flash |
| Parts entering | Each paragraph of code sits in the theme's muted color until its first note, then its syntax colors bloom down the block. Punchcards and the scope open under their line |
| Notes | The token that produced a note is outlined while it sounds, flashes inverted on the onset, rings on sparse parts, and leaves a short fading trail. Lines with a sounding token glow slightly |
| Theme switches | The editor blends between real Strudel themes. A switch finishes on its bar, or starts on it with `"start"` (use that for the bar a drop ends) |
| Builds | The all() sweep washes the frame and corrupts the code: random cells swap for ASCII or code characters, and late in the build whole rows tear sideways. No labels or callouts |
| Drops | The frame shatters from the center into a graffiti ASCII storm made of the code's own characters, one scene per bar: bubble word, bubble bar number, pill-shaped punchcard, round tunnel, giant scope, everything at once. Kicks send shockwave rings and surge a liquid warp, snares tear bands across, the rain part falls in columns placed by pitch |
| Drop ends | The storm freezes and decodes back into the editor in a growing circle, code characters settling as the front passes |
| Sign-off | The camera zooms to the bottom, the caret presses enter twice, the `signoff` comment types on, and everything fades to black |

## video.json

```jsonc
{
  "track": "track.strudel.js",   // the Strudel file, next to video.json
  "bars": 32,                    // length of the arrangement
  "fps": 30,
  "pre": 2.0,                    // seconds of opener before the music
  "opener": true,                // false: start on the first part with no typing
  "signoff": "// dj opus out",   // null: no sign-off, just a fade
  "builds": [[9, 13], [21, 25]], // [first bar, bar after the last]
  "drops": [[13, 21], [25, 33]],
  "themes": [[1, "bluescreen"], [5, "fruitDaw"], [9, "redText"], [13, "sonicPink"], [21, "CutiePi", "start"], [25, "dracula"]],
  "storm": {
    "kick": "kick",              // part whose onsets ring and warp the storm
    "snare": "snare",            // part whose onsets tear bands
    "rain": "vox",               // part that rains by pitch
    "punch": "bass",             // part drawn as the full-screen punchcard
    "words": ["DROP", "LOUD"]      // one entry per drop; "A|B" shows A then B, half a bar each
  },
  "ending": { "bars": 2, "code": "$: ..." }, // optional: played once after the arrangement
  "camera": [[5, "bass:", { "s": 0.9 }]]     // optional: [bar, text on the line to frame, options]
}
```

Leave `camera` out to get the automatic plan: frame each part as it powers on, push in on the
`all(` block during builds, reveal the newest part after a drop, pull wide after the last drop,
and zoom to the sign-off. Shot options: `s` (scale), `f` (where the line sits, 0 top to 1 bottom),
`dur`, `ease: "inOut"`, `creep`, `push`.

Graffiti words read up to 4 letters. Longer words turn into rows of blocks at the storm's cell
size, so split them with `|` or pick a shorter word. Letters with tall counters or open
sides (C, D, L, O, P, U, V) read best. Rubik Mono One's small counters and narrow gaps (A, B, E,
M, S, W) fill in at the storm's cell size and read as shapes. Words read clearest on black-background
themes (sonicPink, redText, greenText); on a grey background like dracula's they read as shapes.

Theme names: see [themes.md](themes.md).

## Checks before rendering

1. `npx --yes hyperframes@0.8.70 check .` passes with 0 errors (lint, runtime, layout, motion,
   contrast). Expect `canvas_overflow` info notes for code lines below the frame (the program is
   taller than the canvas and the camera moves over it) and 0 contrast samples (see
   [themes.md](themes.md)). The
   template marks its intentional layering (tokens over tokens, the storm over the editor) with
   `data-layout-allow-occlusion` / `data-layout-allow-overlap`; do not add those anywhere else.
2. Snapshot the moments that matter and look at them. `build-data.mjs` prints the command with
   the times filled in: the opener (0.6 s), the first part (`pre + 1.5`), each later part as it
   powers on, each build's last bar, each drop's first two bars, each decode (drop end + 0.55;
   the decode takes 1.1 s), and the sign-off (typed at `END + 3.2`, fading at `END + 4.0`, where
   `END` is the end of the arrangement plus the ending bars). Bar b starts at
   `pre + (b - 1) * 240 / bpm` seconds. Keep `--describe false`: without it the snapshot command
   uploads the frames to a hosted model to caption them.
3. Tokens must sit exactly inside their boxes (zoom a snapshot). If they drift, the font did not
   load; check that `assets/fonts/` exists and `build-data.mjs` ran.
4. After rendering, confirm the audio starts at `pre`: the first sound in the MP4 should land
   within one frame of it.

## Limits

- 1080×1080 only. Lines longer than 56 characters run off the frame in close shots.
- One scope widget per video (the first `._scope()`).
- Bar numbers in the storm go up to 16 per drop.
- The storm is expensive to render (tens of thousands of glyphs per frame). A 60 s video takes a few
  minutes locally.
- Recording renders audio offline in headless Chrome. A 32-bar track takes about 5-7 minutes,
  most of it in the mix step, with a progress line per step. Give the command a 10 minute
  timeout.
