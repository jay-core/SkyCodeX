#!/bin/zsh
set -u
OUT="$1"
cd "$(dirname "$0")/../.."
rm -rf "$OUT"
node tools/sweep/run-rules.mjs "$OUT"
for sc in rules overlaps; do
  rm -f data/logs/smoke-report.json
  npx electron . --smoke samples/tinyhttp --scenario "$sc" >/dev/null 2>&1
  echo "tinyhttp $sc exit $?"
  cp data/logs/smoke-report.json "$OUT/tinyhttp-$sc.json" 2>/dev/null
done
cp data/logs/smoke-overlaps-grid-step19.png "$OUT/" 2>/dev/null
shift
for extra in "$@"; do
  name="$(basename "$extra")"
  rm -f data/logs/smoke-report.json
  npx electron . --smoke "$extra" --scenario rules >/dev/null 2>&1
  echo "$name rules exit $?"
  cp data/logs/smoke-report.json "$OUT/$name-rules.json" 2>/dev/null
done
echo done
