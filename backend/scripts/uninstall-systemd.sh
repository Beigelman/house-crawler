#!/usr/bin/env bash

set -euo pipefail

if [[ "$(uname -s)" != Linux ]] || ! command -v systemctl >/dev/null; then
    echo "This uninstaller requires Linux with systemd." >&2
    exit 1
fi

# Include the old units for hosts migrating from the previous setup.
for unit in house-worker.service house-validator.timer house-validator.service house-crawler.timer house-crawler.service; do
    if sudo systemctl cat "$unit" >/dev/null 2>&1; then
        sudo systemctl disable --now "$unit"
    fi
    sudo rm -f "/etc/systemd/system/$unit"
done
sudo systemctl daemon-reload
echo "Services removed. Repository files and .env were preserved."
