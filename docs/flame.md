# Flames

How the app prices "flame this item until the score reaches N". Code: `src/modules/flame.ts`.

## How flaming works now (GMS v.271)

- You reset flames with mesos: **3M per reset** on any item, in every world (editable in Settings).
- The odds are the same as a Black Rebirth Flame.
- You choose to keep the old or the new flame, so you never go backwards.

So every flame step means "pay 3M a reset until you roll at least this score". There's no item to buy.

Rings, shoulders, badges, emblems, secondaries and hearts can't take flames, so the app never suggests flaming them.
Only weapons have an ATT field in the flame editor; armor flames are entered as stat lines.

## The odds

Boss items (almost everything end-game) always get 4 lines. Each line's tier is rolled separately:

| Tier | T4 | T5 | T6 | T7 |
|---|---|---|---|---|
| Chance | 29% | 45% | 25% | 1% |

The 4 lines are drawn from 19 possible line types, with no repeats. Weapons can roll Boss % and Damage %, while
armor rolls Speed and Jump instead. A few items aren't treated as boss items (the CRA hat, Gollux, Horntail Necklace,
Meister): they roll 1 to 4 lines at tiers 2 to 5.

What one tier is worth: at level 200 a single-stat line gives 11 per tier (T6 = 66), a dual-stat line gives 6 per
tier, armor ATT and All Stat % give 1 per tier, and Boss % gives 2 per tier.

## Flame score

The score turns a flame into one number in main-stat units, using **your own FD values**, so it fits your
character. For a STR class it comes out to roughly "STR + 0.1 × DEX + 5 × ATT + 12 × All Stat %". Each flame step
shows your exact formula.

The score only decides where the targets sit. The FD gain is worked out from the actual stats you'd expect when
you hit the target, so a slightly odd score can't make the FD number wrong.

## How the targets are chosen

- **Any upgrade:** the next whole number above your current score. If your flame scores 159.1, the target is
  "160+ Flame Score". The odds, flame count and cost are all computed at that whole number.
- **Higher rungs:** the scores at the top 50%, 25%, 10%, 5%, 2%, 1%, 0.5%, 0.2%, 0.1%, 0.05%, 0.02% and 0.01%
  of all possible flames, rounded up to a multiple of 5, skipping anything within 2.5 of your current score.
- **Weapons** get tier targets instead: ATT at T5 / T6 / T7, alone or together with a Boss % tier.

## How the cost is worked out

- If one reset has chance p of reaching the target, you need 1/p resets on average, so the cost is 3M / p.
- The flame you end up with is the average of all rolls that reach the target, so the FD gain is an average too.
  Some qualifying flames beat yours by a hair and some by a lot; the app prices the rule "stop at the first flame
  that reaches the target".
- The plan shows the rung with the best mesos per 1% FD first, then higher rungs on the same item as later steps
  priced at their full cost again, with the FD gain measured from the previous rung.

## Checked against

- Nexon's official KMS bonus-stat page (live, Nov 2026): tier odds, line counts and line types all match.
- WhackyBeanz flame tables: 210 out of 210 values match, including how weapon ATT rounds.
- devcomma's KMS flame calculator: 48 out of 48 probabilities match.
- MathBro's flame calculator: 7 out of 7 average flame counts match.
- MapleStory Wiki (Bonus Stats): 3M reset with Black odds, and the non-boss tier table.
- A hand recount of the Gollux belt flame (a non-boss item): 8.35% per flame against the app's 8.36%.

## Open questions

- Level 250 single stat: 12 or 13 per tier? Most GMS tools say 12, one KMS tool says 13. We use 12.
- Some tools include Speed and Jump on weapons (21 line types). Nexon's table says 19, which we follow.
- Armor flames can roll flat ATT in the game. The app scores it but doesn't offer it as an input field, because
  it is never worth aiming for on armor.

## Sources

- [v.271 patch notes (flame revamp)](https://www.nexon.com/maplestory/news/update/44597/v-271-maple-story-x-frieren-beyond-journey-s-end-patch-notes)
- [Nexon KMS bonus-stat odds](https://maplestory.nexon.com/Guide/OtherProbability/game/gameAddOption)
- [MapleStory Wiki: Bonus Stats](https://maplestorywiki.net/w/Bonus_Stats)
- [WhackyBeanz flame calculator](https://www.whackybeanz.com/calc/equips/flames), [devcomma](https://tools.devcomma.com/calculators/maple-additional-option), [MathBro](https://brendonmay.github.io/flameCalculator/)
