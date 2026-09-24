"""orchestra.py: the score engine for a session story. Your score/score.py sets the key, the tempo, the theme and the
palette, overrides whichever cues it wants, and calls build(). build() reads timeline.json (every beat's times, written
by schedule.mjs) and scores each beat on its own actions, cartoon-style: every cue lands on the frame it belongs to.

Notes: 'C5' = MIDI 72 (C4 = 60). Two kinds of pitch travel through the cues:
  - note NAMES ('F5') are read as the reference key, F major, and moved into your key() and mode on the way out. The
    cue library is written that way, so every default cue follows your key. A bare name in YOUR cue is moved too;
  - INTEGERS pass through untouched. own('D5') gives the integer for a name as written, and theme() stores your THEME
    and ANSWER that way, so write those in your own key.
A role is one of PALETTE's names, or any General MIDI instrument name for a one-off (note(t, own('D5'), .5, 90, 'banjo')).
tempo(s) sets the seconds per beat of every melody whose length isn't fixed by the action it follows.

Writes events.json (for render.swift) and score.mid (for any General MIDI synth). Standard library only.
"""
import json, random, struct, sys

random.seed(7)
E = []

GM = ['acoustic grand piano', 'bright acoustic piano', 'electric grand piano', 'honky-tonk piano', 'electric piano 1', 'electric piano 2',
      'harpsichord', 'clavinet', 'celesta', 'glockenspiel', 'music box', 'vibraphone', 'marimba', 'xylophone', 'tubular bells', 'dulcimer',
      'drawbar organ', 'percussive organ', 'rock organ', 'church organ', 'reed organ', 'accordion', 'harmonica', 'tango accordion',
      'nylon guitar', 'steel guitar', 'jazz guitar', 'clean guitar', 'muted guitar', 'overdriven guitar', 'distortion guitar', 'guitar harmonics',
      'acoustic bass', 'finger bass', 'pick bass', 'fretless bass', 'slap bass 1', 'slap bass 2', 'synth bass 1', 'synth bass 2',
      'violin', 'viola', 'cello', 'contrabass', 'tremolo strings', 'pizzicato strings', 'orchestral harp', 'timpani',
      'string ensemble 1', 'string ensemble 2', 'synth strings 1', 'synth strings 2', 'choir aahs', 'voice oohs', 'synth voice', 'orchestra hit',
      'trumpet', 'trombone', 'tuba', 'muted trumpet', 'french horn', 'brass section', 'synth brass 1', 'synth brass 2',
      'soprano sax', 'alto sax', 'tenor sax', 'baritone sax', 'oboe', 'english horn', 'bassoon', 'clarinet',
      'piccolo', 'flute', 'recorder', 'pan flute', 'blown bottle', 'shakuhachi', 'whistle', 'ocarina',
      'square lead', 'saw lead', 'calliope lead', 'chiff lead', 'charang lead', 'voice lead', 'fifths lead', 'bass lead',
      'new age pad', 'warm pad', 'polysynth pad', 'choir pad', 'bowed pad', 'metallic pad', 'halo pad', 'sweep pad',
      'rain', 'soundtrack', 'crystal', 'atmosphere', 'brightness', 'goblins', 'echoes', 'sci-fi',
      'sitar', 'banjo', 'shamisen', 'koto', 'kalimba', 'bagpipe', 'fiddle', 'shanai',
      'tinkle bell', 'agogo', 'steel drums', 'woodblock', 'taiko drum', 'melodic tom', 'synth drum', 'reverse cymbal']
ALIAS = {'strings': 48, 'slow strings': 49, 'harp': 46, 'horn': 60, 'piano': 0, 'drums': -1, 'kit': -1}
# the roles the cues write for, and who plays them by default: an orchestra
PALETTE = dict(lead='flute', reply='clarinet', read='oboe', sing='strings', pad='slow strings', trem='tremolo strings', pizz='pizzicato strings',
               pluck='harp', timp='timpani', sparkle='celesta', bell='glockenspiel', stab='xylophone', fanfare='trumpet', horn='horn',
               low='trombone', bass='tuba', brass='brass section', reed='bassoon', cello='cello', drums='drums')
