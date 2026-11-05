# How we checked the numbers

Two kinds of checks, both rerunnable from this repo. Everything below was last run on 2026-11-05.

## 1. Each part against official data and other calculators

`npm test` runs 68 tests. They all pass.

| Part | Checked against | Result |
|---|---|---|
| Star Force cost | starforce.tadeucci.dev (their own code, run on our cases), maple-mochachai, the BlueMagic benchmark, in-game attempt costs | 252/252 tadeucci cases exact; the rest match |
| Star Force rates and costs | MapleStory Wiki, Star Force page (Sep 2026) | 60/60 rates and 150/150 base costs exact |
| Star Force stats | MapleStory Wiki stat tables | 6/6 exact |
| Cube odds | Nexon's official KMS cube pages (live, Nov 2026); brendonmay's cubing calculator | All 108 line tables identical; 18/18 probabilities exact |
| Cube cost | maplestorycalculator.com | Cube counts match |
| Bonus potential odds | Nexon's official KMS Additional Cube page (the same item as GMS's Bonus Glowing Cube) | Tables taken straight from it; a brute-force recount gives the same chances |
| Flame odds | Nexon's official KMS bonus-stat page (live, Nov 2026); devcomma | All odds identical; 48/48 probabilities match |
| Flame values | WhackyBeanz tables; MathBro flame calculator | 210/210 exact; 7/7 averages match |
| Flame on a non-boss item | Hand recount of the Gollux belt flame; MapleStory Wiki tier table | 8.35% per flame vs the app's 8.36% |
| FD from your rows | The GMS damage formula (MapleStory Wiki) | Exact for potential, Star Force, ATT, boss, IED and crit changes; within 0.7% of the gain otherwise (see fd-from-rows.md) |

A note on the other calculators: maple-mochachai predates Enhancement Mode, so it can only check normal-mode Star Force.
maplestorycalculator.com uses the same cube tables as brendonmay, so the two aren't independent of each other.
That's why the official Nexon pages are the main reference.

## 2. The plan itself, roll by roll

`npx tsx scripts/simulate.ts` takes the sample Night Lord in `tests/fixtures.ts` and replays the top recommended steps
20,000 times each. Star Force goes attempt by attempt with booms and the chosen safeguard and mode, cubes roll lines
until the target hits, and flames roll lines and tiers until the target hits. Bonus potential uses an Interactive copy
of the same character. FD is computed on every actual result, not on an average.

| Action | Avg cost (app) | Avg cost (simulated) | FD (app) | FD (simulated) |
|---|---|---|---|---|
| SF Berserked 17★ → 18★ | 1.275B | 1.266B | 0.590% | 0.590% |
| SF Magic Eyepatch 17★ → 18★ | 1.275B | 1.260B | 0.590% | 0.590% |
| SF Source of Suffering 17★ → 18★ | 1.275B | 1.275B | 0.590% | 0.590% |
| SF Arcane Umbra Shoes 17★ → 18★ | 2.489B | 2.502B | 0.687% | 0.687% |
| SF Arcane Umbra Shoes 17★ → 22★ | 42.100B | 42.338B | 3.890% | 3.890% |
| SF Arcane Umbra Gloves 17★ → 22★ | 42.100B | 42.328B | 3.890% | 3.890% |
| Cube Class Secondary 1L Boss + 1L IED (+any) | 0.397B | 0.400B | 1.435% | 1.434% |
| Cube Gold Maple Leaf Emblem 2L IED (+any) | 0.541B | 0.540B | 1.495% | 1.500% |
| Cube Arcane Umbra Weapon 2L IED (+any) | 0.711B | 0.707B | 1.213% | 1.220% |
| Cube Class Secondary 2L IED (+any) | 0.934B | 0.940B | 1.095% | 1.114% |
| Cube Arcane Umbra Weapon 1L Boss + 2L IED | 7.224B | 7.246B | 5.416% | 5.420% |
| Flame Pink Holy Cup 66+ Flame Score (any upgrade) | 14.9M | 14.8M | 0.178% | 0.179% |
| Flame Pink Holy Cup 85+ Flame Score | 31.4M | 31.3M | 0.292% | 0.292% |
| Flame Pink Holy Cup 100+ Flame Score | 69.0M | 68.9M | 0.391% | 0.392% |
| Flame Pink Holy Cup 115+ Flame Score | 183.6M | 183.5M | 0.494% | 0.494% |
| Flame Arcane Umbra Gloves 117+ Flame Score (any upgrade) | 71.6M | 71.2M | 0.152% | 0.149% |
| Bonus Arcane Umbra Weapon Bonus score > 14.3 (any upgrade) | 0.640B | 0.641B | 1.205% | 1.209% |
| Bonus Arcane Umbra Weapon Bonus score ≥ 15 | 0.751B | 0.750B | 1.390% | 1.392% |
| Bonus Arcane Umbra Weapon Bonus score ≥ 19 | 1.952B | 1.931B | 2.557% | 2.558% |
| Bonus Eagle Eye Top (CRA) Bonus score > 15.7 (any upgrade) | 7.548B | 7.457B | 0.175% | 0.175% |
| Bonus Eagle Eye Top (CRA) Bonus score ≥ 18 | 19.776B | 19.790B | 0.317% | 0.316% |
| Bonus Endless Terror Bonus score ≥ 6 | 0.079B | 0.078B | 0.767% | 0.768% |
| Bonus Endless Terror Bonus score ≥ 8 | 0.208B | 0.208B | 1.002% | 1.004% |

Every simulated cost and FD lands within 1.7% of what the app shows. At 20,000 runs that's normal random noise.
Badges no longer get cube steps (they can't be cubed), which is why they are absent from this table.

## What this can't prove

- GMS doesn't publish cube or flame odds. Like every public calculator, we use Nexon's Korean tables.
- Enhancement Mode numbers were measured by players. Nexon hasn't published them.
- Weapons stop at 25★ because nobody has published 26 to 30★ weapon ATT yet.
- Steps on different items are each priced from your gear as it is now, so recalculate after every upgrade.
