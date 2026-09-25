#!/usr/bin/env python3
"""usage: python3 sample_colors.py <photo> x,y [x,y ...] [--r 3]
Prints the average colour of a (2r+1)² patch at each pixel of the photo as #rrggbb (upright orientation)."""
import sys
from PIL import Image, ImageOps
args = sys.argv[1:]; r = 3
if '--r' in args: i = args.index('--r'); r = int(args[i + 1]); del args[i:i + 2]
im = ImageOps.exif_transpose(Image.open(args[0])).convert('RGB'); W, H = im.size
for xy in args[1:]:
    x, y = map(int, xy.split(','))
    px = [im.getpixel((min(W - 1, max(0, x + dx)), min(H - 1, max(0, y + dy)))) for dx in range(-r, r + 1) for dy in range(-r, r + 1)]
    c = tuple(sum(p[k] for p in px) // len(px) for k in range(3))
    print(f'{x},{y}  #{c[0]:02x}{c[1]:02x}{c[2]:02x}')
