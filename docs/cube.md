# Cubes and bonus potential

How the app prices "cube this item until you get these lines". Code: `src/modules/cube.ts` (potential) and
`src/modules/bpot.ts` (bonus potential).

## The big assumption: everything is already Legendary

The app assumes every item's potential and bonus potential is already Legendary. It never prices tier-ups.
That keeps things simple, and it's true for the end-game players this tool is for.

## Potential (all servers)

**Cubes and prices**
- Heroic / Reboot: Glowing Cube 12M and Bright Cube 22M from the Heroic Cube Shop.
- Interactive: Glowing (1,200 NX) and Bright (2,200 NX). You enter what one costs you in mesos.
- Every use also pays the normal cubing fee (20 × item level², for example 800K at level 200).
- The "Cube sale" toggle takes 25% off the cube price. The fee stays the same.

**Odds.** Line chances come from Nexon's official KMS Red (= Glowing) and Black (= Bright) cube pages. A check in
Nov 2026 found all 108 line tables identical to Nexon's live page. GMS items above level 150 get the higher
values (13% instead of 12%), which the MapleStory Wiki confirms is the GMS rule.

**What can't be cubed.** Pocket items, badges and Black Heart have no potential, so they never get a cube step.

**Targets the app offers**
- Armor and accessories: your main stat % adding up to a number (All Stat % counts), shown as "30%+ STR".
  Xenon uses an all-stat equivalent and Demon Avenger uses HP %.
- Hats: also cooldown lines ("−2s CD"). Gloves: also crit damage lines ("2× Crit Dmg").
- Weapons, secondaries, emblems: ATT % totals, plus mixes of ATT / Boss / IED lines.
- Targets your current lines already meet are skipped.

**Cost.** Each target's cost is the cube price divided by the chance of hitting it in one cube. That average is
exact. The app picks whichever cube is cheaper for that target: usually Glowing, and Bright for rare targets
such as two crit damage lines. The step names the cube to use.

**Higher rungs.** The plan shows the cheapest target on an item first, then its better targets as later steps
priced at their full cost again (a new target means cubing from scratch), with the FD gain measured from the
previous rung. So gloves get "1× Crit Dmg" and then "2× Crit Dmg" as two steps.

Examples (Legendary item, default prices):

| Item | Target | Chance per cube | Avg cubes | Avg cost |
|---|---|---|---|---|
| Top, lv 150 | 21% stat (2 lines) | 2.05% | 49 | 0.61B |
| Top, lv 160+ | 30% stat (3 lines) | 0.25% | 406 | 5.08B |
| Accessory, lv 160+ | 30% stat | 0.55% | 182 | 2.27B |
| Gloves, lv 160+ | 2 crit damage lines | 0.26% | 387 | 8.71B |
| Weapon, lv 200 | 23% ATT (2 lines) | 0.68% | 147 | 1.88B |
| Weapon, lv 200 | ATT + Boss + IED | 0.29% | 340 | 4.36B |

## Bonus potential (Interactive only)

Heroic / Reboot worlds don't have bonus potential, so this only shows up when your server is Interactive.

**Cubes and prices.** Bonus Glowing Cube (2,400 NX) and Bonus Bright Cube (3,500 NX). You enter the meso price.
The defaults use 10,000 mesos per NX (24M and 35M). Both cubes have the same odds, so the app uses the cheaper one.

**Odds.** From Nexon's official KMS page for the Additional Cube. That's the same item (ID 5062500) as GMS's
Bonus Glowing Cube. We fetched it for all 20 equipment types. Two things stand out:
- Lines 2 and 3 are rarely "prime". On a weapon, a Legendary-value second line shows up only about 0.5% of the time.
  This is why good bonus potential is so expensive.
- Bonus lines don't limit each other, so each of the 3 lines is rolled on its own.

GMS items at level 151+ use the higher-value table (for example 13% ATT instead of 12% on a weapon). For six item
types, Nexon's page has no high-level table (belt, emblem, secondary, overall, earring, heart). For those we add the
same step that every other type shows. We checked that this step reproduces all 12 types that do have the table.

**Targets: a bonus score.** Bonus potential mixes % lines, flat stat, flat ATT and "+2 LUK per 9 levels" lines.
So, like flames, the app gives each item a bonus score worked out from your own FD values. The score is counted in
"% main stat" (or "% ATT" on weapons, secondaries and emblems). The step tells you the formula and the most common
roll that hits it, for example:

> Bonus cube Arcane Umbra Weapon until bonus score ≥ 15 (most common hit: ATT 13% + LUK 10%)
> Use: Bonus Glowing Cube · Bonus score = ATT % + 0.26 × LUK % + 0.11 × flat ATT + …

The FD shown for a bonus step is the exact average over every roll that hits the target. Examples for the sample
Night Lord used in the tests (no bonus potential yet, default prices):

| Item | Target | Chance per cube | Avg cubes | Avg cost |
|---|---|---|---|---|
| Arcane weapon (lv 200) | score ≥ 15 (e.g. ATT 13% + LUK 10%) | 3.3% | 30 | 0.75B |
| Arcane weapon (lv 200) | score ≥ 23 (e.g. ATT 13% + ATT 10%) | 0.54% | 186 | 4.6B |
| CRA top (lv 150) | score ≥ 14 (e.g. ATT +14 + LUK 8%) | 1.0% | 99 | 2.4B |
| Endless Terror (lv 200) | score ≥ 15 (e.g. LUK 9% + LUK 7%) | 1.2% | 83 | 2.1B |

## What we can't prove

GMS doesn't publish its cube odds. Like every public calculator, we use Nexon's Korean (KMS) tables. The KMS and GMS
item IDs and line lists match, but the hidden odds could still differ.

## Checked against

- Nexon's official KMS cube pages (live, Nov 2026): every main potential line table matches.
- brendonmay's cubing calculator: 18 out of 18 target probabilities match exactly.
- maplestorycalculator.com: expected cube counts match.
- Bonus potential: recounting the chances by brute force over Nexon's raw rows (weapon, top and ring, several
  targets each) gives exactly the same numbers. A roll-by-roll simulation lands within about 1% on cost and FD
  (see validation.md).

## Sources

- [Nexon KMS cube probability pages](https://maplestory.nexon.com/Guide/OtherProbability/cube/red) (Red, Black, Additional)
- [MapleStory Wiki: Cube](https://maplestorywiki.net/w/Cube) (GMS cube names and NX prices), [Potential](https://maplestorywiki.net/w/Potential) (level bands, bonus potential is Interactive-only)
- [brendonmay cubing calculator](https://brendonmay.github.io/cubingCalculator/), [maplestorycalculator.com](https://maplestorycalculator.com/cubing-calculator/)
- [v.239 patch notes](https://www.nexon.com/maplestory/news/80182/updated-feb-8-v-239-neo-tokyo-patch-notes) (Heroic cube shop prices)
