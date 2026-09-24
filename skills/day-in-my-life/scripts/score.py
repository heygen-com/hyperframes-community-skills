#!/usr/bin/env python3
"""Compose and render the string score for a day-in-my-life film, on the film's own clock.

    python3 scripts/score.py <film-dir>                  compose + synthesize + master
    python3 scripts/score.py <film-dir> --master-only    master an externally rendered music/strings.wav

Reads <film-dir>/story.json (the chapter list) and <film-dir>/archetypes.json (bars + event times per chapter type,
the same table scenes.js draws from). Writes, inside <film-dir>/music/ only:
    strings.mid       the composition (5 tracks: vln1 vln2 vla vc cb); re-voice it with any sampled library
    strings.wav       the synthesized performance (48 kHz stereo float)
    strings-mix.wav   mastered with ffmpeg (light compression, -17 LUFS integrated, -1.5 dBTP)
    keys.wav          a key click per keystroke of the typed command (intro + tag)

The score: 96 BPM, 4/4, D major. The theme is the typed command (c l a u d e = D E F# A B A), foreshadowed in
harmonics under the title, plucked one note per keystroke, sung on the shelf, canon'd side by side, blown up tutti in
the good part, plucked again the next morning. Each chapter type has a recipe (below) that writes two bars in local
beats and puts its hits on that chapter's events, so a story in any order stays in sync and in key.
The performance is synthesized here: additive bowed strings (body formants, vibrato, bow noise, ensemble detune),
Karplus-Strong pizzicato, and a band-split synthetic hall. No network, no credentials. Needs numpy, scipy, ffmpeg.
"""
import json, os, struct, subprocess, sys, re
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt
from scipy.io import wavfile

FS = 48000
rng = np.random.default_rng(7)
NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
def m(s):
    """'F#5' -> MIDI number (sharps only; the score stays in D major)."""
    if not isinstance(s, str): return s
    name, octv = (s[:2], s[2:]) if len(s) > 2 and s[1] == '#' else (s[:1], s[1:])
    return 12 * (int(octv) + 1) + NAMES.index(name)
hz = lambda n: 440 * 2 ** ((n - 69) / 12)
THEME = ['D', 'E', 'F#', 'A', 'B', 'A']   # c l a u d e

class Score:
    def __init__(self, bpm): self.beat = 60 / bpm; self.notes = []
    def at(self, b0):   # a writer for one chapter: beats are local to the chapter
        def n(part, b, d, pitch, vel=.6, art='leg', **o):
            self.notes.append((part, (b0 + b) * self.beat, d * self.beat, m(pitch), vel, art, o))
        def chord(pp, b, d, vel=.6, art='leg', **o):
            for part, p in pp: n(part, b, d, p, vel, art, **o)
        return n, chord

# ------------------------------------------------------------------------------------------------ chapter recipes
# Each recipe(n, chord, E, B, C): n/chord write notes in local beats; E = events (s); B(t) = seconds → local beats;
# C = the chapter's story data. Two bars (8 beats) unless the type is longer.

def r_intro(n, chord, E, B, C, keys):
    chord([('vla', 'A3'), ('vc', 'D3')], 0, B(E['tilt'][1]), .28, 'leg', v1=.34)             # open fifth under the title
    for i, p in enumerate(['D6', 'E6', 'F#6', 'A6']):                                         # theme head in harmonics
        n('vln1', .5 + i, (B(E['tilt'][0]) - 3.5) if i == 3 else 1.1, p, .3, 'harm')
    for i, p in enumerate(['A3', 'G3', 'F#3', 'E3']):                                         # walks down with the tilt
        n('vc', B(E['tilt'][0]) + i * .5, .55, p, .36, 'leg')
    chord([('vc', 'D3'), ('vla', 'F#3'), ('vln2', 'A4'), ('cb', 'D2')], B(E['tilt'][1]), B(E['enter']) - B(E['tilt'][1]), .3, 'leg')
    for t, p in zip(keys, THEME): n('vln1', B(t), 1, p + '5', .78, 'pizz')                   # the command, plucked
    eb = B(E['enter'])
    chord([('cb', 'D2'), ('vc', 'D3'), ('vla', 'A3'), ('vln2', 'F#4'), ('vln1', 'D5')], eb, 1.5, .9, 'pizz')
    chord([('cb', 'A1'), ('vc', 'A2'), ('vla', 'G3'), ('vln2', 'C#4'), ('vln1', 'E4')], eb + 1, 16 - eb - 1, .22, 'trem', v1=.85)
    n('vln1', eb + 2, 16 - eb - 2, 'A4', .25, 'trem', v1=.8)                                  # swell into the ink

