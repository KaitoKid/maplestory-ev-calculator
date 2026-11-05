# MapleStory EV Calculator

Tells you which upgrade to do next, and on which item, ranked by **billion mesos per 1% Final Damage**.
It covers Star Force, cubes, bonus potential cubes (Interactive only) and flames, for end-game GMS players.
You type everything in yourself. Nothing leaves your browser.

**Live:** https://kaitokid.github.io/maplestory-ev-calculator/

## How to use it

1. **Character tab.** Pick your class, level and server (Heroic / Reboot, or Interactive).
2. **FD values.** Fill in how much % Final Damage each stat gives you, for example "+100 STR gives 0.8% FD".
   Read them off MapleScouter or any stat-equivalence tool. One row covers Boss % and Damage %, because they are
   worth the same against bosses. The "Cooldown −s" row is optional: leave it blank and cooldown lines add nothing.
3. **Equipment.** Click a slot, pick the item, then set its stars, potential lines and flame. Picking a different
   item clears those, because they belong to the old item. The art follows your class: armor sets show your job
   branch's version and weapons show your weapon type.
4. **Settings tab.** Check the Star Force defaults, cube prices and meso per flame. The defaults are what most
   players do; change what is different for you.
5. **Calculate.** The plan appears on the right, cheapest FD first.

Your setup is saved in your browser. Use Export / Import to move it to another device, or load the Sample to see
a finished setup.

## Reading the plan

Each step is one action on one item, for example "Star Force Berserked 22★ → 23★" or
"Cube Eternal Gloves → 2× Crit Dmg". Open a step to see:

- **Expected cost.** The average mesos to reach that target, starting from the item as it is now.
  Also the median and 75th-percentile cost, so you can see how unlucky it can get.
- **FD gain.** How much Final Damage you gain on average when you stop at that target.
- **B meso per 1% FD.** Expected cost divided by FD gain. The plan is sorted by this number: lower is better value.
- **Target.** What you are aiming for, in the game's own terms: "30%+ STR", "148+ Flame Score", "2× Crit Dmg".
- **Now.** What the item has today.

A few things to know:

- **Targets are "at least".** "Cube until 30%+ STR" means stop at the first roll with 30% or more. The cost is
  the average over everyone who follows that rule, and the FD gain is the average of the rolls that qualify.
- **Higher rungs chain.** With "Chain steps per item" on (the default), the cheapest target on an item comes
  first and better targets on the same item show up later, priced at the extra cost from the previous rung.
  So "2× Crit Dmg" on gloves is a step after "1× Crit Dmg", not hidden behind it.
- **Steps on different items don't chain.** Each is priced from your gear as it is now. After every upgrade,
  update that item and press Calculate again. The banner tells you when the plan is out of date.
- **Boom warning.** Star Force steps past 22★ can boom. Those costs already include the average cost of a
  spare item re-starred with your settings, and the step carries a ⚠ to say so.
- **Costs are averages.** Your real result will be luckier or unluckier.

## What it assumes

- **Star Force:** current GMS rules (v.271). 30★ cap, failed attempts keep the star, star catch always on,
  Enhancement Mode. By default normal items use modes 1-1-4-4 at 18 to 21★, Pitched and Brilliant items use
  4-4-4-4, and 15 to 17★ are safeguarded. All of this is editable. Booms cost nothing extra on Heroic / Reboot.
  On Interactive you enter what a replacement item costs. Badges and Black Heart can't be starred. Destiny stage 2
  weapons star from 22★ to 25★ with a 10B replacement per boom in every world.
- **Cubes:** every item is already Legendary, so there are no tier-ups. Heroic uses Glowing (12M) and
  Bright (22M) cubes from the Heroic Cube Shop; on Interactive you enter what each cube costs. Pocket items,
  badges and Black Heart can't be cubed.
- **Bonus potential:** Interactive only. Bonus Glowing / Bonus Bright cubes, priced by you.
- **Flames:** 3M meso resets with Black Rebirth Flame odds, keeping the better result. Every flameable item has
  an ATT (or MATT) field, because armor and accessories can roll flat ATT too; Boss % and Damage % are weapon-only.
- **Final Damage:** only from the FD values you enter. The app never reads your stat window.

## How it was built and checked

The short version: the game rules come from Nexon's patch notes and the MapleStory Wiki, the odds come from
Nexon's own probability pages, the maths is exact rather than simulated, and every part was then compared with
official data, with other public calculators, and with a roll-by-roll simulation of the plan itself.
Everything matched to within normal random noise.

- [How this app was built](docs/process.md): the process, the sources and what we can't prove.
- [How we checked the numbers](docs/validation.md): every comparison, with the results.
- The maths of each part, in plain language: [Star Force](docs/starforce.md), [cubes and bonus potential](docs/cube.md),
  [flames](docs/flame.md), [how FD is worked out](docs/fd-from-rows.md).

## For developers

```sh
npm install
npm run dev      # local dev server
npm test         # all tests
npm run build    # static site in dist/
npx tsx scripts/simulate.ts   # roll-by-roll check of the plan
```

Vite + TypeScript with no runtime dependencies. The ranking runs in a Web Worker so the page never freezes.

- `src/modules/` holds the Star Force, cube, bonus potential, flame and FD code. Each module has its own doc in `docs/`.
- `src/engine/` turns module results into the ranked plan and the step wording.
- `src/data/items.ts` is the item list, `src/data/class-art.ts` the per-class icon ids, `src/data/sample.json` the Sample setup.
- `src/main.ts` and `src/style.css` are the whole UI.
- `scripts/bpot/` rebuilds the bonus potential tables from Nexon's page, `scripts/fetch-icons.sh` and
  `scripts/fetch-wiki-icons.sh` download the item art, `scripts/simulate.ts` is the simulation.

Pushing to `main` runs the tests, builds the site and deploys it to GitHub Pages.

## Credits

Item art and the equipment window © NEXON, served from maplestory.io and the MapleStory Wiki.
Not affiliated with NEXON. Licensed under Apache 2.0.
