#!/bin/bash
# 2h drip: +200 sample maps toward 1M (silent background run).
set -e
cd "$(dirname "$0")/.."
git pull -q --ff-only origin main || true
python3 code/gen_maps.py --n 200
python3 code/build_pages.py >/dev/null
python3 code/build_meta.py
git add -A
git -c user.name="JAH System" -c user.email="jah@spacemap.local" commit -qm "Map drip: +200 samples" || true
git push -q origin main
echo "DRIP OK"
