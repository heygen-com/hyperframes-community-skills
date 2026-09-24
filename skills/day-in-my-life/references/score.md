# Score: a string arrangement on the film's clock

`python3 scripts/score.py <film>` composes the score from `story.json` and `archetypes.json`, the same event table
the scenes draw from. It writes `music/strings.mid`, `strings.wav`, `strings-mix.wav` and `keys.wav`. The music is
composed on the film's clock, so it can't drift: every knock, pin, snap and lamp is a note at the same timestamp as
its drawing.

## The clock

- 96 BPM, 4/4, D major. Beat 0.625 s, bar 2.5 s. Every chapter is 2 bars; the intro is 4; `kept` is 2.5 (2 bars of
  music, then silence).
- Event times in `archetypes.json` sit on beats. Change one there, or per chapter under `"events"`, and both picture
  and score move. Keep new times on the 0.625 s grid (eighths 0.3125, sixteenths 0.15625).

## The theme

The command typed into the terminal is the theme: `c l a u d e` = **D E F♯ A B A**, one pitch per letter.
- `intro`: the head (D E F♯ A) in high harmonics while the title writes on, then plucked one note per keystroke.
- `shelf`: sung legato by the first violin over pizzicato.
- `side-by-side`: two violins an eighth apart, locking into unison on the snap.
- `diff`: written in as the new lines appear.
- `good-part`: blown up tutti, an octave higher.
- `tag`: plucked again, solo, as the next morning starts.

## Recipes (one per chapter type)

| type | what the strings do | synced to |
|---|---|---|
| `intro` | open fifth under the title; harmonics foreshadow the theme; cello walks down with the tilt; the command plucked per key; a pizzicato chord on Enter; tremolo swell into the ink | `write`, `tilt`, keystrokes, `enter`, `push` |
| `shelf` | theme on first violin, pizzicato arpeggios, walking cello; I → vi → IV | nothing (steady under the dolly) |
| `first-message` | a playful staccato answer; a two-note sigh on the hop; a pizzicato slap on the sticky | `hop`, `sticky` |
| `watching` | switches to con sordino (muted strings) on the mute hit; stays open if `muted: false` | `mute` |
| `frames` | ticking sixteenths that stop for the held breath on the find; the viola walks down with the magnifier | `tape`, `walk`, `pause`, `walk2` |
| `building` | spiccato drive, the theme climbing higher; a pluck per page | `pages` |
| `terminal` | pizzicato typing; a pluck on Enter; staccato output; a sour stab over tremolo when it fails, the fix, a D major resolution when it passes (or a bright chord on `done`) | `type`, `enter`, `fail`, `fix`, `rerun`, `pass` |
| `diff` | light spiccato; col legno scratches as lines are struck; the theme as the new lines are written; a pizzicato on the stamp | `strike`, `write`, `stamp` |
| `restart` | everything stops dead at power-off; one high harmonic hangs; three plucks count the dots; a run brings everyone back | `off`, `dots`, `on` |
| `knock` | two cello knocks; a rising question on the check-in; the viola answers | `knocks`, `bubble`, `hop`, `show` |
| `notes` | tremolo unrest; a staccato hit per pinned note; col legno scratches on the cross-outs; plops for the paper balls | `pins`, `cross`, `balls` |
| `ship` | a held pad; plucks for the seal and the stamp; a rising run as it flies; a bright chord on the status | `seal`, `stamp`, `send`, `status` |
| `side-by-side` | canon an eighth apart → unison on the snap → tremolo swell into the ink | `snap` |
| `good-part` | hush; a held breath on the dominant; a run up; full tutti on the climax | `breath`, `tutti` |
| `kept` | a quiet chorale; an arpeggio as the book flies; a pizzicato as it lands; cut dead by the lamp, tails included | `fly`, `land`, `lampOff` |
| `tag` | the theme plucked per keystroke; a harmonic chord on Enter, fading out | keystrokes, `enter` |

## Orchestration rules

- **Five parts:** vln1, vln2, vla, vc, cb. Violins sit left, the lows right, bass centre. Keep each part in its
  range: vln above G3, vla above C3, vc above C2, cb above E1.
- **Arc:** pianissimo title → mezzo working chapters → any near-silence (a restart, a failing test's held breath) →
  forte for the payoff (`side-by-side`, a green `terminal`, `ship`) → the tutti for `good-part` (the loudest moment)
  → piano chorale → silence at the lamp → solo tag.
- **Hits:** land on the drawing that shows the event, never after it. A hit is a pizzicato, a staccato chord or a
  scratch. No percussion, no synth, no stock stingers.
- **Harmony:** diatonic D major throughout, so chapters in any order still join cleanly. Each recipe opens on
  I, IV, V or vi.
- **Space:** keep one dead stop (the lamp) and, when the story has one, a real silence (a restart). The comedy
  lives in them.

## The performance

`score.py` synthesizes the MIDI:
- **Bowed notes:** additive (up to 48 harmonics), per-instrument body formants and roll-off, delayed vibrato,
  bow noise, and 2-3 detuned players per section. Con sordino darkens the tone and drops the level.
- **Pizzicato:** Karplus-Strong with body colour.
- **Room:** a band-split synthetic hall (lows ring longest).
- **Mastering:** ffmpeg compresses lightly and loudness-normalizes to -17 LUFS integrated, -1.5 dBTP. `qc.py`
  checks -19 to -15.

## Re-voicing

The composition is `music/strings.mid`: 5 tracks, program changes for pizzicato (45) and tremolo (44), velocity =
dynamics. To play it through a sampled string library (any DAW, or an SFZ/SF2 player), render it to
`music/strings.wav` at 48 kHz stereo, starting at 0 s, then `python3 scripts/score.py <film> --master-only` and QC
again. The film clock doesn't change, so sync holds.

## Adding a recipe

Write `def r_name(n, chord, E, B, C, keys)` in local beats (`n(part, beat, beats, 'F#5', vel, art, **opts)`) and
register it in `RECIPES`. `B(seconds)` converts an event time to local beats. Articulations: `leg`, `spic`,
`stac`, `pizz`, `trem`, `harm`, `scratch`. Options: `sord=True`, `v1=<end velocity>` (crescendo), `cut=True`
(stops dead after its duration).
