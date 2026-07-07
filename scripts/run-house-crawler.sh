#!/usr/bin/env bash

set -u

HEALTHCHECK_URL="https://hc-ping.com/4896170a-1382-4216-89dd-42c937ba245e"
PROJECT_DIR="/home/beigelman/dev/house-crawler"

ping_healthcheck() {
    curl -fsS --retry 3 --max-time 10 "$1" >/dev/null || true
}

ping_healthcheck "$HEALTHCHECK_URL/start"

if cd "$PROJECT_DIR"; then
    deno task run
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
