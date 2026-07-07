#!/usr/bin/env bash

set -u

HEALTHCHECK_URL="https://hc-ping.com/af4476eb-2f53-40ce-8a32-8b0ce6b14f69"
PROJECT_DIR="/home/beigelman/dev/house-crawler"
DENO_BIN="/home/beigelman/.local/share/mise/installs/deno/2.8.3/bin/deno"
CURL_BIN="/usr/bin/curl"

ping_healthcheck() {
    "$CURL_BIN" -fsS --retry 3 --max-time 10 "$1" >/dev/null || true
}

ping_healthcheck "$HEALTHCHECK_URL/start"

if cd "$PROJECT_DIR"; then
    "$DENO_BIN" task validate
    status=$?
else
    status=1
fi

if [ "$status" -eq 0 ]; then
    ping_healthcheck "$HEALTHCHECK_URL"
else
    ping_healthcheck "$HEALTHCHECK_URL/fail"
fi

exit "$status"
