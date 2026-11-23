#!/usr/bin/env bash

set -euo pipefail

if [[ "$(uname -s)" != Linux ]] || ! command -v systemctl >/dev/null; then
    echo "This installer requires Linux with systemd." >&2
    exit 1
fi
if [[ "$EUID" -eq 0 ]]; then
    echo "Run as the worker user, without sudo; the installer uses sudo when needed." >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_USER="$(id -un)"
# Resolve mise/asdf shims now: boot does not load an interactive shell's PATH.
DENO_BIN="$("${DENO_BIN:-deno}" eval 'console.log(Deno.execPath())')"
if [[ ! -x "$DENO_BIN" || "$DENO_BIN" != /* ]]; then
    echo "DENO_BIN must resolve to an absolute, executable Deno binary." >&2
    exit 1
fi
if [[ ! -r "$BACKEND_DIR/.env" ]]; then
    echo "Configure $BACKEND_DIR/.env before installing." >&2
    exit 1
fi

# Escape values for quoted systemd settings, including literal specifiers.
escape_setting() {
    local value="$1"
    if [[ "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
        echo "Paths must not contain newlines." >&2
        return 1
    fi
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    value="${value//%/%%}"
    printf '%s' "$value"
}

# WorkingDirectory takes the full path literally except for systemd specifiers.
WORKING_DIR="${BACKEND_DIR//%/%%}"
EXEC_BACKEND_DIR="$(escape_setting "$BACKEND_DIR")"
EXEC_BACKEND_DIR="${EXEC_BACKEND_DIR//\$/\$\$}"
DENO_BIN="$(escape_setting "$DENO_BIN")"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT
for unit in house-worker.service house-validator.service; do
    template="$(cat "$SCRIPT_DIR/$unit")"
    template="${template//@RUN_USER@/"$RUN_USER"}"
    template="${template//@EXEC_BACKEND_DIR@/"$EXEC_BACKEND_DIR"}"
    template="${template//@WORKING_DIR@/"$WORKING_DIR"}"
    template="${template//@DENO_BIN@/"$DENO_BIN"}"
    printf '%s\n' "$template" > "$TEMP_DIR/$unit"
done
cp "$SCRIPT_DIR/house-validator.timer" "$TEMP_DIR/house-validator.timer"
if command -v systemd-analyze >/dev/null; then
    systemd-analyze verify "$TEMP_DIR/house-worker.service" \
        "$TEMP_DIR/house-validator.service" "$TEMP_DIR/house-validator.timer"
fi

sudo -v
# The worker owns collection scheduling; retire the old collection timer.
if sudo systemctl cat house-crawler.timer >/dev/null 2>&1; then
    sudo systemctl disable --now house-crawler.timer
fi
sudo install -m 644 "$TEMP_DIR/house-worker.service" /etc/systemd/system/
sudo install -m 644 "$TEMP_DIR/house-validator.service" /etc/systemd/system/
sudo install -m 644 "$TEMP_DIR/house-validator.timer" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable house-validator.timer house-worker.service
sudo systemctl start house-validator.timer
# Also apply changed paths/configuration when installing again.
sudo systemctl restart house-worker.service
sudo systemctl is-active house-worker.service house-validator.timer
sudo systemctl list-timers house-validator.timer --no-pager
echo "Installed. Worker starts at boot; validator keeps its existing timer schedule."
