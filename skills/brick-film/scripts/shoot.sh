#!/bin/sh
# usage: bash shoot.sh <project-dir> <t1,t2,...> [camera-js-object | -] [out-dir-name]
# Headless HyperFrames snapshots. With a camera object, locks the view through dev.js for this run only
# (dev.js is restored to DEV_CAM = null on exit, even on failure). Writes <out>/sheet.jpg, and for the first
# time also onion.jpg (render over reference/target-square.jpg at 50%) and side.jpg (photo | render).
# Side effects: rewrites <project>/dev.js, replaces <project>/<out>/. No network beyond npx's first fetch.
set -eu
. "$(dirname "$0")/common.sh"
P="${1:-}"; TIMES="${2:-}"; CAM="${3:--}"; OUT="${4:-shots}"
if [ -z "$P" ] || [ -z "$TIMES" ]; then echo "usage: bash shoot.sh <project-dir> <t1,t2,...> [camera | -] [out]" >&2; exit 2; fi
cd "$P"
[ -f dev.js ] || { echo "error: $P has no dev.js (not a brick-film project?)" >&2; exit 1; }
need_node; need_py
trap 'printf "%s\n" "$DEV_NULL_JS" > dev.js' EXIT
[ "$CAM" != "-" ] && printf 'export const DEV_CAM = %s;\n' "$CAM" > dev.js
rm -rf "$OUT"
$HF snapshot . --at "$TIMES" --no-end --describe false --timeout 20000 -o "$OUT" >/dev/null
python3 - "$OUT" <<'PY'
import sys, os
from PIL import Image
out = sys.argv[1]; fs = sorted(f for f in os.listdir(out) if f.startswith('frame-'))
if not fs: sys.exit('error: no frames captured')
ims = [Image.open(os.path.join(out, f)).convert('RGB').resize((360, 360)) for f in fs]
cols = min(4, len(ims)); rows = (len(ims) + cols - 1) // cols
sh = Image.new('RGB', (cols * 360, rows * 360), 'white'); [sh.paste(im, ((i % cols) * 360, (i // cols) * 360)) for i, im in enumerate(ims)]
sh.save(os.path.join(out, 'sheet.jpg'), quality=86)
if os.path.exists('reference/target-square.jpg'):
    a = Image.open(os.path.join(out, fs[0])).convert('RGB').resize((1080, 1080)); b = Image.open('reference/target-square.jpg').convert('RGB')
    Image.blend(a, b, 0.5).resize((720, 720)).save(os.path.join(out, 'onion.jpg'), quality=86)
    side = Image.new('RGB', (1080, 540)); side.paste(b.resize((540, 540)), (0, 0)); side.paste(a.resize((540, 540)), (540, 0)); side.save(os.path.join(out, 'side.jpg'), quality=86)
print(f'{len(fs)} frame(s) → {out}/sheet.jpg')
PY