MIX = dict(lead=(.8, -.2), reply=(.78, -.15), read=(.7, .1), sing=(.78, 0), pad=(.72, 0), trem=(.7, -.1), pizz=(.8, .2), pluck=(.7, -.35),
           timp=(.85, .1), sparkle=(.55, .3), bell=(.42, .25), stab=(.5, .2), fanfare=(.55, .3), horn=(.62, -.25), low=(.6, .35),
           bass=(.6, .3), brass=(.58, 0), reed=(.7, .25), cello=(.7, .25), drums=(.62, 0))   # (gain, pan) per role
NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
KEY = {'root': 5, 'mode': 'major'}
TEMPO = {'beat': .56}
THEME, ANSWER = [], []
SCALES = {'major': (0, 2, 4, 5, 7, 9, 11), 'minor': (0, 2, 3, 5, 7, 8, 10)}

def program(name):
    if isinstance(name, int): return name
    n = name.lower().strip()
    if n in ALIAS: return ALIAS[n]
    if n in GM: return GM.index(n)
    hits = [i for i, g in enumerate(GM) if n in g]
    if len(hits) == 1: return hits[0]
    raise SystemExit(f'palette: no single General MIDI instrument called "{name}" (see GM in orchestra.py)')

def pitch(n):   # absolute: 'C5' → 72, 'Bb3', 'F#2'
    if isinstance(n, int): return n
    k = NAMES[n[0].upper()]; i = 1
    if n[i] == 'b': k -= 1; i += 1
    elif n[i] == '#': k += 1; i += 1
    return 12 * (int(n[i:]) + 1) + k

def k(n):       # a reference-key (F major) name, moved into your key and mode; integers pass through
    if isinstance(n, int): return n
    p = pitch(n)
    if KEY['mode'] == 'minor' and p % 12 in (9, 2, 4): p -= 1          # F major's 3rd, 6th, 7th → natural minor
    return p + ((KEY['root'] - 5 + 6) % 12) - 6

# ---------- setup: your score.py calls these ----------
def key(root='F', mode='major'):
    if mode not in SCALES: raise SystemExit('key(): mode is "major" or "minor"')
    KEY['root'] = pitch(root + '4') % 12; KEY['mode'] = mode
def tempo(beat): TEMPO['beat'] = float(beat)
def sb(x): return x * TEMPO['beat'] / .56   # a beat length from the reference score, scaled to your tempo
def own(n): return pitch(n)                 # a note name as written, in your key: never moved
def theme(t, answer=None):
    THEME[:] = [(pitch(n) if n is not None else None, b) for n, b in t]
    ANSWER[:] = [(pitch(n) if n is not None else None, b) for n, b in (answer or t)]
def palette(**roles):
    for r, inst in roles.items():
        if r not in PALETTE: raise SystemExit(f'palette(): unknown role "{r}" (roles: {", ".join(PALETTE)})')
        program(inst); PALETTE[r] = inst
def mix(**roles):
    for r, gp in roles.items(): MIX[r] = gp

# ---------- writing notes ----------
def note(t, n, d, v, role, hum=True):
    if n is None: return
    if hum: t += random.uniform(-.006, .006); v += random.randint(-5, 5)
    E.append(dict(t=round(max(0, t), 4), p=program(PALETTE.get(role, role)), n=k(n), v=int(max(1, min(127, v))), d=round(d, 4), role=role))
def chord(t, ns, d, v, role): [note(t + i * .004, n, d, v, role) for i, n in enumerate(ns)]
def seq(t, ns, step, v, role, dur=None, legato=.95):   # equal steps; None entries are rests
    for i, n in enumerate(ns):
        if n is not None: note(t + i * step, n, (dur or step) * legato, v if not callable(v) else v(i), role)
