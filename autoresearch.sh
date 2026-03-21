#!/bin/bash
set -euo pipefail

# Correctness check first (fast)
npm test --silent 2>&1 | grep -E "passed|failed|error" | tail -3

# Run benchmark (imports actual source files)
node --experimental-loader ./benchmark/loader.mjs benchmark/bench.mjs 2>/dev/null
