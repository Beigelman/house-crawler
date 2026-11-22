#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DENO_BIN="${DENO_BIN:-deno}"

cd "$PROJECT_DIR"
# Replace the shell so systemd supervises Deno and delivers stop signals to it.
exec "$DENO_BIN" task worker
