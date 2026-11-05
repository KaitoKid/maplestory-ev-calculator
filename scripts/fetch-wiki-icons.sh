#!/usr/bin/env bash
# Downloads item icons that maplestory.io does not serve (newer items) from the MapleStory Wiki media host
# into public/icons/<Eqp_Name>.png. Names come from the string icon ids in src/data/items.ts.
set -euo pipefail
cd "$(dirname "$0")/.."
names=$(grep -oE "'Eqp_[A-Za-z0-9_-]+'" src/data/items.ts | tr -d "'" | sort -u)
for n in $names; do
  out="public/icons/$n.png"
  [ -s "$out" ] && continue
  src="${n/PrincessNo_/Princess_No%27s_}" # local names drop the apostrophe
  curl -fsS -m 30 "https://media.maplestorywiki.net/yetidb/$src.png" -o "$out" || { rm -f "$out"; echo "missing $n" >&2; }
done
ls public/icons | wc -l
