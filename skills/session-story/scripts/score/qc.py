"""qc.py: you can't hear the score, so measure it. Prints the loudness at every beat's key moments against the film's
timeline and fails on dead air (a stretch quieter than -45 dBFS for more than 1.2 s inside the film).

  python3 qc.py ../assets/audio/score.wav timeline.json
"""
import array, json, math, sys, wave

wav, tl = sys.argv[1], json.load(open(sys.argv[2]))
w = wave.open(wav); sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
assert w.getsampwidth() == 2, '16-bit WAV expected'
a = array.array('h', w.readframes(n))
if sys.byteorder == 'big': a.byteswap()
hop = sr // 20   # 50 ms windows
env = []
for i in range(0, n - hop, hop):
    seg = a[i * ch:(i + hop) * ch]; s = sum(x * x for x in seg) / max(1, len(seg))
    env.append(10 * math.log10(s / 32768 ** 2 + 1e-12))
db = lambda t: max(env[max(0, int(t * 20) - 2):int(t * 20) + 3] or [-120])
print(f"{wav}: {n / sr:.2f} s (film {tl['duration']:.2f} s)")
for b in tl['blocks']:
    marks = [('start', b['S'])] + [(k, v if not isinstance(v, list) else v[0]) for k, v in b['at'].items() if isinstance(v, (int, float, list)) and v is not None]
    print(f"  {b['type']:10} " + '  '.join(f"{k} {db(t):6.1f}" for k, t in marks[:6]))
dead, run = [], 0
for i, v in enumerate(env):
    t = i / 20
    if .5 < t < tl['duration'] - .5 and v < -45: run += 1
    else:
        if run * .05 > 1.2: dead.append((t - run * .05, t))
        run = 0
if abs(n / sr - tl['duration']) > .1: print('FAIL: the score is not the film\'s length'); sys.exit(1)
if dead:
    print('FAIL: dead air at ' + ', '.join(f'{a:.1f} to {b:.1f} s' for a, b in dead) + ' (a beat with no cue)'); sys.exit(1)
print('ok: no dead air')
