#!/usr/bin/env bash
# Downloads the item icons used in src/data/items.ts and src/data/class-art.ts from maplestory.io into
# public/icons/<id>.png. Tries GMS v250 first, then v270 for items added later (Eternal shoes, newer weapons).
# Runs 8 downloads at a time; maplestory.io is slow at times, so rerun until it reports 0 missing.
set -uo pipefail
cd "$(dirname "$0")/.."
fetch_one() {
  id="$1"; out="public/icons/$id.png"
  [ -s "$out" ] && return 0
  for v in 250 270; do
    for try in 1 2; do
      if curl -fsS -m 20 "https://maplestory.io/api/GMS/$v/item/$id/icon" -o "$out" && [ -s "$out" ]; then return 0; fi
      rm -f "$out"; sleep 1
    done
  done
  echo "missing $id" >&2; return 1
}
export -f fetch_one
grep -ohE "\b1[0-9]{6}\b" src/data/items.ts src/data/class-art.ts | sort -u | xargs -P 8 -I{} bash -c 'fetch_one {}'
echo "$(ls public/icons | wc -l) icons; still missing: $(grep -ohE "\b1[0-9]{6}\b" src/data/items.ts src/data/class-art.ts | sort -u | while read id; do [ -s "public/icons/$id.png" ] || echo "$id"; done | wc -l)"
