#!/bin/sh
# usage: bash render.sh <project-dir> <name>   →  <project-dir>/renders/<name>.mp4 (1080×1080, 30 fps, CRF 12, local GPU capture)
# Uses the pinned CLI from common.sh. Local only: WebGL compositions failed on HyperFrames cloud rendering in testing.
set -eu
. "$(dirname "$0")/common.sh"
P="${1:-}"; NAME="${2:-}"
if [ -z "$P" ] || [ -z "$NAME" ]; then echo "usage: bash render.sh <project-dir> <name>" >&2; exit 2; fi
[ -f "$P/index.html" ] || { echo "error: $P/index.html not found" >&2; exit 1; }
need_node
mkdir -p "$P/renders"
$HF render "$P" --browser-gpu --crf 12 --fps 30 -o "$P/renders/$NAME.mp4"
