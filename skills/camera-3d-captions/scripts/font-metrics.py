#!/usr/bin/env python3
"""Glyph advances + line-height-1 baseline per font, for CAM3D.init.

  font-metrics.py out/metrics.js key=path/to/font.woff2[@wght=600] [key=... ...]

Writes `window.CAM3D_METRICS = {adv: {key: {char: em}}, base: {key: em}}`. Variable fonts are instanced at the given
axes; pin the same axes in CSS (font-variation-settings, font-optical-sizing: none) or the browser's opsz follows the
font size and the rendered widths drift from these tables. Kerning is ignored on purpose: the engine places every glyph itself and the CSS sets font-kerning: none.
"""
import json, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

CHARS = [chr(c) for c in range(32, 127)] + ['’', '‘', '“', '”', '—', '–', '…']


def load(spec):
    path, _, axes = spec.partition('@')
    f = TTFont(path)
    if 'fvar' in f and not axes:
        ax = ', '.join('%s %g-%g (default %g)' % (a.axisTag, a.minValue, a.maxValue, a.defaultValue) for a in f['fvar'].axes)
        print('WARNING %s is variable [%s]: pass @wght=...,opsz=... and pin the same values in CSS '
              '(font-variation-settings + font-optical-sizing: none), or widths will not match' % (path, ax))
    if axes and 'fvar' in f:
        loc = {k: float(v) for k, v in (a.split('=') for a in axes.split(','))}
        f = instancer.instantiateVariableFont(f, loc)
    return f


def metrics(f):
    upm = f['head'].unitsPerEm
    cmap, hmtx = f.getBestCmap(), f['hmtx']
    adv = {ch: round(hmtx[cmap[ord(ch)]][0] / upm, 4) for ch in CHARS if ord(ch) in cmap}
    os2, hh = f['OS/2'], f['hhea']
    if os2.fsSelection & (1 << 7):                     # USE_TYPO_METRICS: browsers use the typo values
        asc, desc = os2.sTypoAscender, os2.sTypoDescender
    else:
        asc, desc = hh.ascent, hh.descent
    a, d = asc / upm, -desc / upm
    return adv, round((1 - (a + d)) / 2 + a, 5)     # half-leading + ascent at line-height 1


if __name__ == '__main__':
    out, specs = sys.argv[1], sys.argv[2:]
    res = {'adv': {}, 'base': {}}
    for s in specs:
        key, _, spec = s.partition('=')
        res['adv'][key], res['base'][key] = metrics(load(spec))
        print(key, 'base', res['base'][key], 'glyphs', len(res['adv'][key]))
    open(out, 'w').write('window.CAM3D_METRICS = ' + json.dumps(res) + ';\n')
