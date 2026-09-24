#!/bin/sh
# One-time setup, run manually (never at install time).
# Network: read-only downloads from the npm registry, pinned by package-lock.json:
#   p5 2.3.3 (LGPL-2.1), p5.brush 2.2.3 (MIT), @fontsource/permanent-marker 5.3.0 (the Permanent Marker font, Apache-2.0).
# No credentials, no cost, nothing is uploaded.
set -e
cd "$(dirname "$0")"
npm ci --no-audit --no-fund
echo "setup complete"