def line(t, notes, beat, v, role, legato=.94):         # a melody of [(note, beats)] at `beat` seconds per beat; returns the end time
    x = t
    for n, b in notes:
        if n is not None: note(x, n, b * beat * legato, v, role)
        x += b * beat
    return x
def scale(a, b):                                        # your key's scale from a to b (reference names), either direction
    lo, hi = sorted((k(a), k(b))); pcs = [(KEY['root'] + s) % 12 for s in SCALES[KEY['mode']]]
    out = [p for p in range(lo, hi + 1) if p % 12 in pcs]
    return out if k(a) <= k(b) else out[::-1]
def run(t, a, b, span, v, role):
    ns = scale(a, b); step = span / max(1, len(ns) - 1)
    for i, n in enumerate(ns): note(t + i * step, n, step * 1.6, v, role)
def arp(t, ns, step, v, role, dur=1.2):
    for i, n in enumerate(ns): note(t + i * step, n, dur, v, role)
def trem(t, ns, d, v0, v1, role, rate=12):              # repeated strokes, swelling from v0 to v1
    n = int(d * rate)
    for i in range(n):
        for x in ns: note(t + i / rate, x, 1 / rate * .9, v0 + (v1 - v0) * i / max(1, n - 1), role, hum=False)
def swell(t, d, a, b, role, rate=24):                   # an expression (CC11) ramp
    n = max(2, int(d * rate))
    for i in range(n + 1): E.append(dict(t=round(t + d * i / n, 4), p=program(PALETTE.get(role, role)), cc=11, val=int(a + (b - a) * (i / n)), role=role))
def gliss(t, a, b, d, v, role):                         # chromatic, for trombones and string swoops
    lo, hi = k(a), k(b); ns = list(range(lo, hi + 1)) if hi >= lo else list(range(lo, hi - 1, -1))
    step = d / max(1, len(ns) - 1)
    for i, n in enumerate(ns): note(t + i * step, n, step * 1.3, v, role, hum=False)
def hit(t, v=120, big=True):                            # a tutti accent: timpani, bass drum, cymbal
    note(t, 'F2', 1.4, v, 'timp'); note(t, 36, .5, v, 'drums')
    if big: note(t, 49, 2.5, v - 5, 'drums')
PROG = [['F3', 'C4', 'A4'], ['D3', 'A3', 'F4'], ['Bb2', 'F3', 'D4'], ['C3', 'G3', 'E4']]   # I vi IV V
def pad(t, chords, each, v, role='pad'):
    for i, c in enumerate(chords): chord(t + i * each, c, each * 1.02, v, role)
def walking_pizz(t, bars, beat, v=62, roots=('F2', 'D2', 'Bb1', 'C2')):
    for b in range(bars):
        r = k(roots[b % len(roots)])
        for j, off in enumerate((0, 7, 12, 7)): note(t + (b * 4 + j) * beat, r + off, beat * .5, v - (8 if j % 2 else 0), 'pizz')
def beats(T): return sum(b for _, b in T)
def up(T, octaves=1): return [(n + 12 * octaves if n is not None else None, b) for n, b in T]
def head(T, nbeats):                                    # the theme's opening, up to nbeats
    out, acc = [], 0
    for n, b in T:
        if acc >= nbeats: break
        out.append((n, min(b, nbeats - acc))); acc += b
    return out
def halves(T):
    half, acc = beats(T) / 2, 0
    for i, (n, b) in enumerate(T):
        acc += b
        if acc >= half: return T[:i + 1], T[i + 1:]
    return T, []
def triad_third(r):                                     # 4 if the diatonic triad on r is major in your key, else 3
    pcs = [(KEY['root'] + s) % 12 for s in SCALES[KEY['mode']]]
    return 4 if (r + 4) % 12 in pcs else 3
def fanfare_head(): return [n for n, _ in THEME if n is not None][:3]
def top_note(): return max(n for n, _ in THEME[:5] if n is not None)