def r_shelf(n, chord, E, B, C, keys):
    for p, b, d in zip(['D5', 'E5', 'F#5', 'A5', 'B5', 'A5'], [0, 1, 2, 3, 4, 6], [1, 1, 1, 1, 2, 2]): n('vln1', b, d, p, .55)
    for b0, ps in {0: 'A4 D5 F#4 D5', 2: 'A4 D5 F#4 D5', 4: 'B4 D5 F#4 D5', 6: 'G4 B4 D4 B4'}.items():
        for j, p in enumerate(ps.split()): n('vln2', b0 + j * .5, .5, p, .42, 'pizz')
    n('vla', 0, 4, 'A3', .3); n('vla', 4, 2, 'B3', .3); n('vla', 6, 2, 'B3', .3)
    for j, p in enumerate('D3 A2 D3 F#3 B2 F#3 G2 D3'.split()): n('vc', j, 1, p, .5, 'pizz')
    n('cb', 0, 4, 'D2', .32); n('cb', 4, 2, 'B1', .32); n('cb', 6, 2, 'G1', .32)

def r_first(n, chord, E, B, C, keys):
    for j, p in enumerate('G5 F#5 E5 D5'.split()): n('vln1', j, .45, p, .5, 'spic')
    hb, sb = B(E['hop']), B(E['sticky'])
    n('vln1', hb, .5, 'A5', .55); n('vln1', hb + .5, 1, 'F#5', .42)                           # the sigh on the hop
    chord([('vln2', 'D5'), ('vla', 'F#4')], sb, .5, .8, 'pizz')                               # the receipt slaps on
    n('vln1', 6, 1, 'E5', .48); n('vln1', 7, 1, 'C#5', .45)
    for b0, ps in {0: 'G4 B4 D5 B4', 2: 'A4 C#5 E5 C#5', 4: 'F#4 A4 D5 A4', 6: 'G4 B4 A4 C#5'}.items():
        for j, p in enumerate(ps.split()):
            if abs(b0 + j * .5 - sb) > 1e-6: n('vln2', b0 + j * .5, .5, p, .4, 'pizz')
    for j, p in enumerate('G2 D3 A2 E3 F#2 A2 G2 A2'.split()): n('vc', j, 1, p, .48, 'pizz')
    for b, d, p in [(0, 2, 'G1'), (2, 2, 'A1'), (4, 2, 'F#1'), (6, 1, 'G1'), (7, 1, 'A1')]: n('cb', b, d, p, .3)

def r_watching(n, chord, E, B, C, keys):
    mb, sord = B(E['mute']), C.get('muted', True) is not False
    for j, p in enumerate('B4 D5 F#5 D5'.split()): n('vln2', j * .5, .5, p, .42, 'pizz')
    n('vln1', 0, mb, 'B5', .45); n('vc', 0, mb, 'B2', .4); n('vla', 0, mb, 'D4', .35)
    for i, p in enumerate('D5 E5 F#5 A5'.split()): n('vln1', mb + i, 1, p, .42, sord=sord)      # con sordino from the hit
    n('vln1', mb + 4, 8 - mb - 4, 'B5', .4, sord=sord)
    for k, ps in enumerate(['G4 B4 D5 B4', 'F#4 A4 D5 A4', 'E4 A4 C#5 A4']):
        for j, p in enumerate(ps.split()): n('vln2', mb + k * 2 + j * .5, .5, p, .34, 'pizz', sord=sord)
    for k, (va, vc) in enumerate([('B3', 'G2'), ('A3', 'D3'), ('G3', 'A2')]):
        n('vla', mb + k * 2, 2, va, .3, sord=sord); n('vc', mb + k * 2, 2, vc, .34, sord=sord)

def r_frames(n, chord, E, B, C, keys):
    p0, p1 = B(E['pause'][0]), B(E['pause'][1])
    for k in range(32):                                                                       # ticking sixteenths
        b = k * .25
        if p0 <= b < p1: continue                                                             # the held breath on the find
        n('vln2', b, .2, 'A4', .34 + (.1 if k % 4 == 0 else 0), 'stac')
    chord([('vln1', 'D6'), ('vla', 'F#4')], B(E['tape']), .5, .75, 'pizz')                    # the tape slaps on
    for j, p in enumerate('D4 C#4 B3 A3'.split()): n('vla', B(E['walk'][0]) + j * .5, .55, p, .38)    # walks left
    for j, p in enumerate('G3 F#3 E3 D3'.split()): n('vla', B(E['walk2'][0]) + j * .5, .55, p, .38)
    n('vln1', 0, 2, 'A5', .3, 'harm'); n('vln1', 6, 2, 'F#5', .3, 'harm')
    for b, p in [(0, 'A2'), (2, 'D3'), (p1, 'A2'), (6, 'D3')]: n('vc', b, 1, p, .45, 'pizz')
    n('cb', 0, 4, 'A1', .3); n('cb', 4, 4, 'D2', .3)

