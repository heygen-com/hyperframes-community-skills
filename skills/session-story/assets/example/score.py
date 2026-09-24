"""score.py: the reference film's score. One theme in F major carries the session: a music box while Claude sleeps, a
brass fanfare on the hook, the flute in the morning, the clarinet while Claude writes, the violins when praise lands,
horns over the long build, and the whole orchestra on the last butterfly. Every cue is orchestra.py's default.
"""
from orchestra import *

key('F', 'major')
tempo(.56)
theme([('C5', .5), ('F5', .5), ('A5', .75), ('G5', .25), ('F5', .5), ('E5', .25), ('F5', .25), ('C6', 1.5)],
      [('D6', .5), ('C6', .5), ('A5', .75), ('F5', .25), ('G5', .75), ('E5', .25), ('F5', 1.5)])
build()
