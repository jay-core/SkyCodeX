#!/bin/zsh
set -u
OUT="$1"
shift
cd "$(dirname "$0")/../.."
rm -rf "$OUT"
extra=()
for p in "$@"; do extra+=("${p}:rules"); done
node tools/sweep/run-rules.mjs "$OUT" samples/tinyhttp:rules,overlaps "${extra[@]}"