# ---------- the default cues, one per beat type. b = the block from timeline.json: b['S'], b['end'], b['at'][...] ----------
def cue_open(b):
    swell(0, .1, 60, 60, 'pad'); pad(0, [PROG[0], PROG[2]], 1.6, 38)
    line(.45, up(head(THEME, 3)), sb(.42), 46, 'sparkle')                                # asleep: a music box plays the theme's head
    note(1.0, 'F2', 1.1, 34, 'reed'); note(2.6, 'E2', .9, 32, 'reed')                    # he breathes
    run(3.2, 'F4', 'F6', .3, 58, 'pluck'); note(3.5, 'A6', 1.2, 64, 'sparkle')           # the machine wakes
    for i, n in enumerate(scale('F5', 'F7')[:13]): note(3.62 + i * .108, n, .25, 52 + i * 2, 'bell')   # the hook types, key by key
    swell(3.6, .1, 40, 40, 'trem'); trem(3.6, ['C3', 'C4'], 1.4, 30, 96, 'trem', 14); swell(3.6, 1.4, 40, 127, 'trem')
    trem(4.2, ['F2'], .8, 36, 104, 'timp', 16)
    hit(5.0, 122); chord(5.0, ['F3', 'C4', 'F4', 'A4', 'C5'], 1.3, 112, 'brass'); chord(5.0, ['F2', 'F3', 'C4', 'A4', 'F5'], 1.35, 110, 'sing')   # THE HOOK
    seq(5.0, fanfare_head(), .1, 116, 'fanfare', dur=.1, legato=.85); note(5.3, top_note(), .95, 120, 'fanfare')
    chord(5.3, ['F4', 'A4', 'C5'], .95, 104, 'horn'); note(5.62, 'F2', .3, 96, 'timp'); note(5.82, 'F2', .3, 100, 'timp')
    seq(6.0, scale('A5', 'C6'), .1, 108, 'fanfare', dur=.1); chord(6.3, ['F4', 'A4', 'C5', 'F5'], .7, 110, 'brass')
    run(6.32, 'F6', 'F4', .78, 88, 'sing'); run(6.34, 'C7', 'C5', .8, 70, 'pluck'); swell(6.3, .9, 110, 55, 'brass')   # back out to morning
    note(7.25, 'C6', .12, 104, 'stab'); chord(7.25, ['F4', 'A4', 'C5'], .14, 100, 'fanfare'); chord(7.25, ['F3', 'C4'], .2, 90, 'pizz')   # awake!
    gliss(7.8, 'C4', 'C5', .32, 58, 'pad'); line(7.85, [('G4', .6), ('C5', 1.1)], .4, 70, 'reply')   # the yawn: up with the arms…
    seq(8.36, ['B4', 'Bb4', 'A4', 'Ab4', 'G4'], .07, 64, 'reply', legato=1.1)                        # …and a sigh down

