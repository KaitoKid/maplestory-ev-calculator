# How this app was built

This page explains the process behind the numbers: where each rule comes from, how the maths works, and how
we made sure it is right. If you only read one doc, read this one.

## The idea

Every upgrade in MapleStory is a bet: you pay mesos for a chance at a better item. The app turns each bet into
two numbers, what it costs on average and how much Final Damage you get on average, and ranks every bet on every
item by **mesos per 1% Final Damage**. The cheapest FD is the thing to do next.

That only works if three things are right: the game rules, the odds, and the way stats turn into Final Damage.
Each was handled the same way.

## Step 1: write down the rules

For each system (Star Force, cubes, bonus potential, flames) we wrote down the current GMS rules in plain
English first, before any code. The rules came from Nexon's patch notes and the MapleStory Wiki, and
the writeups live in `docs/`:

- [Star Force](starforce.md): v.271 rules, star catch always on, Enhancement Mode, where booms send you.
- [Cubes and bonus potential](cube.md): cube prices, the cubing fee, which lines each item type can roll.
- [Flames](flame.md): 3M meso resets with Black flame odds, which items can't be flamed.

Where a rule has no official source (Enhancement Mode rates were measured by players), the doc says so.

## Step 2: take the odds from Nexon

Nexon publishes the probability of every potential line, bonus potential line and flame tier for KMS. GMS uses the
same items and line lists, so like every public calculator we use those tables. They were downloaded straight from
Nexon's pages, not copied from other tools, and `scripts/bpot/` can rebuild the bonus potential tables from the
page at any time. Star Force rates and costs come from the MapleStory Wiki, which publishes the GMS tables.

## Step 3: do the maths exactly

The app does not simulate when you press Calculate. It works out the exact average:

- **Star Force** is a chain of states (each star, with success / fail / boom at each step). The app solves that
  chain for the exact expected cost, including booms and the re-climb after a boom.
- **Cubes** enumerate every combination of three lines with its probability, so "chance of 30%+ STR per cube" is
  an exact sum, and the cost is the cube price divided by that chance.
- **Flames** enumerate every combination of lines and tiers the same way.
- **Final Damage** for a change comes from your own FD values, combined the way the game's damage formula combines
  them (stat, ATT, Boss / Damage %, crit damage and IED are separate parts that multiply).

Because each target's FD gain is the average over the rolls that qualify, not the target itself, the gain is honest
about what you actually end up with.

## Step 4: check every part on its own

Each module has tests (`npm test`, 68 of them) that compare its output with the official data and with other
calculators players already trust:

- Star Force against starforce.tadeucci.dev (their code, run on 252 of our cases), maple-mochachai, the BlueMagic
  22→25★ benchmark, the wiki's rate and cost tables, and attempt costs players quoted in game.
- Cube odds against Nexon's live pages (all 108 line tables identical) and brendonmay's cubing calculator.
- Flame odds and values against Nexon's live page, WhackyBeanz, devcomma and MathBro.
- FD against the damage formula on characters built from scratch.

The full list with results is in [validation.md](validation.md).

## Step 5: check the plan roll by roll

A separate script (`npx tsx scripts/simulate.ts`) takes the Sample character and plays out the top steps the way a
player would: Star Force attempt by attempt with real booms and the chosen modes, cubes rolled until the target
hits, flames rolled until the target hits, 20,000 times each. It then compares the simulated average cost and FD
with what the app printed. Every step lands within about 1.5%, which is the random noise you expect at 20,000 runs.

## Step 6: hand checks on real cases

When a result looked wrong to a real player, we checked it by hand against independent sources. For example,
the Gollux belt flame ("only 4 flames to beat the current one?") was recounted from scratch: the independent
count gave 8.35% per flame against the app's 8.36%, and the MapleStory Wiki confirmed the tier table it depends on.

## What we can't prove

- GMS does not publish cube or flame odds. We use Nexon's Korean tables, like every public calculator. The items and
  line lists match, but the hidden odds could still differ.
- Enhancement Mode success and boom rates were measured by players. Nexon hasn't published them.
- Weapons stop at 25★ because nobody has published 26 to 30★ weapon ATT yet. Destiny weapons use the level 200
  weapon ATT-per-star table, because no level 250 column has been published either.
- Your FD values are only as good as the tool you read them from. Rounding there is the biggest source of error.

## Sources

Official
- [Nexon KMS cube probability pages](https://maplestory.nexon.com/Guide/OtherProbability/cube/red) (Red, Black, Additional)
- [Nexon KMS bonus-stat (flame) odds](https://maplestory.nexon.com/Guide/OtherProbability/game/gameAddOption)
- [v.269 patch notes (Enhancement Mode)](https://www.nexon.com/maplestory/news/update/41138/v-269-ride-the-lightning-patch-notes)
- [v.271 patch notes (star catch removed, flame revamp)](https://www.nexon.com/maplestory/news/update/44597/updated-9-29-v-271-maple-story-x-frieren-beyond-journey-s-end-patch-notes)
- [v.239 patch notes (Heroic cube shop prices)](https://www.nexon.com/maplestory/news/80182/updated-feb-8-v-239-neo-tokyo-patch-notes)

Community references
- [MapleStory Wiki](https://maplestorywiki.net/): Star Force Enhancement, Cube, Potential, Bonus Stats, Damage Formula
- [starforce.tadeucci.dev](https://starforce.tadeucci.dev), [maple-mochachai](https://maple-mochachai.pages.dev/star_force)
- [brendonmay cubing calculator](https://brendonmay.github.io/cubingCalculator/), [maplestorycalculator.com](https://maplestorycalculator.com/cubing-calculator/)
- [WhackyBeanz flames](https://www.whackybeanz.com/calc/equips/flames), [devcomma](https://tools.devcomma.com/calculators/maple-additional-option), [MathBro flames](https://brendonmay.github.io/flameCalculator/)
- Item art: [maplestory.io](https://maplestory.io) and the MapleStory Wiki (© NEXON)