def r_building(n, chord, E, B, C, keys):
    for i, (p, b, d) in enumerate([('D6', 0, 1), ('E6', 1, 1), ('F#6', 2, 1), ('A6', 3, 1), ('B6', 4, 2), ('A6', 6, 2)]):
        n('vln1', b, d, p, .5 + i * .04)
    for b0, (v2, va, vc) in {0: ('F#4', 'D4', 'D3'), 2: ('E4', 'C#4', 'C#3'), 4: ('F#4', 'D4', 'B2'), 6: ('D4', 'B3', 'G2')}.items():
        for j in range(4):
            vel = .42 + b0 * .02
            n('vln2', b0 + j * .5, .45, v2 if j % 2 == 0 else 'A4', vel, 'spic')
            n('vla', b0 + j * .5, .45, va, vel - .04, 'spic')
            n('vc', b0 + j * .5, .45, m(vc) - (12 if j == 2 else 0), vel + .04, 'spic')
    for b, p, v in [(0, 'D2', .42), (2, 'C#2', .44), (4, 'B1', .46), (6, 'G1', .48)]: n('cb', b, 2, p, v)
    for t in E['pages']: n('vla', B(t), .5, 'D5', .55, 'pizz')                                  # pages fly off the table

def r_restart(n, chord, E, B, C, keys):
    ob, onb = B(E['off']), B(E['on'])
    for j in range(int(ob * 2)):
        n('vln2', j * .5, .45, 'F#4', .44, 'spic'); n('vla', j * .5, .45, 'D4', .4, 'spic'); n('vc', j * .5, .45, 'D3', .48, 'spic')
    n('vln1', 0, ob, 'A5', .45, cut=True)                                                     # everything stops at power-off
    n('vln1', ob, onb - ob, 'A6', .26, 'harm')                                                # one harmonic hangs
    for t in E['dots']: n('vln2', B(t), .5, 'A4', .32, 'pizz')                                # counting in the dark
    for i, p in enumerate('D5 E5 F#5 G5 A5 B5 C#6 D6'.split()): n('vln1', onb + i * .25, .3, p, .4 + i * .04)   # the run back
    n('vc', onb, 8 - onb, 'A2', .3, 'trem', v1=.6); n('cb', onb, 8 - onb, 'A1', .28, v1=.5)

def r_knock(n, chord, E, B, C, keys):
    n('vln1', 0, .5, 'D6', .55, 'spic')
    for t in E['knocks']: n('vc', B(t), .5, 'G2', .75, 'pizz')                                # knock, knock
    chord([('vla', 'B3'), ('vln2', 'D4')], B(E['knocks'][-1]) + .5, 3, .32); n('cb', 0, 4, 'G1', .3)   # the door opens
    bb, hb, sb = B(E['bubble']), B(E['hop']), B(E['show'])
    n('vln1', bb, .5, 'A5', .5); n('vln1', bb + .5, 1.5, 'B5', .5)                            # the check-in, a rising question
    for j, p in enumerate('A4 G4 F#4 E4'.split()): n('vla', hb + j * .5, .55, p, .48)         # the answer
    n('vla', hb + 2, 2, 'D4', .45)
    for j, p in enumerate('D4 F#4 A4 D5'.split()): n('vln2', sb + j * .25, .25, p, .5, 'pizz')   # holds up the page
    chord([('vc', 'A2'), ('vln2', 'C#5')], 4, 2, .34); chord([('vc', 'D3'), ('vln2', 'D5'), ('vln1', 'F#5')], 6, 2, .36)
    n('cb', 4, 2, 'A1', .3); n('cb', 6, 2, 'D2', .32)

def r_notes(n, chord, E, B, C, keys):
    for b0, (v2, va) in {0: ('D5', 'F#4'), 2: ('C#5', 'F#4'), 4: ('D5', 'G4'), 6: ('C#5', 'E4')}.items():
        n('vln2', b0, 2, v2, .32, 'trem'); n('vla', b0, 2, va, .3, 'trem')
    hits = [('F#5', 'B2'), ('C#6', 'F#2'), ('A5', 'F#2'), ('B5', 'G2'), ('D6', 'G2')]
    for t, (a, c) in zip(E['pins'][:len(C.get('notes', [])) or 5], hits):                    # a hit per pinned note
        n('vln1', B(t), .3, a, .75, 'stac'); n('vc', B(t), .3, c, .7, 'stac')
    n('vln1', B(E['cross'][0]), .3, 'E5', .6, 'scratch'); n('vla', B(E['cross'][1]), .3, 'C#4', .6, 'scratch')
    for t, p in zip(E['balls'], ['A5', 'F#5', 'D5']): n('vln2', B(t), .5, p, .45, 'pizz')    # paper balls
    for b, p in [(0, 'B2'), (2, 'F#2'), (4, 'G2'), (6, 'A2')]: n('vc', b, 1, p, .5, 'pizz')
    for b, p, v in [(0, 'B1', .32), (2, 'F#1', .32), (4, 'G1', .32), (6, 'A1', .34)]: n('cb', b, 2, p, v)

