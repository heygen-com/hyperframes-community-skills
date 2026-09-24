#!/usr/bin/env python3
"""QC a rendered film against its story: python3 scripts/qc.py <film-dir> <film.mp4>

Checks (exit 1 on any FAIL):
  stepping      new drawings ~8/s, every change on the 3-frame grid, no hold longer than one drawing (nothing idles)
  seams         a fully inked frame at every wipe/swallow cut (±1 drawing), and the lamp-out held black
  lamp          the score is silent within one frame of the picture going black, until the next chapter
  loudness      integrated loudness within -19..-15 LUFS, true peak <= -1 dBTP
Needs numpy + ffmpeg. Reads the mp4 only; writes nothing.
"""
import json, os, re, subprocess, sys
import numpy as np

d, mp4 = sys.argv[1], sys.argv[2]
story = json.load(open(os.path.join(d, 'story.json'))); arch = json.load(open(os.path.join(d, 'archetypes.json')))
bar = 60 / arch['bpm'] * arch['beatsPerBar']; W, H, FPS = 320, 180, 24
fails = []
def check(ok, msg): print(('PASS  ' if ok else 'FAIL  ') + msg); ok or fails.append(msg)

raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp4, '-vf', f'scale={W}:{H},format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
a = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
diff = np.abs(np.diff(a, axis=0)).mean(axis=(1, 2)); ch = diff > .4; idx = np.where(ch)[0] + 1
run = best = 0
for x in ch: run = 0 if x else run + 1; best = max(best, run)
rate = ch.sum() / (len(diff) / FPS)
check(7.5 <= rate <= 8.5, f'stepping: {rate:.2f} new drawings/s (want ~8)')
check(((idx % 3) == 0).mean() > .98, f'stepping: {((idx % 3) == 0).mean() * 100:.1f}% of changes on the 3-frame grid')
check(best + 1 <= 3, f'stepping: longest hold {best + 1} frames (want <= 3: the linework boils even in the dark)')

ink = (a[:, 6:-6, 6:-6] < 60).mean(axis=(1, 2)) > .97
t, cuts, lamp = 0.0, [], None
for c in story['chapters']:
    T = arch['types'][c['type']]; out = c.get('out', T['out']); E = {**T['events'], **c.get('events', {})}
    if 'lampOff' in E: lamp = (t + E['lampOff'], t + T['bars'] * bar)
    t += T['bars'] * bar
    if out in ('wipe', 'swallow'): cuts.append((t, out))
for tc, kind in cuts:
    f = int(round(tc * FPS)); win = ink[max(0, f - 4):f + 4]
    check(win.any(), f'seam {kind} at {tc:.2f}s: fully inked frame on the cut')
if lamp:
    f0, f1 = int(round(lamp[0] * FPS)), int(round(lamp[1] * FPS))
    check(ink[f0 + 1:f1 - 1].all(), f'lamp: black held {lamp[0]:.2f}-{lamp[1]:.2f}s')
    au = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', mp4, '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], capture_output=True).stdout, np.float32)
    if len(au):
        i = int(lamp[0] * 48000)
        while i < len(au) and np.abs(au[i:i + 240]).max() > 1e-4: i += 240
        check(abs(i / 48000 - lamp[0]) <= 1 / FPS + .02, f'lamp: score silent at {i / 48000:.3f}s vs picture black {lamp[0]:.3f}s')
        gap = au[int((lamp[0] + .06) * 48000):int((lamp[1] - .05) * 48000)]
        check(np.abs(gap).max() < 1e-3, f'lamp: silence until the next chapter (max {np.abs(gap).max():.5f})')
r = subprocess.run(['ffmpeg', '-hide_banner', '-i', mp4, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
js = re.findall(r'\{[^{}]*\}', r.stderr)
if js:
    L = json.loads(js[-1]); li, tp = float(L['input_i']), float(L['input_tp'])
    check(-19 <= li <= -15, f'loudness: {li:.1f} LUFS'); check(tp <= -1, f'loudness: true peak {tp:.1f} dBTP')
else: check(False, 'loudness: no audio stream')
print('QC', 'FAILED' if fails else 'passed', f'({len(fails)} failure(s))')
sys.exit(1 if fails else 0)
