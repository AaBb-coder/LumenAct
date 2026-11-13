#!/usr/bin/env sh
set -eu
preview_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
python3 -m pip install -r "$preview_root/requirements.txt"
