#!/bin/bash
# Headless screenshot of a game page (run from anywhere).
# usage: bash tools/shot.sh <page.html> <query> <out.png> [W,H] [virtual_ms]
#   e.g. bash tools/shot.sh index.html "shot=1&screen=town&as=guest" town.png 1920,1080 40000
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CH="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
URL="file://$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))' "$ROOT/$1")?$2"
OUT="$3"; case "$OUT" in /*) ;; *) OUT="$PWD/$OUT";; esac
PROF="$(mktemp -d)"
"$CH" --headless=new --mute-audio --hide-scrollbars --allow-file-access-from-files --enable-unsafe-swiftshader --use-angle=swiftshader \
  --user-data-dir="$PROF" --window-size="${4:-1920,1080}" --virtual-time-budget="${5:-30000}" --screenshot="$OUT" "$URL" >/dev/null 2>&1
rm -rf "$PROF"
ls -la "$OUT" | awk '{print $5, $9}'