def r_side(n, chord, E, B, C, keys):
    snap = B(E['snap'])
    for i, p in enumerate('D5 E5 F#5 A5 B5'.split()):                                         # canon, an eighth apart
        if i < snap: n('vln1', i, 1, p, .5)
        if i + .5 < snap: n('vln2', i + .5, min(1, snap - i - .5), p, .44)
    n('vln1', snap, 8 - snap, 'A5', .5, v1=.85); n('vln2', snap, 8 - snap, 'A5', .5, v1=.85)   # locked in unison
    for b0, (va, vc, cb) in {0: ('F#4', 'D3', 'D2'), 2: ('G4', 'E3', 'E2'), 4: ('F#4', 'F#3', 'F#2')}.items():
        d = min(2, snap - b0)
        if d > 0: n('vla', b0, d, va, .34); n('vc', b0, d, vc, .36); n('cb', b0, d, cb, .3)
    chord([('vla', 'E4'), ('vc', 'A2'), ('cb', 'A1')], snap, 8 - snap, .34, 'trem', v1=.9)    # swell into the ink

def r_good(n, chord, E, B, C, keys):
    br, tb = B(E['breath'][0]), B(E['tutti'])
    chord([('vla', 'A3'), ('vc', 'D3')], 0, br, .26)
    chord([('vln2', 'E5'), ('vla', 'G4'), ('vc', 'A2'), ('cb', 'A1')], br, tb - br, .24, v1=.7)   # the held breath
    for i, p in enumerate('A4 B4 C#5 D5 E5 F#5 G5 A5'.split()): n('vln1', tb - 1 + i * .125, .15, p, .45 + i * .04)
    for i, p in enumerate('D6 E6 F#6 A6'.split()): n('vln1', tb + i, 1, p, .92)              # everyone
    for i, p in enumerate('D5 E5 F#5 A5'.split()): n('vln2', tb + i, 1, p, .85)
    for i, (va, vc, cb) in enumerate([('F#4', 'D3', 'D2'), ('E4', 'C#3', 'C#2'), ('D4', 'B2', 'B1'), ('C#4', 'A2', 'A1')]):
        n('vla', tb + i, 1, va, .82); n('vc', tb + i, 1, vc, .85); n('cb', tb + i, 1, cb, .7)

def r_kept(n, chord, E, B, C, keys):
    fb, lb = B(E['fly'][0]), B(E['land'])
    chord([('vc', 'D3'), ('vla', 'A3'), ('vln2', 'F#4'), ('vln1', 'D5')], 0, fb, .36)          # a quiet chorale
    for i, p in enumerate('D5 F#5 A5 D6'.split()): n('vln1', fb + i * .5, .6 if i < 3 else 1.2, p, .34)   # the book flies
    chord([('vc', 'B2'), ('vla', 'G3'), ('vln2', 'D4')], 2, 2, .32)
    chord([('vln2', 'B4'), ('vla', 'G4')], lb, .5, .45, 'pizz')                               # it lands in its gap
    chord([('vc', 'E3'), ('vla', 'G3'), ('vln2', 'B4'), ('vln1', 'D5')], 4, 2, .32)
    chord([('vc', 'A2'), ('vla', 'G3'), ('vln2', 'C#5'), ('vln1', 'E5')], 6, 1, .32)
    chord([('vc', 'D3'), ('vla', 'A3'), ('vln2', 'F#4'), ('vln1', 'D5'), ('cb', 'D2')], 7, 3, .3)   # cut by the lamp
    for b, d, p in [(0, 2, 'D2'), (2, 2, 'B1'), (4, 2, 'E2'), (6, 1, 'A1')]: n('cb', b, d, p, .28)

def r_tag(n, chord, E, B, C, keys):
    for t, p in zip(keys, THEME): n('vln1', B(t), 1, p + '5', .6, 'pizz')                     # the command, plucked again
    eb = B(E['enter'])
    chord([('vc', 'D3'), ('vla', 'A4'), ('vln1', 'D6')], eb, 8 - eb + 1, .26, 'harm')
    n('vln2', eb, 8 - eb + 1, 'F#5', .2, 'harm')

