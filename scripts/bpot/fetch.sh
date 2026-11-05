#!/usr/bin/env bash
# Rebuilds src/modules/bpot.data.ts from Nexon's official KMS Additional Cube page
# (item 5062500 = GMS Bonus Glowing Cube), Legendary rank, all 20 equipment types.
#   bash scripts/bpot/fetch.sh
set -euo pipefail
cd "$(dirname "$0")"
tmp=$(mktemp -d)
for lv in 150 160 200 250; do for p in $(seq 1 20); do
  curl -sS -A "Mozilla/5.0" -X POST -H "X-Requested-With: XMLHttpRequest" \
    --data "nCubeItemID=5062500&nGrade=4&nPartsType=$p&nReqLev=$lv" \
    -o "$tmp/L${lv}_p${p}.html" "https://maplestory.nexon.com/Guide/OtherProbability/cube/GetSearchProbList"
  sleep 0.3
done; done
python3 -I parse.py "$tmp" kms-additional-cube-legendary.json
python3 -I gen.py kms-additional-cube-legendary.json ../../src/modules/bpot.data.ts
