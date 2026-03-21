#!/bin/bash
set -euo pipefail

# Correctness check first (fast)
npm test --silent 2>&1 | grep -E "passed|failed|error" | tail -3

# CPU hot-path benchmark (imports actual source files via ESM loader)
node --experimental-loader ./benchmark/loader.mjs benchmark/bench.mjs 2>/dev/null

# Visual benchmark (headless Chromium, real WebGL — measures GPU+compositor cost)
node benchmark/bench_visual.mjs 2>/dev/null
