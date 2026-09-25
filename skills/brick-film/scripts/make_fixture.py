#!/usr/bin/env python3
"""usage: python3 make_fixture.py <out.jpg>
Draws a deterministic test photo (a red mug on a wooden table against a teal wall, soft window light) so the
skill can be exercised without anyone's personal photos."""
import sys
from PIL import Image, ImageDraw, ImageFilter
W, H = 1200, 1200
im = Image.new('RGB', (W, H), (70, 128, 132)); d = ImageDraw.Draw(im)
for y in range(0, 760):                                   # wall with a gentle light falloff
    k = 1 - y / 1400; d.line([(0, y), (W, y)], fill=(int(70 + 40 * k), int(128 + 40 * k), int(132 + 38 * k)))
d.rectangle([0, 760, W, H], fill=(176, 124, 78))           # table
for x in range(0, W, 150): d.line([(x, 760), (x - 60, H)], fill=(158, 108, 66), width=4)
sh = Image.new('L', (W, H), 0); ImageDraw.Draw(sh).ellipse([470, 870, 930, 950], fill=150)
im.paste((60, 40, 26), (0, 0), sh.filter(ImageFilter.GaussianBlur(24)))   # contact shadow
d.rounded_rectangle([420, 420, 800, 900], radius=46, fill=(196, 38, 36))   # mug body
d.ellipse([420, 395, 800, 455], fill=(150, 26, 26)); d.ellipse([440, 405, 780, 450], fill=(60, 30, 22))  # rim + coffee
d.arc([690, 520, 880, 760], start=-80, end=80, fill=(196, 38, 36), width=52)                          # handle
d.rounded_rectangle([450, 470, 520, 860], radius=30, fill=(222, 84, 76))   # highlight
d.rectangle([560, 610, 700, 690], fill=(245, 240, 228))                    # label
im.save(sys.argv[1], quality=92)
print('wrote', sys.argv[1])
