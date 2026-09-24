#!/bin/sh
# One-time setup, run manually (never at install time).
# Network: read-only downloads from the npm registry of the pinned packages in package-lock.json:
#   p5 2.3.2 (LGPL-2.1), p5.brush 2.2.1 (MIT), puppeteer 25.9.0 (Apache-2.0; it also fetches its pinned
#   Chrome for Testing build from Google). No credentials, no cost, nothing is uploaded.
# Python packages are NOT installed here; the check below prints the command if they are missing.
set -e
cd "$(dirname "$0")"
npm ci --no-audit --no-fund
python3 -c "import numpy, scipy" 2>/dev/null || echo "score.py needs numpy + scipy:  python3 -m pip install -r $(pwd)/requirements.txt"
command -v ffmpeg >/dev/null 2>&1 || echo "ffmpeg is required (score mastering, QC, HyperFrames render): install it and put it on PATH"
echo "setup complete"