def cue_request(b):
    S, a = b['S'], b['at']; L, G = a['land'], a['grab']
    if b.get('first'):   # the morning: the lead has the whole theme while the first request glides in
        bt = (b['end'] - S) / max(1, beats(THEME) + beats(ANSWER)); bars = max(1, round((b['end'] - S) / (bt * 4)))
        walking_pizz(S, bars, bt, 56); pad(S, [PROG[i % 4] for i in range(bars)], bt * 4, 44)
        x = line(S, THEME, bt, 78, 'lead'); line(x, ANSWER, bt, 76, 'lead')
        for j in range(bars): c = PROG[j % 4]; arp(S + j * bt * 4, [k(n) + 12 for n in c] + [k(c[1]) + 24], bt / 2, 48, 'pluck', 1.0)
    elif b.get('flight') == 'loop':
        seq(a['loop'][0], ['F5', 'A5', 'C6', 'F6', 'A6', 'F6', 'C6', 'A5', 'F5', 'C5'], .06, 72, 'lead')   # the loop-the-loop
    else:
        pad(S, [PROG[0], PROG[3]], (L - S) / 2, 42); line(S + .1, ANSWER, (L - S - .1) / max(1, beats(ANSWER)), 62, 'lead')
    seq(L - .02, ['F5', 'G5'] * 4, .04, 60, 'lead', legato=.9); note(L, 'F3', .2, 74, 'pizz')   # touchdown: a flutter and a pluck
    note(G, 'C5', .5, 60, 'pluck')                                                             # the grab
    arp(a['unfold'][0], scale('F4', 'A6')[::2], .06, 62, 'pluck', 1.2)                         # the unfold
    line(a['unfold'][1] + .05, [('A4', .5), ('C5', .5), ('D5', .75), ('C5', .5)], sb(.42), 62, 'read')   # reading
    r = a['react']
    if b.get('react') == 'excited':
        seq(r, fanfare_head(), .09, 112, 'fanfare', dur=.09); note(r + .27, top_note(), .6, 118, 'fanfare'); hit(r + .27, 108, big=False); chord(r + .27, ['F3', 'C4', 'A4'], .6, 100, 'horn')
    else:   # the idea
        chord(r, ['C6', 'E6', 'G6'], .8, 92, 'bell'); arp(r, ['C6', 'G6', 'C7'], .05, 70, 'sparkle'); chord(r, ['C3', 'G3', 'E4', 'C5'], 1.2, 70, 'sing')

def cue_work(b):
    S, done = b['S'], b['at']['done']
    if b['size'] == 'short':   # the fix: a determined ostinato
        for i in range(int((b['end'] - S) / .125)): chord(S + i * .125, ['D4', 'A4'] if i % 4 < 2 else ['F4', 'C5'], .08, 70 + i * 2, 'sing')
        line(S + .05, [('D4', .5), ('F4', .5), ('A4', 1.0)], sb(.42), 70, 'horn')
    elif b['size'] == 'normal':   # building: pizzicato sixteenths climbing, bassoon underneath, a quick climb to the result
        s16 = (done - S) / 16
        for j in range(16):
            base = ['F4', 'A4', 'C5', 'A4'] if j < 8 else ['G4', 'Bb4', 'D5', 'Bb4']
            note(S + j * s16, k(base[j % 4]) + (2 if j >= 12 else 0), s16 * .6, 64 + j, 'pizz')
        seq(S, ['F2', None, 'C3', None] * 4, s16 * 2, 70, 'reed', legato=.5)
        for i in range(8): note(S + i * s16 * 2, 38, .1, 34 + i * 4, 'drums')
        hit(done, 104, big=False); chord(done, ['F3', 'A3', 'C4', 'F4'], 1.4, 100, 'horn'); chord(done, ['F3', 'C4', 'A4', 'F5'], 1.5, 92, 'sing'); note(done, 'F6', 1.4, 80, 'bell')
    else:   # the long build: driving strings climbing a step a bar, horns broad on the theme, the hook's fanfare returns
        for bar, (off, root) in enumerate([(0, 'F'), (1.0, 'G'), (2.0, 'A'), (3.0, 'Bb')]):
            r = k(root + '4'); th = triad_third(r); pat = [0, th, 7, 12, 7, th, 0, th]
            for i in range(10): note(S + .05 + off + i * .1, r + pat[i % 8], .07, 70 + bar * 8 + i, 'sing')
            note(S + .05 + off, root + '2', .9, 90 + bar * 6, 'timp'); chord(S + .05 + off, [root + '2', root + '3'], .9, 74 + bar * 6, 'cello')
            for q in range(4): note(S + .05 + off + q * .25, 38, .08, 40 + bar * 12 + q * 3, 'drums')
        swell(S, .1, 70, 70, 'sing'); swell(S, 4.0, 70, 127, 'sing')
        h1, h2 = halves(THEME)
        line(S + .05, up(h1, -1), 2.0 / max(.5, beats(h1)), 88, 'horn'); line(S + 2.05, up(h2, -1), 1.9 / max(.5, beats(h2)), 96, 'horn')
        trem(done - .55, ['C2'], .55, 60, 118, 'timp', 20); gliss(done - .35, 'C5', 'C6', .33, 90, 'sing')
        hit(done, 124); chord(done, ['F3', 'C4', 'F4', 'A4', 'C5'], 1.4, 116, 'brass'); seq(done, fanfare_head(), .1, 118, 'fanfare', dur=.1)
        note(done + .3, top_note(), 1.1, 122, 'fanfare'); chord(done, ['F2', 'F3', 'C4', 'A4', 'F5'], 1.5, 112, 'sing'); run(done + .01, 'F4', 'F6', .3, 70, 'pluck')

