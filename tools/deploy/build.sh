#!/bin/bash
# Build dist/ for publishing the game as a multi-file Claude Artifact (≤511 files per version).
# Run from the project root:  bash tools/deploy/build.sh [out_dir]
set -e
OUT="${1:-dist}"; T="$(mktemp -d)"
python3 -E tools/deploy/closure.py "$T/files.json"
python3 -E tools/deploy/plan.py "$T/files.json" "$T/plan.json"
python3 -E tools/deploy/build_dist.py "$T/plan.json" "$OUT"
rm -rf "$T"
