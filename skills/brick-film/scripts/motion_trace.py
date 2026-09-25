#!/usr/bin/env python3
"""usage: python3 motion_trace.py <render.mp4>
Whole-frame motion trace: mean absolute difference between consecutive frames at 96×96 grey (needs ffmpeg).
Prints spikes (> 6× the median and > 3 levels) for a human to inspect, and frozen runs longer than 0.75 s.
Exit 0 always; spikes are prompts to look, not failures (a fast spin on twos spikes legitimately)."""
import subprocess, sys
import numpy as np
mp4 = sys.argv[1]
fps = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', mp4], capture_output=True, text=True).stdout.strip()
fps = eval(fps) if fps else 30
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp4, '-vf', 'scale=96:96,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
f = np.frombuffer(raw, np.uint8).reshape(-1, 96, 96).astype(np.float32)
d = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2)); med = float(np.median(d))
spikes = [(i + 1, round((i + 1) / fps, 2), round(float(v), 1)) for i, v in enumerate(d) if v > med * 6 and v > 3]
runs, start = [], None
for i, v in enumerate(list(d) + [9.9]):
    if v < 0.05 and start is None: start = i
    if v >= 0.05 and start is not None:
        if (i - start) / fps > 0.75: runs.append((round(start / fps, 2), round(i / fps, 2)))
        start = None
print(f'{len(f)} frames @ {fps:g} fps, median motion {med:.2f}')
print('spikes (frame, s, level):', spikes or 'none')
print('frozen > 0.75 s (s0, s1):', runs or 'none')
