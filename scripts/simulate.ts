// Monte Carlo cross-check of the ranking: replays the top recommended actions roll by roll
// and compares the simulated mean cost / mean FD gain with what the ranking reports.
//   npx tsx scripts/simulate.ts [runs]
// Starforce: simulated attempt by attempt with the module's per-star rates and chosen policy.
// Cubes: lines sampled from the cube tables until the target is hit; FD computed on each actual roll.
// Flames: 4 lines drawn without replacement + tiers sampled until the target is hit; FD on each roll.
// Bonus potential (Interactive copy of the setup): 3 independent lines drawn from Nexon's raw rows
// until the bonus score target is hit; FD computed on each actual roll.

import { rank, effectiveMarket } from '../src/engine/rank';
import { CLASS_BY_ID } from '../src/modules/damage.data';
import { damageModule } from '../src/modules/damage';
import { starforceModule, starActions, optionsFromMarket, type SfOptions } from '../src/modules/starforce';
import { cubeModule, enumerate, buildSpecs, tableSlotFor, unitCost, type Outcome } from '../src/modules/cube';
import {
  flameModule, linePool, tierOdds, lineStats, specFromItem, scoreBundle, flameWeightsFromStatWeights,
} from '../src/modules/flame';
import { linesToBundle, addBundles } from '../src/core/bundle';
import { ITEM_BY_ID } from '../src/data/items';
import { sampleNightLord } from '../tests/fixtures';
import type { Candidate, PotLine, StatBundle } from '../src/core/types';
import { BONUS_LEGENDARY_LINES } from '../src/modules/bpot.data';
import { bonusScore, bonusSlotFor, bonusUnitCost, isAttTable, scoreUnit } from '../src/modules/bpot';

const RUNS = Number(process.argv[2] ?? 20000);
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

const setup = sampleNightLord();
const cls = CLASS_BY_ID['night-lord'];
const modules = { damage: damageModule, starforce: starforceModule, cube: cubeModule, flame: flameModule };
const r = rank(setup, cls, modules);
const eq = setup.equivalences;

const pct = (a: number, b: number) => `${(((a - b) / b) * 100).toFixed(2)}%`;
const rows: string[][] = [];

// ---------------- Starforce ----------------
function simStarforce(c: Candidate) {
  const equip = setup.equips[c.slot]!;
  const item = ITEM_BY_ID[equip.itemId];
  const to = Number(c.label.split('→')[1].replace('★', ''));
  const market = effectiveMarket(setup.market);
  const opts: SfOptions = optionsFromMarket(item, market);
  const det = starforceModule.costDetailed(item, equip.stars, to, market);
  const policy = new Map(det.policy.map((p) => [p.star, p]));
  const repl = opts.replacementCost ?? 0;
  let total = 0, booms = 0;
  for (let i = 0; i < RUNS; i++) {
    let s = equip.stars;
    while (s < to) {
      const want = policy.get(s);
      const ts = starActions(item.level, s, opts);
      const t = ts.find((x) => want && x.action.mode === want.mode && x.action.safeguard === want.safeguard) ?? ts[0];
      total += t.cost;
      const u = rnd();
      if (u < t.success) s = t.next;
      else if (u < t.success + t.boom) { total += repl; booms++; s = t.boomTo; }
    }
  }
  rows.push([`SF ${item.name} ${c.label}`, `${(c.expectedCost / 1e9).toFixed(3)}B`, `${(total / RUNS / 1e9).toFixed(3)}B`, pct(total / RUNS, c.expectedCost),
    `${c.fdGain.toFixed(3)}%`, `${c.fdGain.toFixed(3)}% (deterministic)`, `booms ${(det.expectedBooms ?? 0).toFixed(3)} vs ${(booms / RUNS).toFixed(3)}`]);
}