def r_terminal(n, chord, E, B, C, keys):
    red = bool(C.get('fail') and C.get('pass'))
    for j in range(int(B(E['enter']) * 2)): n('vln2', j * .5, .45, ['A4', 'D5', 'F#4', 'D5'][j % 4], .38, 'pizz')   # typing
    n('vc', 0, B(E['enter']), 'D3', .3); n('cb', 0, B(E['enter']), 'D2', .26)
    eb = B(E['enter']); chord([('vla', 'A3'), ('vc', 'A2')], eb, .5, .6, 'pizz')                            # Enter
    for k in range(4): n('vln1', eb + .25 + k * .25, .2, ['A5', 'B5', 'C#6', 'D6'][k], .36, 'stac')        # output scrolls
    if red:
        fb, xb, rb, pb = B(E['fail']), B(E['fix']), B(E['rerun']), B(E['pass'])
        chord([('vln1', 'G5'), ('vln2', 'E5'), ('vla', 'C#4'), ('vc', 'A2')], fb, xb - fb, .72, 'stac')    # it fails: a sour stab
        chord([('vln2', 'E5'), ('vla', 'C#4')], fb, rb - fb, .3, 'trem', v1=.45); n('cb', fb, rb - fb, 'A1', .3)
        for j, p in enumerate('A4 B4 C#5 D5'.split()): n('vla', xb + j * .25, .25, p, .45, 'spic')           # the fix
        chord([('vla', 'A3'), ('vc', 'A2')], rb, .5, .6, 'pizz')                                          # run it again
        chord([('cb', 'D2'), ('vc', 'D3'), ('vla', 'A3'), ('vln2', 'F#4'), ('vln1', 'D5')], pb, .5, .85, 'pizz')   # green
        n('vln1', pb, 8 - pb, 'A5', .5, v1=.6); n('vln2', pb, 8 - pb, 'F#5', .4); n('vc', pb, 8 - pb, 'D3', .36)
    else:
        db = B(E['fail'])
        chord([('cb', 'D2'), ('vc', 'D3'), ('vla', 'A3'), ('vln2', 'F#4'), ('vln1', 'D5')], db, .5, .7, 'pizz')   # done
        n('vln1', db, 8 - db, 'A5', .44); n('vln2', db, 8 - db, 'F#5', .36); n('vc', db, 8 - db, 'D3', .34); n('cb', db, 8 - db, 'D2', .28)

def r_diff(n, chord, E, B, C, keys):
    for b0, (v2, va, vc) in {0: ('F#4', 'D4', 'D3'), 2: ('G4', 'D4', 'B2'), 4: ('E4', 'C#4', 'A2'), 6: ('F#4', 'D4', 'D3')}.items():
        for j in range(4):
            n('vln2', b0 + j * .5, .42, v2 if j % 2 == 0 else 'A4', .36, 'spic'); n('vc', b0 + j * .5, .42, vc, .4, 'spic')
        n('vla', b0, 2, va, .3)
    for t in E['strike']: n('vln1', B(t), .3, 'D5', .55, 'scratch')                                      # lines struck out
    w0, w1 = B(E['write'][0]), B(E['write'][1])
    for i, p in enumerate('D5 E5 F#5 A5 B5 A5'.split()): n('vln1', w0 + i * (w1 - w0) / 6, (w1 - w0) / 6, p, .5)   # new lines, the theme
    chord([('vln2', 'A4'), ('vla', 'F#4'), ('vc', 'D3')], B(E['stamp']), .5, .75, 'pizz')                   # stamped
    n('cb', 0, 4, 'D2', .28); n('cb', 4, 2, 'A1', .28); n('cb', 6, 2, 'D2', .28)

def r_ship(n, chord, E, B, C, keys):
    chord([('vla', 'D4'), ('vc', 'G2'), ('cb', 'G1')], 0, B(E['seal']), .3)
    n('vln1', 0, B(E['seal']), 'B4', .34)
    chord([('vln2', 'D5'), ('vla', 'G4')], B(E['seal']), .5, .6, 'pizz')                                    # sealed
    chord([('vln1', 'D6'), ('vln2', 'A5'), ('vla', 'F#4'), ('vc', 'D3')], B(E['stamp']), .5, .85, 'pizz')   # stamped
    s0, s1 = B(E['send'][0]), B(E['send'][1])
    for i, p in enumerate('D5 E5 F#5 A5 B5 C#6 D6 E6'.split()): n('vln1', s0 + i * (s1 - s0) / 8, (s1 - s0) / 8, p, .45 + i * .03)   # it flies
    chord([('vla', 'A3'), ('vc', 'A2'), ('cb', 'A1')], s0, s1 - s0, .32, 'trem', v1=.55)
    sb = B(E['status'])
    chord([('vln1', 'F#6'), ('vln2', 'D6'), ('vla', 'A4'), ('vc', 'D3'), ('cb', 'D2')], sb, 8 - sb, .6, v1=.5)   # merged

RECIPES = {'intro': r_intro, 'shelf': r_shelf, 'first-message': r_first, 'watching': r_watching, 'frames': r_frames,
           'building': r_building, 'restart': r_restart, 'knock': r_knock, 'notes': r_notes, 'side-by-side': r_side,
           'good-part': r_good, 'kept': r_kept, 'tag': r_tag, 'terminal': r_terminal, 'diff': r_diff, 'ship': r_ship}

