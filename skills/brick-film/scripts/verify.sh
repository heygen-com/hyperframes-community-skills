#!/bin/sh
# usage: bash verify.sh <project-dir> [render.mp4]
# 1. HyperFrames check must pass.  2. Seek-order determinism: the same time captured after seeking from
# different places must be byte-identical.  Exit 0 = both pass.  3. With a render: an advisory whole-frame motion
# trace (prints spikes and frozen runs for a human to inspect; never fails). Side effects: writes and removes a temp snapshot dir. No network beyond npx's first fetch.
set -eu
. "$(dirname "$0")/common.sh"
P="${1:-}"; MP4="${2:-}"
[ -n "$P" ] || { echo "usage: bash verify.sh <project-dir> [render.mp4]" >&2; exit 2; }
[ -f "$P/index.html" ] || { echo "error: $P/index.html not found" >&2; exit 1; }
need_node; need_py
echo "1/3 check"
CHK="$(cd "$P" && $HF check 2>&1 || true)"
if printf '%s' "$CHK" | grep -q "Check passed"; then echo "PASS: hyperframes check"
else printf '%s\n' "$CHK" | grep -E "✗|error|Error|failed" | grep -v "0 error" | head -20 >&2; echo "FAIL: hyperframes check" >&2; exit 1; fi
DUR=$(python3 -c "import re,sys; print(re.search(r'data-duration=\"([0-9.]+)\"', open(sys.argv[1]).read()).group(1))" "$P/index.html")
TA=$(python3 -c "print(round($DUR*0.6,2))"); TB=$(python3 -c "print(round($DUR-0.3,2))")
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
echo "2/3 determinism at ${TA}s (seek order ${TA} → 1 → ${TA} → ${TB} → ${TA})"
( cd "$P" && $HF snapshot . --at "$TA,1,$TA,$TB,$TA" --no-end --describe false --timeout 20000 -o "$TMP" >/dev/null )
python3 - "$TMP" <<'PY'
import sys, os, hashlib
d = sys.argv[1]; fs = sorted(f for f in os.listdir(d) if f.startswith('frame-'))
h = [hashlib.md5(open(os.path.join(d, f), 'rb').read()).hexdigest() for f in fs]
same = len(h) == 5 and h[0] == h[2] == h[4]
print(('PASS' if same else 'FAIL') + ': ' + ' '.join(x[:8] for x in h))
sys.exit(0 if same else 1)
PY
if [ -n "$MP4" ]; then echo "3/3 motion trace (advisory: inspect every spike and every frozen run that isn't the final hold)"; python3 "$SKILL_DIR/scripts/motion_trace.py" "$MP4"; else echo "3/3 skipped (no render given)"; fi
