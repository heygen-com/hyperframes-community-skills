# Vox Text Overlays

On-screen words are scarce. Each one does exactly one of three jobs or gets
cut: (1) drive the eye — ≤3-word anchor + arrow; (2) carry ONE promoted
sentence per act — the open loop, staircased; (3) name things — credits,
labels, reveals. Never caption the VO in display type; the rail does that.

## Highlights animate ON — global rule, no exceptions

The motion of marking is the meaning; a hard-appear reads as pre-printed.
- Yellow text highlight: bar sweeps L→R behind the words.
  `background-image: linear-gradient(#FFE619,#FFE619); background-repeat:
  no-repeat;` tween `backgroundSize` "0% 100%" → "100% 100%", ~0.4s,
  stepEase-quantized.
- Extend-then-type (the measured source move): the bar grows in steps
  LEADING the letters by ≤1 step; letter groups toggle in behind it.
- Hand-drawn circles/ellipses: stroke draws on via
  `stroke-dasharray/dashoffset` tween, ~0.4s.
- Underlines run L→R. Lower-third role chips with highlight fills count as
  highlights and sweep too.
- Gate: grep the comp for `.hl`, `#FFE619`, and stroked ellipses — every hit
  needs an on-animation.

## Anchors and arrows

- Anchor = bold small-caps ≤3 words ("THIS FONT", "THAT'S HER", "THIS WORD"),
  paired with a curved 2-3-step drawn arrow whose TIP touches the subject.
- An arrow without text has no point — always label it.
- Show-before-tell: when the VO is slow to arrive, the anchor may land
  ~1-1.5s BEFORE its words are spoken; reactions may lead causes slightly,
  never lag them.

## Promoted sentences (staircase text)

One per act, maximum. Staircase layout across 2-3 lines; words step in fast
on their own cadence (do NOT wait for slow VO); mixed per-line treatments
(letterspaced on a newsprint strip / plain heavy / pencil-underlined /
highlight-typed). The whole block settles 1.24→1.0 stepEase power2.out over
the beat.

## Credit slot

Left-margin, right-aligned: process-blue bold line (#66CFFF) over a small
black caps line. Used for photo credits, nicknames, sign callouts, editor
credits — same slot every time so the eye knows where names live.

## Caption rail

Quiet verbatim rail: 30px 600-weight #222, bottom-center (y≈980), white glow
for dark/blue sections, single-frame HARD cuts between cues (no fades).
Caption the PERFORMED read verbatim. Suppress cues wherever a promoted
sentence already carries those words on screen. If only part of a cue is
promoted, split the cue at a phrase boundary and suppress only the duplicated
part. Display conventional spellings such as `1868` or `ATM` while preserving
the performed wording and timing. Keep other labels and credits out of the
caption rail's bottom safe zone.