def compose(story, arch):
    sc = Score(arch['bpm']); bar = 60 / arch['bpm'] * arch['beatsPerBar']
    t, silences, keys_all = 0.0, [], []
    for i, C in enumerate(story['chapters']):
        T = arch['types'][C['type']]; E = {**T['events'], **C.get('events', {})}
        b0 = t / sc.beat; n, chord = sc.at(b0)
        keys = [E['enter'] + d for d in arch['keysRel']] if 'enter' in E and C['type'] in ('intro', 'tag') else []
        RECIPES[C['type']](n, chord, E, lambda s: s / sc.beat, C, keys)
        if C['type'] in ('intro', 'tag'): keys_all += [(t + k, False) for k in keys] + [(t + E['enter'], True)]
        if C['type'] == 'terminal':
            cmd = (C.get('commands') or [''])[0]
            keys_all += [(t + E['type'] + i / E['cps'], False) for i in range(min(len(cmd), int((E['enter'] - E['type']) * E['cps'])))]
            keys_all += [(t + E['enter'], True)] + ([(t + E['rerun'], True)] if C.get('fail') and C.get('pass') else [])
        dur = T['bars'] * bar
        if 'lampOff' in E: silences.append((t + E['lampOff'], t + dur))                        # the music stops dead
        t += dur
    return sc, t, silences, keys_all

# ------------------------------------------------------------------------------------------------ the synth
PAN = {'vln1': -.45, 'vln2': -.18, 'vla': .15, 'vc': .42, 'cb': .05}
VOICES = {'vln1': 3, 'vln2': 3, 'vla': 2, 'vc': 2, 'cb': 1}
GAIN = {'vln1': 1.0, 'vln2': .78, 'vla': .78, 'vc': .95, 'cb': .8}
BODY = {  # body resonances: (centre Hz, gain dB, width octaves)
    'vln1': [(290, 5, .35), (470, 3, .4), (1000, 2, .5), (2900, 7, .7)], 'vln2': [(290, 5, .35), (470, 3, .4), (1000, 2, .5), (2900, 6, .7)],
    'vla': [(230, 5, .35), (380, 3, .4), (800, 2, .5), (2200, 5, .7)], 'vc': [(110, 4, .4), (200, 5, .4), (500, 3, .5), (1600, 4, .7)],
    'cb': [(60, 4, .4), (110, 5, .4), (300, 3, .5), (900, 2, .7)]}
ROLL = {'vln1': 5200, 'vln2': 5200, 'vla': 4000, 'vc': 3200, 'cb': 1600}

def body_gain(part, f):
    lf = np.log2(np.maximum(f, 1))
    db = sum(g * np.exp(-.5 * ((lf - np.log2(c)) / w) ** 2) for c, g, w in BODY[part])
    return 10 ** ((db - 12 * np.maximum(0, np.log2(np.maximum(f, 1) / ROLL[part]))) / 20)

def band(nsamp, lo, hi):
    sos = butter(2, [lo / (FS / 2), min(hi, FS / 2 - 100) / (FS / 2)], btype='band', output='sos')
    return sosfilt(sos, rng.standard_normal(nsamp))

def env_bowed(t, dur, art, vel, v1):
    if art in ('spic', 'stac', 'scratch'):
        a = .014 if art == 'spic' else .008
        return np.where(t < a, t / a, np.exp(-(t - a) / (.07 if art == 'spic' else .09)))
    att = {'leg': .09 + .12 * (1 - vel), 'trem': .06, 'harm': .22}.get(art, .1)
    e = np.clip(t / att, 0, 1) ** 1.5 * np.where(t > dur, np.exp(-(t - dur) / ((.6 if art == 'harm' else .28) / 3)), 1)
    if v1 is not None: e *= np.interp(t, [0, max(dur, .01)], [1, v1 / max(vel, .01)])
    return e

def bowed(part, f0, dur, vel, art, o):
    nsamp = int((dur + (.7 if art == 'harm' else .35)) * FS); t = np.arange(nsamp) / FS
    out = np.zeros(nsamp); voices = 1 if art == 'harm' else VOICES[part]; short = art in ('spic', 'stac', 'scratch')
    for _ in range(voices):
        det = 1 + (rng.uniform(-4, 4) / 1200 if voices > 1 else 0)
        depth = 0 if short else (.0018 if art == 'harm' else .0048) * np.clip((t - .16) / .4, 0, 1)
        vib = depth * np.sin(2 * np.pi * rng.uniform(5.0, 5.9) * t + rng.uniform(0, 6.28))
        drift = 1 + .0008 * np.sin(2 * np.pi * rng.uniform(.3, .7) * t + rng.uniform(0, 6.28))
        ph = 2 * np.pi * np.cumsum(f0 * det * (1 + vib) * drift) / FS
        if art == 'harm': y = np.sin(ph) + .06 * np.sin(2 * ph)
        else:
            hs = np.arange(1, int(min(48, 14000 / f0)) + 1)
            amp = (1 / hs) ** (1.15 - .35 * (.55 + .45 * vel)) * body_gain(part, hs * f0)
            if o.get('sord'): amp *= np.where(hs * f0 > 1400, (1400 / (hs * f0)) ** 1.6, 1) * .6
            amp /= np.sqrt((amp ** 2).sum())
            y = np.zeros(nsamp)
            for h, a in zip(hs, amp): y += a * np.sin(h * ph + rng.uniform(0, 6.28)) * (1 + .03 * rng.standard_normal())
        out += y / np.sqrt(voices)
    e = env_bowed(t, dur, art, vel, o.get('v1'))
    if art == 'trem': e *= .55 + .45 * np.abs(np.sin(2 * np.pi * 6.6 * t))
    y = out * e
    if art != 'harm':   # bow noise, louder at the attack
        bn = band(nsamp, 1800 if part.startswith('vln') else 900, 3000 if part == 'cb' else 7000)
        y = y + bn * (.05 * np.exp(-t / .05) + .012) * e * (1.6 if short else 1) * (.4 if o.get('sord') else 1)
    if art == 'scratch': y = y * .5 + band(nsamp, 600, 5000) * np.exp(-t / .03) * .5
    return y * vel ** 1.3

