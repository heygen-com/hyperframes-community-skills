#!/bin/sh
# One-time setup, run manually (never at install time).
# Network calls, all read-only downloads:
#   - npm registry: puppeteer 25.9.0 (Apache-2.0), p5 2.3.2 (LGPL-2.1),
#     and p5.brush 2.2.1 (MIT)
#   - Google Chrome for Testing: Puppeteer's pinned Chromium build
# No credentials, no cost, nothing is uploaded.
set -e
cd "$(dirname "$0")"
npm ci
echo "setup complete"