def cue_reply(b):
    S, a = b['S'], b['at']; t0 = S + .1; typ, fold, wind, rel = a['type'], a['fold'], a['windup'], a['rel']
    soft = .85 if b.get('night') else 1.0
    swell(t0 - .05, .05, 96, 96, 'pad'); pad(t0, [PROG[2], PROG[0], PROG[3], PROG[0]], 1.0, int(58 * soft))
    line(t0 + .5, head(THEME, 2.75), sb(.5), int(74 * soft), 'reply')                        # the reply voice sings as it writes
    for i in range(int((typ[1] - typ[0]) / .16)): note(typ[0] + i * .16, ['C5', 'E5', 'F5', 'A5'][i % 4], .08, 46, 'pizz')   # typing
    arp(typ[1] + .15, ['F5', 'A5', 'C6', 'F6', 'C6', 'A5'], .11, int(50 * soft), 'pluck', .9)   # reading back what was written
    for f, n in zip((.16, .28, .53, .8), ('C5', 'E5', 'G5', 'C6')): note(fold[0] + (fold[1] - fold[0]) * f, n, .8, 74, 'pluck')   # each crease
    gliss(wind, 'C4', 'C5', rel - wind - .02, 64, 'sing'); swell(wind, rel - wind, 70, 120, 'sing')   # the wind-up
    run(rel, 'F5', 'F6', .22, 88, 'lead'); seq(rel + .25, ['F6', 'G6'] * 5, .045, 70, 'lead', legato=.9); note(rel, 81, .6, 60, 'drums')   # away it flies
    swell(rel + .3, .1, 90, 90, 'sing')
    if b.get('night'): arp(t0 + .4, ['F6', 'C6', 'A5', 'C6'], .25, 44, 'sparkle', .5)

def cue_correction(b):
    S, a = b['S'], b['at']; hang, swing, hit_t, show = a['hang'], a['swing'], a['hit'], a['show']
    swell(S - .05, .1, 70, 70, 'trem'); trem(S, ['C2', 'F#2'], hang - S + .05, 46, 76, 'trem', 12)   # something looms
    note(S, 'F1', .3, 90, 'bass'); note(S + .3, 'F#1', .3, 94, 'bass')
    trem(hang, ['C2', 'F#2'], swing - hang, 70, 84, 'trem', 12); trem(hang, ['F2'], swing - hang + .13, 50, 110, 'timp', 20)   # the held breath
    gliss(swing, 'C4', 'F3', hit_t - swing, 110, 'low')                                                             # the swing
    hit(hit_t, 127); chord(hit_t, ['F2', 'Gb2', 'C3', 'Db3'], .5, 120, 'brass'); chord(hit_t, ['F2', 'C3', 'F3'], .25, 118, 'sing')   # BONK
    arp(hit_t + .29, ['E6', 'G6', 'C7', 'G6', 'E6', 'G6', 'C7', 'G6', 'E6', 'G6'], .085, 62, 'sparkle', .2)             # stars go round
    seq(hit_t + .34, ['F5', 'F#5'] * 7, .06, 56, 'reply', legato=1.0)
    chord(hit_t + .64, ['D4', 'F4', 'Ab4'], .6, 50, 'pad')
    line(show + .02, [('Bb3', .45), ('A3', .45), ('Ab3', .45), ('G3', 1.4)], .5, 114, 'low')                        # the verdict: womp, womp
    chord(show + .02, ['Bb2', 'D3', 'F3'], 1.2, 56, 'pad'); note(a['jabs'][0], 'F2', .2, 80, 'timp'); note(a['jabs'][1], 'F2', .2, 84, 'timp')
    gliss(a['exit'], 'G4', 'G5', .4, 70, 'sing'); run(a['exit'] + .05, 'C5', 'C7', .35, 60, 'pluck')                  # yanked out of frame