def pizz(part, f0, vel, o):
    ring = {'vln1': .55, 'vln2': .55, 'vla': .8, 'vc': 1.3, 'cb': 1.8}[part] * (1.4 if f0 < 200 else 1)
    nsamp = int((ring + .3) * FS); N = max(2, int(round(FS / f0)))
    prev = np.convolve(rng.uniform(-1, 1, N), np.ones(3) / 3, mode='same')      # a finger, not a pick
    rho = np.exp(np.log(.001) / (ring * f0)); periods = int(np.ceil(nsamp / N)) + 1
    y = np.empty(periods * N)
    for k in range(periods):                                                    # Karplus-Strong, one period at a time
        y[k * N:(k + 1) * N] = prev; prev = rho * .5 * (prev + np.roll(prev, 1))
    y = y[:nsamp]; fr = np.fft.rfftfreq(nsamp, 1 / FS)
    spec = np.fft.rfft(y) * body_gain(part, fr) * (np.where(fr > 1200, (1200 / np.maximum(fr, 1)) ** 1.5, 1) if o.get('sord') else 1)
    y = np.fft.irfft(spec, nsamp); y /= np.abs(y).max() + 1e-9
    return y * np.clip(np.arange(nsamp) / FS / .002, 0, 1) * vel ** 1.2 * .9 * (.6 if o.get('sord') else 1)

def hall():
    L = int(2.4 * FS); ti = np.arange(L) / FS; irs = []
    for ch in range(2):
        tail = sum(band(L, lo, hi) * np.exp(-6.91 * ti / rt) for lo, hi, rt in [(40, 500, 2.0), (500, 3000, 1.6), (3000, 12000, .9)])
        tail *= np.clip((ti - .018) / .01, 0, 1)
        er = np.zeros(L)
        for dly, g in [(.011, .5), (.017, .35), (.023, .42), (.031, .3), (.043, .25)]: er[int((dly + ch * .0017) * FS)] = g
        irs.append(er + tail / np.abs(tail).max() * .5)
    return irs

def render(sc, dur, silences):
    parts = {p: np.zeros(int((dur + 3) * FS)) for p in PAN}
    for part, t0, d, midi, vel, art, o in sc.notes:
        y = pizz(part, hz(midi), vel, o) if art == 'pizz' else bowed(part, hz(midi), d, vel, art, o)
        if o.get('cut'): k = int(d * FS); y[k:] *= np.exp(-np.arange(len(y) - k) / (.01 * FS))
        i0 = int(t0 * FS); parts[part][i0:i0 + len(y)] += y[:len(parts[part]) - i0] * GAIN[part]
    Lc = sum(y * np.cos((PAN[p] + 1) * np.pi / 4) for p, y in parts.items())
    Rc = sum(y * np.sin((PAN[p] + 1) * np.pi / 4) for p, y in parts.items())
    dry = np.stack([Lc, Rc], 1); irs = hall()
    wet = np.stack([fftconvolve(dry[:, c], irs[c])[:len(dry)] for c in range(2)], 1)
    mix = dry * .78 + wet * .3
    fade = int(.012 * FS)
    for a, b in silences:   # tails included: the lamp takes everything with it
        i, j = int(a * FS), int(b * FS); mix[i:i + fade] *= np.linspace(1, 0, fade)[:, None]; mix[i + fade:j] = 0
    mix = mix[:int(dur * FS)]; end = int(1.2 * FS); mix[-end:] *= np.linspace(1, 0, end)[:, None] ** 1.5
    return (mix / (np.abs(mix).max() / .89)).astype(np.float32)

