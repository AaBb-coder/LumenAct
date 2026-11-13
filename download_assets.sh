#!/usr/bin/env sh
set -eu
preview_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec python3 "$preview_root/download_assets.py" "$@"
