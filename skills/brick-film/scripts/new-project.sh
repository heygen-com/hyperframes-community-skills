#!/bin/sh
# usage: bash new-project.sh <project-dir> <photo> "<title>" [kicker] [bg-hex] [crop x0,y0,x1,y1]
# Creates <project-dir> (must not exist) as a HyperFrames project wired to the kit:
#   index.html, scene.js (skeleton), dev.js, kit/*.js, reference/photo.jpg (upright, max 1600 px),
#   reference/target-square.jpg (the photo crop the PHOTO camera must reproduce; default = centred square).
# Network: npx fetches hyperframes@$HF_VERSION from the npm registry on first run. No credentials, no cost.
set -eu
. "$(dirname "$0")/common.sh"
DIR="${1:-}"; PHOTO="${2:-}"; TITLE="${3:-}"; KICK="${4:-01 / 01}"; BG="${5:-#aecdee}"; CROP="${6:-}"
if [ -z "$DIR" ] || [ -z "$PHOTO" ] || [ -z "$TITLE" ]; then echo 'usage: bash new-project.sh <dir> <photo> "<title>" [kicker] [bg-hex] [crop x0,y0,x1,y1]' >&2; exit 2; fi
[ -f "$PHOTO" ] || { echo "error: photo not found: $PHOTO" >&2; exit 1; }
[ -e "$DIR" ] && { echo "error: $DIR already exists; choose a new directory" >&2; exit 1; }
case "$BG" in \#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]) ;; *) echo "error: bg must be #rrggbb" >&2; exit 1 ;; esac
need_node; need_py
TMPD="$(mktemp -d)"; RAW="$TMPD/raw.jpg"; trap 'rm -rf "$TMPD"' EXIT
case "$PHOTO" in
  *.jpg|*.JPG|*.jpeg|*.JPEG|*.png|*.PNG) cp "$PHOTO" "$RAW" ;;
  *.heic|*.HEIC|*.dng|*.DNG)
    command -v sips >/dev/null || { echo "error: HEIC/DNG needs macOS sips; convert the photo to JPG first" >&2; exit 1; }
    sips -s format jpeg "$PHOTO" --out "$RAW" >/dev/null ;;
  *) echo "error: unsupported photo type (use JPG, PNG, or HEIC/DNG on macOS)" >&2; exit 1 ;;
esac
HYPERFRAMES_SKIP_SKILLS=1 $HF init "$DIR" --example blank --resolution square --non-interactive >/dev/null
mkdir -p "$DIR/kit" "$DIR/reference" "$DIR/renders"
cp "$SKILL_DIR"/assets/kit/*.js "$DIR/kit/"
# HTML-escape for index.html, then escape for sed (\, |, &)
html() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }
sedq() { printf '%s' "$1" | sed -e 's/[\\|&]/\\&/g'; }
TT=$(sedq "$(html "$TITLE")"); KK=$(sedq "$(html "$KICK")"); TJ=$(sedq "$(printf '%s' "$TITLE" | tr -d '\n\r')")
sed -e "s|__TITLE__|$TT|g" -e "s|__KICKER__|$KK|g" -e "s|__BG__|$BG|g" -e "s|__DUR__|17|g" "$SKILL_DIR/assets/template/index.html" > "$DIR/index.html"
sed -e "s|__TITLE__|$TJ|g" -e "s|__BG__|$BG|g" "$SKILL_DIR/assets/template/scene.js" > "$DIR/scene.js"
printf '%s\n' "$DEV_NULL_JS" > "$DIR/dev.js"
python3 - "$RAW" "$DIR" "$CROP" <<'PY'
import sys
from PIL import Image, ImageOps
raw, d, crop = sys.argv[1], sys.argv[2], sys.argv[3]
im = ImageOps.exif_transpose(Image.open(raw)).convert('RGB'); im.thumbnail((1600, 1600)); im.save(f'{d}/reference/photo.jpg', quality=92)
W, H = im.size
if crop: x0, y0, x1, y1 = map(int, crop.split(','))
else: s = min(W, H); x0, y0 = (W - s) // 2, (H - s) // 2; x1, y1 = x0 + s, y0 + s
im.crop((x0, y0, x1, y1)).resize((1080, 1080), Image.LANCZOS).save(f'{d}/reference/target-square.jpg', quality=90)
print(f'photo {W}x{H}, target crop {x0},{y0},{x1},{y1}')
PY
echo "ready: $DIR  (set dur in scene.js and data-duration in index.html together)"
