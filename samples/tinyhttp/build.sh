#!/bin/sh
# Builds tinyhttp with clang, writing compile_commands.json and -fstack-usage data.
set -e
cd "$(dirname "$0")"
mkdir -p build
rm -f build/*.json.part
for f in src/main.cpp src/server.cpp src/config.cpp src/metrics.cpp src/router.cpp src/http/headers.cpp src/net/io.cpp src/util/strings.cpp; do
  o="build/$(echo "$f" | tr '/' '_').o"
  clang++ -std=c++20 -O1 -g -Wall -fstack-usage -MJ "$o.json.part" -c "$f" -o "$o"
done
clang++ build/*.o -o build/tinyhttp
{ echo '['; cat build/*.json.part | sed '$ s/,$//'; echo ']'; } > compile_commands.json
rm -f build/*.json.part
echo "built build/tinyhttp"