// ---------------- Cubes ----------------
const CAT_KEY: Record<string, PotLine['key'] | undefined> = {
  STR: 'STRp', DEX: 'DEXp', INT: 'INTp', LUK: 'LUKp', ALL: 'ALLp', HP: 'HPp', ATT: 'ATTp', MATT: 'MATTp',
  BOSS: 'BOSSp', IED: 'IED', CD: 'CRITDMGp',
};
function outcomeLines(o: Outcome): PotLine[] {
  return o.cats.map((c, i) => ({ key: CAT_KEY[c], value: o.vals[i] })).filter((l) => l.key) as PotLine[];
}
function simCube(c: Candidate) {
  const equip = setup.equips[c.slot]!;
  const item = ITEM_BY_ID[equip.itemId];
  const table = tableSlotFor(equip.slot)!;
  const spec = buildSpecs(table, item.level, cls).find((s) => s.label === c.label)!;
  const cube = /Bright/.test(c.notes?.[0] ?? '') ? 'bright' : 'glowing';
  const outs = enumerate(table, cube, item.level, spec.cats);
  const cdf = new Float64Array(outs.length); let acc = 0;
  outs.forEach((o, i) => { acc += o.p; cdf[i] = acc; });
  const sample = () => { const u = rnd() * acc; let lo = 0, hi = cdf.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < u) lo = m + 1; else hi = m; } return outs[lo]; };
  const unit = unitCost(cube, item.level, effectiveMarket(setup.market));
  let cubes = 0, fd = 0;
  for (let i = 0; i < RUNS; i++) {
    let o: Outcome;
    do { o = sample(); cubes++; } while (!spec.test(o));
    fd += damageModule.fdGain(eq, cls, linesToBundle(equip.pot), linesToBundle(outcomeLines(o)));
  }
  rows.push([`Cube ${item.name} ${c.label}`, `${(c.expectedCost / 1e9).toFixed(3)}B`, `${((cubes / RUNS) * unit / 1e9).toFixed(3)}B`, pct((cubes / RUNS) * unit, c.expectedCost),
    `${c.fdGain.toFixed(3)}%`, `${(fd / RUNS).toFixed(3)}%`, pct(fd / RUNS, c.fdGain)]);
}

// ---------------- Flames ----------------
function simFlame(c: Candidate) {
  const equip = setup.equips[c.slot]!;
  const item = ITEM_BY_ID[equip.itemId];
  const spec = specFromItem(item);
  const w = flameWeightsFromStatWeights(r.weights, cls);
  const pool = linePool(item.level, spec.isWeapon);
  const odds = tierOdds('reset', spec.flameAdvantaged);
  const tierCdf: number[] = []; odds.reduce((a, p, i) => (tierCdf[i] = a + p), 0);
  const m = c.label.match(/(?:>|≥)\s*(\d+)/);
  if (!m || !spec.flameAdvantaged || spec.isWeapon) return;
  // Every flame label carries its whole-number threshold, including the "any upgrade" rung.
  const threshold = Number(m[1]) - 1e-9;
  const roll = (): StatBundle => {
    const p = pool.slice(); const parts: StatBundle[] = [];
    for (let k = 0; k < 4; k++) {
      const line = p.splice(Math.floor(rnd() * p.length), 1)[0];
      const u = rnd(); const tier = tierCdf.findIndex((x) => u < x);
      parts.push(lineStats(line, tier, spec));
    }
    return addBundles(...parts);
  };
  let n = 0, fd = 0;
  for (let i = 0; i < RUNS; i++) {
    let b: StatBundle;
    do { b = roll(); n++; } while (Math.round(scoreBundle(b, w, cls) * 1000) / 1000 < threshold);
    fd += damageModule.fdGain(eq, cls, equip.flame ?? {}, b);
  }
  const cost = (n / RUNS) * setup.market.mesoPerFlame;
  rows.push([`Flame ${item.name} ${c.label}`, `${(c.expectedCost / 1e6).toFixed(1)}M`, `${(cost / 1e6).toFixed(1)}M`, pct(cost, c.expectedCost),
    `${c.fdGain.toFixed(3)}%`, `${(fd / RUNS).toFixed(3)}%`, pct(fd / RUNS, c.fdGain)]);
}

