# Star Force

How the app prices a Star Force step, in plain terms. Code: `src/modules/starforce.ts`.

## The rules we use (GMS v.271, Nov 2026)

- Items go up to 30★ (weapons only to 25★ for now, because nobody has published 26 to 30★ weapon ATT yet;
  Plasma Heart stops at 20★ and the Astra secondary at the phase you pick).
- A failed attempt keeps the star. It never drops.
- Star catch is gone, and its bonus is always applied. In practice the success chance is the published rate × 1.05.
- A boom brings the item back with fewer stars: 15 to 19★ go to 12★, 20★ to 15★, 21 to 22★ to 17★, 23 to 25★ to 19★,
  and 26 to 30★ to 20★. Flames and potential stay.
- **Heroic / Reboot:** a boom costs nothing extra. **Interactive:** you enter what a replacement item costs, per set.
- Safeguard (15 to 17★) removes the boom chance and costs three times a normal attempt (before discounts).
- Enhancement Mode levels 2 to 4 (15 to 21★) cost more per attempt and lower the boom chance. Level 4 can't boom.
- Badges, Black Heart and the sealed Genesis weapon can't be starred. Liberated Genesis weapons are fixed at 22★.
- Destiny weapons (Lv 250): stage 1 is fixed at 22★. Stage 2 can go from 22★ to 25★, and a boom is replaced by the
  10B box from the Ark of Determination (a fresh stage-2 weapon at 22★), in every world including Heroic.
- Astra secondaries unlock stars in phases. Pick the phase you have (15★, 20★ or 30★) and the plan only stars that far.

Success and boom chances for each star (the rest of the time the star stays):

| Star | Success | Boom |
|---|---|---|
| 15-16 | 31.5% | 2.1% |
| 17-18 | 15.75% | 6.7% |
| 19 | 15.75% | 8.4% |
| 20 | 31.5% | 10.3% |
| 21 | 15.75% | 12.6% |
| 22 | 15.75% | 16.9% |
| 23-25 | 10.5% | 17.9% |

## The default habits (editable)

These describe what players normally do. Change them in Settings if yours differ.

| Items | Enhancement Mode at 18 / 19 / 20 / 21★ |
|---|---|
| Pitched and Brilliant boss items | 4-4-4-4 (never boom) |
| Everything else | 1-1-4-4 (normal at 18 to 19★, no-boom at 20 to 21★) |

Safeguard is on at 15 to 17★. You can change both profiles, turn safeguard off, or let the app pick the cheapest
option at each star ("Optimise").

## Discounts

- MVP (3 / 5 / 10%) applies up to 16→17★ and stacks with Shining Star Force (30% off).
- 30% off also applies to Enhancement Mode. The safeguard extra is never discounted.
- The 1+1 event gives +2★ on a success at 10★ or below.

## How the cost is worked out

Each star is a state. From it an attempt succeeds, fails (same star) or booms (back to a lower star, then climb
again with the same settings). The app solves this chain for the exact average cost over every possible sequence,
so "expected cost" is exact, not simulated. The median and 75th percentile come from a small seeded simulation.

Past 22★ a boom is likely enough that the step shows a ⚠: the cost already includes the average cost of a spare
item, re-starred with your settings. On Heroic that spare costs only its attempts; on Interactive it also costs
the replacement price you entered.

Examples at level 200, attempt mesos only (Heroic):

| Range | No events | With Shining Star Force |
|---|---|---|
| 0→17★ | 1.62B | 1.11B |
| 17→22★ | 31.3B | 15.2B |
| 22→23★ | 34.7B | 17.1B |

## Checked against

- starforce.tadeucci.dev: we ran their own code on 252 cases and every one matches ours exactly.
- maple-mochachai and the BlueMagic 22→25★ benchmark: match.
- MapleStory Wiki (Star Force page, Sep 2026): all 60 published rates and all 150 base costs match.
- In-game attempt costs quoted by players: match to the meso.

maple-mochachai was last updated before Enhancement Mode, so it can only check normal-mode costs.

## Known gaps

- No 26 to 30★ for weapons yet.
- Enhancement Mode numbers were measured by players. Nexon hasn't published them.
- Superior (Tyrant) items use their own table, which hasn't been cross-checked.

## Sources

- [MapleStory Wiki, Star Force Enhancement](https://maplestorywiki.net/w/Star_Force_Enhancement)
- [v.269 patch notes (Enhancement Mode)](https://www.nexon.com/maplestory/news/update/41138/v-269-ride-the-lightning-patch-notes)
- [v.271 patch notes (star catch removed)](https://www.nexon.com/maplestory/news/update/44597/updated-9-29-v-271-maple-story-x-frieren-beyond-journey-s-end-patch-notes)
- [starforce.tadeucci.dev](https://starforce.tadeucci.dev), [maple-mochachai](https://maple-mochachai.pages.dev/star_force)
