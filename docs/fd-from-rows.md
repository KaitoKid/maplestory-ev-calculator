# How Final Damage is worked out

The app's only damage input is your FD table on the Character tab. Each row says "adding this much of a stat gives
me this much % Final Damage", for example "+100 STR → 0.8% FD". You read them off MapleScouter or any
stat-equivalence tool. The app never looks at your stat window.

The rows are: main stat, main stat %, secondary stat, secondary stat % (classes with one), ATT, ATT %,
Boss / Damage %, one extra IED line, Crit Damage %, and an optional "Cooldown −s" row.

- **Boss % and Damage %** share one row because they are worth the same per point against bosses.
- **Cooldown −s** is optional. Fill it in if you know what one second of cooldown reduction is worth to you;
  leave it blank and cooldown lines are treated as worth nothing (the plan says so when that hides a hat option).

## Pricing a change with several stats at once

In GMS, damage is made of separate parts that multiply together (MapleStory Wiki, Damage Formula):

```
damage ∝ stat value × ATT × (1 + Damage % + Boss %) × (1.35 + Crit Damage %) × (1 − enemy defense left after IED)
```

Each row tells the app how big one part is for you right now. When an upgrade changes several stats (for example you
lose a 9% STR line and gain an ATT % line plus an IED line), the app works out how much each part grows and
multiplies them. Two details:

- IED stacks multiplicatively, so two 40% IED lines are worth less than twice one line. The IED row lets the app
  work out how much defense you have left, so this comes out right.
- Flat ATT and ATT % multiply each other, and the app includes that.

## How accurate it is

We built test characters straight from the damage formula, read their rows the way a player would, and compared the
app's answer with the formula for many different upgrades:

- Potential lines, Star Force, ATT, Boss, IED and crit damage changes: exact.
- Changes that add flat stat and stat % of the same stat together (a flame with All Stat %): within 0.7% of the gain.
- Large flat ATT and ATT % together, on a character with ATT that % doesn't boost: within 0.4% of the gain.

Both of those are much smaller than the rounding in any FD value you type in.