def cue_praise(b):
    S, a = b['S'], b['at']; land, love = a['land'], a['love']; fly = land - S
    for i in range(max(1, int(fly / .33))): arp(S + i * .33, ['F5', 'A5', 'C6', 'E6', 'G6'][i % 2:] + ['A6'], .055, 52, 'sparkle', .6)   # wings
    swell(S, .1, 60, 60, 'pad'); chord(S, ['A5', 'C6', 'F6'], fly, 40, 'pad'); run(S + .1, 'F4', 'C6', .5, 48, 'pluck')
    run(land, 'C7', 'F5', .35, 58, 'pluck'); note(land, 'C7', .9, 70, 'bell')                                    # it lands
    if b.get('finale'):   # the last praise: the whole orchestra has the theme
        fin = THEME[:-1] + [(THEME[-1][0], 1.0)]; bt = min(sb(.5), 2.6 / max(1, beats(fin)))
        line(love, fin, bt, 96, 'sing'); line(love, fin, bt, 72, 'horn')
        line(love, [('F3', 1), ('D3', 1), ('Bb2', 1), ('C3', 1)], .62, 72, 'cello'); pad(love, PROG, .62, 58)
        note(love, 49, 2.5, 70, 'drums'); swell(love, .1, 80, 80, 'sing')
    else:                 # the strings open up with the theme
        bt = min(sb(.52), 2.4 / max(1, beats(THEME)))
        swell(love - .05, .05, 80, 80, 'sing'); swell(love, 1.0, 80, 127, 'sing')
        line(love, THEME, bt, 98, 'sing'); pad(love, [PROG[0], PROG[1]], 1.1, 72); line(love, [('A3', 1), ('F3', 1), ('D3', 1)], .7, 80, 'cello')
        line(love, head(THEME, 2.5), bt, 60, 'horn')

def cue_outro(b):
    S, end, a = b['S'], b['end'], b['at']; close = a['close']
    if b.get('ending') == 'sleep':   # back to sleep: the yawn, then the music box plays the theme again, as at the start
        gliss(a['yawn'], 'C4', 'C5', .32, 66, 'sing'); line(a['yawn'] + .05, [('G4', .6), ('C5', 1.1)], .3, 70, 'reply')
        seq(a['yawn'] + .45, ['B4', 'Bb4', 'A4', 'Ab4', 'G4'], .08, 66, 'reply', legato=1.1)
        line(a['sleep'], up(head(THEME, 3)), sb(.42), 46, 'sparkle'); note(a['sleep'] + .2, 'F2', 1.1, 34, 'reed')
    else:
        wink = a['wink']
        line(S + .05, [('C6', .5), ('D6', .5), ('E6', .5), ('G6', 1)], sb(.22), 64, 'lead')  # the next request: a question
        note(wink, 'C4', .2, 80, 'pizz'); note(wink, 'C7', .4, 74, 'bell')                  # the wink
    chord(close, ['F3', 'C4', 'A4', 'C5', 'F5'], end - close, 60, 'pad'); arp(close, scale('F4', 'F6')[::2], .09, 54, 'pluck', 1.6)
    note(close + .3, 'F6', 1.4, 58, 'sparkle'); swell(close, end - close, 90, 30, 'pad')
    note(end - .3, 'F2', .3, 78, 'pizz'); note(end - .3, 'F6', .8, 64, 'bell')           # the button, on the shut

