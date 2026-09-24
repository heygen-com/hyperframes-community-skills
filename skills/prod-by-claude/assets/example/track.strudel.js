// prod by claude
// SQUARE ONE · strudel · 134 BPM · C major

setcpm(134/4)

// vi IV I V, one root per bar
const ROOTS = "<a2 f2 c3 [g2@3 e2]>"

stabs: note(ROOTS)
  .seg(16).trans("[0, 12, 7]")
  .sound("square")
  .lpf(slider(4000, 400, 6000)
    .mul("<.15 .3 .5 .75 1!28>"))
  .o(2).postgain(.3)
  ._punchcard()

bass: note(ROOTS).trans("[-12, 0]")
  .struct("x - - x - - x - x - - x - - x <- x>")
  .sound("[sawtooth, sine]").o(2)
  .lpf(1100).decay(.22).sustain(.25).release(.15)
  .gain(.5)
  .mask("<0!4 1!16 0!2 1!10>")
  ._punchcard()

// synth drums, all built-in sounds
kick: s("sbd*4").decay(.45).gain(.62).duck(2)
  .mask("<0!8 1!12 0!2 1!10>")

hats: s("white*16").decay(.035).sustain(0).hpf(7000)
  .gain("[.28 .12 .38 .12]*4").o(3)
  .mask("<0!4 1!28>")

snare: s("- white - white").decay(.14).sustain(0)
  .hpf(1400).gain(.42).room(.3).o(3)
  .mask("<0!12 1!8 0!4 1!8>")

roll: s("white*16").decay(.05).sustain(0).hpf(2500)
  .gain(saw.range(.05, .45)).o(3)
  .mask("<0!11 1 0!11 1 0!8>")

// dj knobs + the build sweeps
const ROOM = slider(.2, 0, 1)
const BUILD = saw.mul(.25)
  .add("<0!8 0 .25 .5 .75 0!8 0 .25 .5 .75 0!8>")
  .mul("<0!8 1!4 0!8 1!4 0!8>")
all(x => x
  .hpf(BUILD.mul(BUILD).mul(1800))
  .hpq(BUILD.mul(5).add(.7))
  .room(BUILD.mul(.5).add(ROOM))
  .velocity(.6))

// vocal chop chain: a saw through a moving vowel
vox: note(`<[e5 - e5 c5 - a4 - c5 e5 - g5 - e5 c5 - a4]
  [f5 - f5 c5 - a4 - c5 f5 - a5 - f5 c5 - a4]
  [e5 - e5 c5 - g4 - c5 e5 - g5 - e5 c5 - g4]
  [d5 - d5 b4 - g4 - b4 d5 - g5 - e5 b4 - g#4]>`)
  .sound("sawtooth").vowel("[a o e o]*4")
  .decay(.12).sustain(0).release(.05).lpf(3200)
  .transpose("<0!24 [0, 12]!8>")
  .delay(.3).delaysync(3/16).delayfeedback(.4)
  .o(2).gain(.32)
  .mask("<0!12 1!20>")
  ._scope()