def key_clicks(times, dur):
    """A synthesized key press: a bright tick, a low thump, a soft release click 60 ms later. (t, hard) pairs."""
    out = np.zeros(int(dur * FS)); n = int(.09 * FS); t = np.arange(n) / FS
    for t0, hard in times:
        hard = 1.3 if hard else 1.0                                               # Enter lands harder
        tick = band(n, 2500, 9000) * np.exp(-t / .004) * .8
        thump = np.sin(2 * np.pi * 170 * t) * np.exp(-t / .012) * .5
        rel = np.roll(band(n, 3000, 9000) * np.exp(-t / .003) * .3, int(.06 * FS)); rel[:int(.06 * FS)] = 0
        y = (tick + thump + rel) * hard * (.9 + .2 * rng.uniform())
        i0 = int(t0 * FS); out[i0:i0 + n] += y[:len(out) - i0]
    out /= max(np.abs(out).max(), 1e-9) / .7
    return np.stack([out, out], 1).astype(np.float32)

def write_midi(sc, path, bpm):
    """Minimal SMF type 1 writer: a tempo track + one track per part (program changes follow the articulation)."""
    def vlq(v):
        b = [v & 0x7F]; v >>= 7
        while v: b.insert(0, (v & 0x7F) | 0x80); v >>= 7
        return bytes(b)
    def track(events):
        data, now = b'', 0
        for tick, msg in sorted(events, key=lambda e: (e[0], e[1][0] & 0xF0 == 0x90)):
            data += vlq(tick - now) + msg; now = tick
        data += b'\x00\xff\x2f\x00'
        return b'MTrk' + struct.pack('>I', len(data)) + data
    tpb = 480; us = int(60_000_000 / bpm)
    tracks = [track([(0, b'\xff\x51\x03' + us.to_bytes(3, 'big')), (0, b'\xff\x58\x04\x04\x02\x18\x08')])]
    prog = {'vln1': 40, 'vln2': 40, 'vla': 41, 'vc': 42, 'cb': 43}
    for ch, part in enumerate(PAN):
        ev, cur = [(0, b'\xff\x03' + vlq(len(part)) + part.encode())], None
        for p, t0, d, midi, vel, art, o in sorted((x for x in sc.notes if x[0] == part), key=lambda x: x[1]):
            pr = 45 if art == 'pizz' else 44 if art == 'trem' else prog[part]
            on = int(round(t0 / sc.beat * tpb)); off = on + max(1, int(round(d / sc.beat * tpb)))
            if pr != cur: ev.append((on, bytes([0xC0 | ch, pr]))); cur = pr
            ev += [(on, bytes([0x90 | ch, midi, int(20 + vel * 107)])), (off, bytes([0x80 | ch, midi, 0]))]
        tracks.append(track(ev))
    with open(path, 'wb') as f: f.write(b'MThd' + struct.pack('>IHHH', 6, 1, len(tracks), tpb) + b''.join(tracks))

def master(src, dst):
    """Light compression, then two-pass linear loudnorm to -17 LUFS / -1.5 dBTP (ffmpeg)."""
    tmp = dst + '.comp.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', 'acompressor=threshold=-24dB:ratio=2:attack=30:release=300', tmp], check=True)
    def meas(f):
        r = subprocess.run(['ffmpeg', '-hide_banner', '-i', f, '-af', 'loudnorm=I=-17:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
        return json.loads(re.findall(r'\{[^{}]*\}', r.stderr)[-1])
    mm = meas(tmp)
    af = (f"loudnorm=I=-17:TP=-1.5:LRA=11:measured_I={mm['input_i']}:measured_TP={mm['input_tp']}:measured_LRA={mm['input_lra']}"
          f":measured_thresh={mm['input_thresh']}:offset={mm['target_offset']}:linear=true")
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-af', af, '-ar', str(FS), '-c:a', 'pcm_s24le', dst], check=True)
    os.remove(tmp)
    o = meas(dst); return o['input_i'], o['input_tp']

if __name__ == '__main__':
    if len(sys.argv) < 2: sys.exit('usage: python3 scripts/score.py <film-dir>')
    d = sys.argv[1]; out = os.path.join(d, 'music'); os.makedirs(out, exist_ok=True)
    if '--master-only' in sys.argv:   # after re-voicing strings.mid elsewhere and replacing music/strings.wav
        li, tp = master(os.path.join(out, 'strings.wav'), os.path.join(out, 'strings-mix.wav'))
        sys.exit(print(f'mastered music/strings-mix.wav ({li} LUFS, {tp} dBTP)'))
    story = json.load(open(os.path.join(d, 'story.json'))); arch = json.load(open(os.path.join(d, 'archetypes.json')))
    sc, dur, silences, keys = compose(story, arch)
    print(f'{len(sc.notes)} notes over {dur:.2f} s; silences {silences}')
    write_midi(sc, os.path.join(out, 'strings.mid'), arch['bpm'])
    wavfile.write(os.path.join(out, 'strings.wav'), FS, render(sc, dur, silences))
    wavfile.write(os.path.join(out, 'keys.wav'), FS, key_clicks(keys, dur))
    li, tp = master(os.path.join(out, 'strings.wav'), os.path.join(out, 'strings-mix.wav'))
    print(f'wrote music/strings.mid, strings.wav, strings-mix.wav ({li} LUFS, {tp} dBTP), keys.wav')
