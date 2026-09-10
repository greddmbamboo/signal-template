#!/usr/bin/env bash
set -euo pipefail
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vinext build