DEFAULT = dict(open=cue_open, request=cue_request, work=cue_work, reply=cue_reply, correction=cue_correction, praise=cue_praise, outro=cue_outro)

# ---------- MIDI: one standard file for any General MIDI synth (channels reassigned as instruments come and go) ----------
def write_midi(events, path, ppq=480):
    tps = ppq * 2   # 120 bpm: 960 ticks a second
    tick = lambda t: int(round(t * tps))
    chans, msgs = {c: {'p': None, 'busy': -1.0} for c in range(16) if c != 9}, []
    first = {}
    for e in events:
        if e['p'] not in first: first[e['p']] = e
    def chan(p, t, until):
        if p < 0: return 9
        for c, st in chans.items():
            if st['p'] == p: st['busy'] = max(st['busy'], until); return c
        free = [c for c, st in chans.items() if st['busy'] < t]
        c = min(free or chans, key=lambda c: chans[c]['busy'])
        chans[c] = {'p': p, 'busy': until}
        g, pan = first[p].get('gain', .7), first[p].get('pan', 0)
        msgs.extend([(tick(t), 0, bytes([0xC0 | c, p])), (tick(t), 0, bytes([0xB0 | c, 7, int(100 * g)])), (tick(t), 0, bytes([0xB0 | c, 10, int(64 + 63 * pan)]))])
        return c
    for e in sorted(events, key=lambda e: e['t']):
        if 'cc' in e: c = chan(e['p'], e['t'], e['t']); msgs.append((tick(e['t']), 1, bytes([0xB0 | c, e['cc'], e['val']]))); continue
        c = chan(e['p'], e['t'], e['t'] + e['d'] + 1.0)
        msgs.append((tick(e['t']), 3, bytes([0x90 | c, e['n'], e['v']]))); msgs.append((tick(e['t'] + e['d']), 2, bytes([0x80 | c, e['n'], 0])))
    msgs.sort(key=lambda m: (m[0], m[1]))
    def vlq(n):
        out = [n & 0x7F]; n >>= 7
        while n: out.insert(0, (n & 0x7F) | 0x80); n >>= 7
        return bytes(out)
    body, last = bytearray(b'\x00\xff\x51\x03\x07\xa1\x20'), 0   # tempo: 500000 µs a beat
    for tk, _, data in msgs: body += vlq(tk - last) + data; last = tk
    body += b'\x00\xff\x2f\x00'
    with open(path, 'wb') as f: f.write(b'MThd' + struct.pack('>IHHH', 6, 0, 1, ppq) + b'MTrk' + struct.pack('>I', len(body)) + body)

def build(cues=None, timeline='timeline.json', out='events.json', midi='score.mid'):
    if not THEME: raise SystemExit('score.py: call theme([...]) with your own theme before build()')
    T = json.load(open(timeline)); cues = {**DEFAULT, **(cues or {})}
    praises = [i for i, b in enumerate(T['blocks']) if b['type'] == 'praise']
    for i, b in enumerate(T['blocks']):
        b['finale'] = bool(praises) and i == praises[-1] and i == len(T['blocks']) - 2
        cues[b['type']](b)
    D = T['duration']
    ev = sorted([e for e in E if e['t'] < D], key=lambda e: e['t'])
    seen = set()
    for e in ev:
        if e['p'] not in seen: seen.add(e['p']); e['gain'], e['pan'] = MIX.get(e['role'], (.7, 0))
    for e in ev: e.pop('role', None)
    json.dump(ev, open(out, 'w'))
    write_midi(ev, midi)
    roles = sorted({r for r in PALETTE if any(program(PALETTE[r]) == e['p'] for e in ev)})
    print(f"{len(ev)} events, {len(seen)} instruments, {D:.2f} s → {out}, {midi}")
    print('palette:', ', '.join(f'{r}={PALETTE[r]}' for r in roles))
