#!/usr/bin/env bash

set -u

HEALTHCHECK_URL="https://hc-ping.com/af4476eb-2f53-40ce-8a32-8b0ce6b14f69"
PROJECT_DIR="/home/beigelman/dev/house-crawler"

ping_healthcheck() {
    curl -fsS --retry 3 --max-time 10 "$1" >/dev/null || true
}

ping_healthcheck "$HEALTHCHECK_URL/start"

if cd "$PROJECT_DIR"; then
    deno task validate
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
