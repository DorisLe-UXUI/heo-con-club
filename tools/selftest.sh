#!/bin/bash
# Run the in-browser selftest of 3D games and print body[data-selftest].
# usage: bash tools/selftest.sh bai-cao poker ...   (keys from play3d.html?game=<key>)
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CH="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
URL="file://$(python3 -c 'import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))' "$ROOT/play3d.html")"
for k in "$@"; do
  PROF="$(mktemp -d)"
  r=$("$CH" --headless=new --mute-audio --allow-file-access-from-files --enable-unsafe-swiftshader --use-angle=swiftshader --user-data-dir="$PROF" \
      --window-size=1280,800 --virtual-time-budget=240000 --dump-dom "$URL?game=$k&selftest=1" 2>/dev/null | grep -oE 'data-selftest="[^"]*"' | sed 's/&quot;/"/g' | cut -c1-160)
  rm -rf "$PROF"; echo "$k: ${r:-NO RESULT}"
done
