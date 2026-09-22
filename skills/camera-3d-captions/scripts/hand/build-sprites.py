#!/usr/bin/env python3
"""Hand-drawn word sprites for camera-3d-captions (p5.brush write-on -> keyed, recoloured sprite sheets).

  build-sprites.py words.json <project>/assets/hand  --engine <p5-paint-animation>/scripts

words.json: [{"id": "forget_hero", "word": "forget", "size": 420, "brush": "charcoal", "laps": 3, "jit": 0.05,
              "color": "#E0442C", "spf": 2, "seed": 3}, ...]
Each id -> <id>.png (frames in a grid) + an entry in sprites.js:
  window.HAND = { id: {src, sz, fw, fh, n, cols, ox, oy, letters: [{ch, x0, x1}]}, ... }   (px of the frame; ox/oy =
  left end of the baseline; letters = advance boundaries, for per-glyph ring pieces)
Frames are the write-on at one frame per `spf` strokes; play them on the 15-fps grid.
"""
import json, math, os, re, subprocess, sys, tempfile, shutil
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))


def letters_block(engine):
    src = open(os.path.join(engine, 'sketches', 'handwriting.anim.js')).read()
    a = src.index('const LETTERS = {')
    b = src.index('const TEXT')
    return src[a:b]


def render(spec, engine, work):
    adv_guess = 0.66 * len(spec['word']) + 0.6
    W = int(math.ceil((spec['size'] * adv_guess * 1.08 + spec['size'] * 0.8) / 2) * 2)
    H = int(math.ceil(spec['size'] * 1.55 / 2) * 2)
    name = 'hand_' + re.sub(r'[^a-z0-9]+', '_', spec['id'].lower())
    sk = os.path.join(work, name + '.anim.js')             # temp sketch lives in our temp dir, never in the engine
    open(sk, 'w').write(letters_block(engine) + '\n' + open(os.path.join(HERE, 'hand-word.anim.js')).read())
    out = os.path.join(work, name + '.mp4')
    inj = 'HW_WORD=%s;SIZE=%d;BRUSH=%s;LAPS=%d;JIT=%s' % (json.dumps(spec['word']), spec['size'], json.dumps(spec.get('brush', '2B')),
                                                       spec.get('laps', 2), spec.get('jit', 0.035))
    r = subprocess.run(['node', 'render-anim.mjs', sk, out, '--size', '%dx%d' % (W, H), '--spf', str(spec.get('spf', 2)),
                        '--fps', '15', '--hold', '0', '--seed', str(spec.get('seed', 7)), '--keep-frames', '1', '--inject', inj],
                       cwd=engine, capture_output=True, text=True)
    if r.returncode: sys.exit('render failed for %s:\n%s\n%s' % (spec['id'], r.stdout[-800:], r.stderr[-1500:]))
    meta = json.load(open(out.replace('.mp4', '.track.json')))['markers']
    fdir = os.path.join(engine, 'out', '_frames_' + name + '.anim')
    frames = sorted(f for f in os.listdir(fdir) if f.endswith('.png'))
    imgs = [np.asarray(Image.open(os.path.join(fdir, f)).convert('RGB')).astype(np.float32) for f in frames]
    shutil.rmtree(fdir, ignore_errors=True)
    return imgs, meta


def key(imgs, color):
    paper = np.median(imgs[0].reshape(-1, 3), axis=0)
    Lp = paper.mean(); Lk = 30.0
    c = np.array([int(color[i:i + 2], 16) for i in (1, 3, 5)], np.float32)
    out = []
    for im in imgs:
        a = np.clip((Lp - im.mean(axis=2)) / (Lp - Lk), 0, 1)
        a = np.where(a < 0.04, 0, a)                       # paper grain -> clean transparency
        rgba = np.zeros(im.shape[:2] + (4,), np.uint8)
        rgba[..., :3] = c; rgba[..., 3] = (a * 255).round()
        out.append(rgba)
    return out


def build(spec, engine, outdir, work):
    imgs, meta = render(spec, engine, work)
    frames = key(imgs, spec.get('color', '#ffffff'))
    last = frames[-1][..., 3] > 8
    ys, xs = np.nonzero(last)
    pad = 6
    x0, x1 = max(0, xs.min() - pad), min(last.shape[1], xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(last.shape[0], ys.max() + pad + 1)
    letters = meta['letters']
    x0 = min(x0, int(letters[0]['x0']))                  # keep the baseline origin inside the frame
    x0, x1, y0, y1 = int(x0), int(x1), int(y0), int(y1)
    fw, fh = x1 - x0, y1 - y0
    n = len(frames); cols = max(1, min(n, 16384 // fw)); rows = int(math.ceil(n / cols))
    sheet = Image.new('RGBA', (cols * fw, rows * fh), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(Image.fromarray(f[y0:y1, x0:x1]), ((i % cols) * fw, (i // cols) * fh))
    src = spec['id'] + '.png'
    sheet.save(os.path.join(outdir, src), optimize=True)
    return {'src': src, 'sz': spec['size'], 'fw': fw, 'fh': fh, 'n': n, 'cols': cols,
            'ox': round(float(letters[0]['x0'] - x0), 1), 'oy': round(float(meta['base'] - y0), 1),
            'letters': [{'ch': l['ch'], 'x0': round(float(l['x0'] - x0), 1), 'x1': round(float(l['x1'] - x0), 1)} for l in letters]}


if __name__ == '__main__':
    words, outdir = sys.argv[1], sys.argv[2]
    engine = sys.argv[sys.argv.index('--engine') + 1] if '--engine' in sys.argv else os.environ.get('P5_ENGINE')
    if not engine: sys.exit('pass --engine <p5-paint-animation skill>/scripts (the directory holding render-anim.mjs), or set P5_ENGINE')
    engine, outdir = os.path.abspath(engine), os.path.abspath(outdir)
    os.makedirs(outdir, exist_ok=True)
    res = {}
    with tempfile.TemporaryDirectory() as work:
        for spec in json.load(open(words)):
            res[spec['id']] = build(spec, engine, outdir, work)
            r = res[spec['id']]; print('%-16s %3d frames  %dx%d' % (spec['id'], r['n'], r['fw'], r['fh']))
    open(os.path.join(outdir, 'sprites.js'), 'w').write('window.HAND = ' + json.dumps(res) + ';\n')