// ---------------- Bonus potential (Interactive) ----------------
const inter = sampleNightLord();
inter.market.server = 'interactive';
inter.equips.weapon!.bpot = [{ key: 'ATTp', value: 12 }, { key: 'LUKp', value: 9 }];
inter.equips.top!.bpot = [{ key: 'LUKp', value: 9 }, { key: 'ATT', value: 15 }];
const rI = rank(inter, cls, modules);
function simBpot(c: Candidate) {
  const equip = inter.equips[c.slot]!;
  const item = ITEM_BY_ID[equip.itemId];
  const table = bonusSlotFor(equip.slot)!;
  const unit = scoreUnit(cls, rI.weights, isAttTable(table));
  const pools = BONUS_LEGENDARY_LINES[table][item.level > 150 ? 'hi' : 'lo'];
  const cdfs = pools.map((rows) => { let a = 0; return rows.map((r) => (a += r[2])); });
  const toLine = (c: string, v: number): PotLine | null =>
    c === 'J' || c === 'CDR' ? null : { key: (c.endsWith('lv') ? `${c.slice(0, -2)}_PER_LV` : c) as PotLine['key'], value: v };
  const roll = (): PotLine[] => pools.map((rows, i) => {
    const u = rnd() * cdfs[i][cdfs[i].length - 1]; const k = cdfs[i].findIndex((x) => u < x);
    return toLine(rows[k][0], rows[k][1]);
  }).filter((x): x is PotLine => !!x);
  const cur = bonusScore(equip.bpot, rI.weights, unit, inter.equivalences.level);
  const m = c.label.match(/(?:>|≥)\s*([\d.]+)/)!;
  const hit = c.label.includes('any upgrade') ? (x: number) => x > cur + 1e-6 : (x: number) => x >= Number(m[1]) - 1e-9;
  const price = bonusUnitCost(/Bright/.test(c.notes?.[0] ?? '') ? 'bonusBright' : 'bonusGlowing', item.level, effectiveMarket(inter.market));
  let n = 0, fd = 0;
  for (let i = 0; i < RUNS; i++) {
    let lines: PotLine[];
    do { lines = roll(); n++; } while (!hit(bonusScore(lines, rI.weights, unit, inter.equivalences.level)));
    fd += damageModule.fdGain(inter.equivalences, cls, linesToBundle(equip.bpot), linesToBundle(lines));
  }
  const cost = (n / RUNS) * price;
  rows.push([`Bonus ${item.name} ${c.label}`, `${(c.expectedCost / 1e9).toFixed(3)}B`, `${(cost / 1e9).toFixed(3)}B`, pct(cost, c.expectedCost),
    `${c.fdGain.toFixed(3)}%`, `${(fd / RUNS).toFixed(3)}%`, pct(fd / RUNS, c.fdGain)]);
}

const pick = (kind: string, n: number, pred: (c: Candidate) => boolean = () => true) =>
  r.candidates.filter((c) => c.kind === kind && pred(c)).slice(0, n);

for (const c of pick('starforce', 4)) simStarforce(c);
for (const c of pick('starforce', 2, (c) => c.label.endsWith('22★'))) simStarforce(c);
for (const c of pick('cube', 5)) simCube(c);
for (const c of pick('flame', 5, (c) => c.slot !== 'weapon')) simFlame(c);
for (const c of rI.candidates.filter((c) => c.kind === 'bpot-cube' && c.slot === 'weapon').slice(0, 3)) simBpot(c);
for (const c of rI.candidates.filter((c) => c.kind === 'bpot-cube' && c.slot === 'top').slice(0, 2)) simBpot(c);
for (const c of rI.candidates.filter((c) => c.kind === 'bpot-cube' && c.slot === 'ring1').slice(0, 2)) simBpot(c);

console.log(`Monte Carlo check, ${RUNS} runs per action (sample Night Lord)\n`);
console.log(['Action', 'Ranked cost', 'Sim cost', 'Δ cost', 'Ranked FD', 'Sim FD', 'Δ FD / extra'].join(' | '));
for (const row of rows) console.log(row.join(' | '));
