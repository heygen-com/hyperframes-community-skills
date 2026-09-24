# Score: compose your own orchestration

The score is cartoon scoring. Every cue lands on the action it belongs to: the plane's touchdown, each fold, the throw,
the swing, the bonk, the butterfly's landing. `orchestra.py` has a default cue for every beat type, timed from
`score/timeline.json`, so the music follows your story wherever its beats fall. You write what makes it yours.

## What you must write

1. **A theme** for your user, in your key. Not the example's. 6 to 10 notes, about 4 to 5 beats: an opening leap, a
   turn, a long last note. An `ANSWER` phrase that comes back home.
2. **A key and a mode** that fit them: `key('D', 'minor')`, `key('Bb', 'major')`.
3. **A palette:** who plays each role. An orchestra is the default. A jazz combo, a folk band or a chiptune rig are
   all fine if they fit your user better.
4. **At least one cue of your own,** for something specific to this user or this session.

```python
from orchestra import *

key('D', 'minor')
tempo(.48)                        # seconds per beat for every melody whose length is free
theme([('D5', .5), ('F5', .5), ('A5', .5), ('C6', .75), ('A5', .25), ('G5', .5), ('E5', 1)],     # THEME
      [('F5', .5), ('E5', .5), ('D5', .5), ('A4', .5), ('C5', .5), ('D5', 1.5)])                  # ANSWER
palette(lead='vibraphone', reply='muted trumpet', sing='string ensemble 2', pad='warm pad', pizz='acoustic bass')

def praise(b):                    # every praise gets a sax lick on top of the default cue
    cue_praise(b)
    line(b['at']['love'] + .1, [(74, .25), (77, .25), (81, .25), (79, .5), (77, .25), (74, 1)], .3, 84, 'horn')

build(cues={'praise': praise})
```

Run `sh score/build.sh` from the project. It composes, renders, masters to -16 LUFS into `assets/audio/score.wav`,
and checks the result.

## Where the theme plays

| moment | what plays it |
|---|---|
| asleep | a music box: the theme's opening, an octave up (`sparkle`) |
| the hook | a fanfare on the theme's first three notes, then its top note held (`fanfare`, `brass`) |
| the first request | the whole theme then the answer, over walking pizzicato (`lead`) |
| each reply | the theme's opening while you write (`reply`) |
| a praise lands | the whole theme, strings swelling (`sing`, `horn`) |
| a long run | the theme broad on horns, a half per two bars (`horn`) |
| back to sleep (`ending: sleep`) | the music box again, as at the start (`sparkle`) |
| the last praise | everyone, the theme with its last note shortened (`sing`, `horn`, `cello`) |

## Pitch

- Your `THEME` and `ANSWER` are note names in your key: `'C5'` is MIDI 72, and `'Bb3'` and `'F#2'` work.
- Any other bare name is read as F major and moved into your key and mode. That's how the cue library follows your
  key, and it applies to names in your own cues too: in D major, a bare `'D5'` plays B4.
- In your own cues, write `own('D5')` (the note as written, never moved) or an integer. Drums are integers: 36 kick,
  38 snare, 49 crash, 81 triangle.
- `tempo()` scales every melody whose length is free: the music box, the reading, the reply voice, the praise theme,
  the outro. Melodies timed to an action (the first request's theme, the long run's horns) fit the action instead.

## Roles

| role | default | plays |
|---|---|---|
| `lead` | flute | the morning theme, touchdowns, the throw's flourish, the outro question |
| `reply` | clarinet | your replies, the yawn, the daze after a bonk |
| `read` | oboe | reading a request |
| `sing` | strings | swells, the praise theme, a long run's driving line |
| `pad` | slow strings | chords under everything |
| `trem` | tremolo strings | the boot, the mallet looming |
| `pizz` | pizzicato strings | walking bass, typing, work |
| `pluck` | harp | the unfold, every fold crease, runs |
| `timp` | timpani | hits, rolls |
| `sparkle` | celesta | the music box, wings, stars after a bonk |
| `bell` | glockenspiel | the hook typing, the idea, landings |
| `stab` | xylophone | the startled wake |
| `fanfare` | trumpet | the hook, an excited request, a long run's finish |
| `horn` | french horn | long runs, praise, the fix |
| `low` | trombone | the swing, the womp-womp |
| `bass` | tuba | the mallet looming |
| `brass` | brass section | tutti chords |
| `reed` | bassoon | breathing asleep, the work's bass |
| `cello` | cello | bass lines under praise and long runs |
| `drums` | the General MIDI kit | hits, a long run's snare |

Instruments are General MIDI names from `GM` in `orchestra.py` ("vibraphone", "nylon guitar", "square lead"), or
`strings`, `slow strings`, `harp`, `horn`, `piano`, `drums`. `mix(role=(gain, pan))` sets a role's level and pan. Two
roles on one instrument share one level and pan, the first role's. For a one-off sound in your own cue, pass any
General MIDI name as the role: `note(t, own('D5'), .5, 90, 'banjo')`.

## Writing a cue

A cue is `def name(b)`. `b` is one block from `timeline.json`: `b['S']` start, `b['end']` end, and `b['at']`:

| block | `b['at']` |
|---|---|
| open | `boot`, `screen`, `type` [a, b], `hook`, `out`, `wake`, `yawn` |
| request | `land`, `grab`, `unfold` [a, b], `read` [a, b], `react`, `putdown`, `loop` [a, b] or null. Also `b['first']`, `b['flight']`, `b['react']` |
| work | `done`. Also `b['size']` |
| reply | `grab`, `type` [a, b], `fold` [a, b], `windup`, `rel` (the throw's release). Also `b['night']` |
| correction | `hang`, `swing`, `hit`, `lift`, `show` (the words face camera), `jabs` [a, b], `exit`, `gone` |
| praise | `land`, `love`. Also `b['finale']` (the last praise before the outro) |
| outro | `b['ending']`: `next` has `wink`, `close`; `sleep` has `yawn`, `sleep`, `off` (the monitor goes dark), `close` |

Tools: `note(t, n, dur, vel, role)`, `chord`, `seq`, `line(t, [(n, beats)], sec_per_beat, vel, role)`, `run`, `arp`,
`trem`, `swell` (expression), `gliss`, `hit`, `pad`, `scale(a, b)`, `up(T, octaves)`, `head(T, beats)`, `own(name)`,
`sb(seconds)` (a reference beat length at your tempo). Call the
default (`cue_praise(b)`) and add to it, or replace it outright. Pass your cues as `build(cues={'praise': praise})`.

## Checking it without ears

`score/qc.py` runs at the end of `build.sh`. It prints the level at every beat's key moments, and fails if the score
isn't the film's length or has more than 1.2 s under -45 dBFS. The loudness pass levels the peaks, so the hits (the
boot, the hook, the bonk, a long run's finish) all land near -10 to -14 dB, and a reply's folds sit around -22 to
-32 dB. Read the table for a moment much quieter than its neighbours: that one has no cue on it.

## Renderers

- macOS: `swift render.swift events.json out.wav` plays `events.json` through Apple's built-in General MIDI bank
  (`gs_instruments.dls`), with a concert-hall reverb. No downloads.
- Elsewhere: `build.sh` uses `fluidsynth` with the `.sf2` in `SOUNDFONT`. `score.mid` is a standard MIDI file for
  any synth or DAW.
