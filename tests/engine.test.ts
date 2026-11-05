import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rank, bestPerItem, planSteps } from '../src/engine/rank';
import { CLASS_BY_ID } from '../src/modules/damage.data';
import { damageModule } from '../src/modules/damage';
import { starforceModule, modeGroup } from '../src/modules/starforce';
import { cubeModule } from '../src/modules/cube';
import { flameModule, flameTargets, linePool } from '../src/modules/flame';
import { sampleNightLord } from './fixtures';
import { ITEMS, ITEM_BY_ID } from '../src/data/items';

const modules = { damage: damageModule, starforce: starforceModule, cube: cubeModule, flame: flameModule };

test('ranking: sorted by meso per FD, only positive gains, all three action kinds present', () => {
  const r = rank(sampleNightLord(), CLASS_BY_ID['night-lord'], modules);
  assert.equal(r.warnings.length, 0, r.warnings.join('; '));
  assert.ok(r.candidates.length > 100);
  for (let i = 1; i < r.candidates.length; i++) assert.ok(r.candidates[i].costPerFd >= r.candidates[i - 1].costPerFd);
  for (const c of r.candidates) {
    assert.ok(c.fdGain > 0 && Number.isFinite(c.expectedCost) && c.expectedCost > 0);
    assert.ok(Math.abs(c.costPerFd - c.expectedCost / c.fdGain) < 1e-6 * c.costPerFd);
  }
  const kinds = new Set(r.candidates.map((c) => c.kind));
  assert.deepEqual([...kinds].sort(), ['cube', 'flame', 'starforce']);
  const best = bestPerItem(r.candidates);
  assert.equal(new Set(best.map((c) => `${c.slot}:${c.kind}`)).size, best.length);
});

test('ranking: pitched items use mode 4 at 18-21★ and others 1-1-4-4 by default', () => {
  const r = rank(sampleNightLord(), CLASS_BY_ID['night-lord'], modules);
  const pitched = r.candidates.find((c) => c.slot === 'face' && c.kind === 'starforce' && c.label === '17★ → 22★');
  const other = r.candidates.find((c) => c.slot === 'shoes' && c.kind === 'starforce' && c.label === '17★ → 22★');
  assert.ok(pitched && other);
  assert.match(pitched!.notes!.join(' '), /18★:L4 19★:L4 20★:L4 21★:L4/);
  assert.match(other!.notes!.join(' '), /18★:L1 19★:L1 20★:L4 21★:L4/);
});

test('ranking: a better FD value for ATT% raises the gain of options that add ATT%', () => {
  const s = sampleNightLord();
  const cls = CLASS_BY_ID['night-lord'];
  const netAtt = (c: { before: { ATTp?: number }; after: { ATTp?: number } }) => (c.after.ATTp ?? 0) - (c.before.ATTp ?? 0);
  const before = rank(s, cls, modules).candidates.filter((c) => c.kind === 'cube' && netAtt(c) > 1);
  assert.ok(before.length > 0);
  s.equivalences.rows.ATTp = { amount: 10, fdPct: 7 };
  const after = rank(s, cls, modules).candidates;
  for (const b of before) {
    const a = after.find((c) => c.slot === b.slot && c.label === b.label)!;
    assert.ok(a.fdGain > b.fdGain, `${b.slot} ${b.label}`);
  }
});

test('ranking: identical runs are memoised and fast', () => {
  const s = sampleNightLord(); const cls = CLASS_BY_ID['night-lord'];
  rank(s, cls, modules);
  const r = rank(s, cls, modules);
  assert.ok(r.ms < 50, `warm rank took ${r.ms} ms`);
});

test('items: pitched + brilliant sets fall in the pitched SF mode group', () => {
  for (const it of ITEMS) {
    const want = /^(Pitched|Brilliant) Boss$/.test(it.set) ? 'pitched' : 'other';
    assert.equal(modeGroup(it), want, it.name);
  }
});

test('server: Heroic ignores boom replacement, Interactive adds it', () => {
  const cls = CLASS_BY_ID['night-lord'];
  const s = sampleNightLord();
  const find = (r: ReturnType<typeof rank>) => r.candidates.find((c) => c.slot === 'shoes' && c.kind === 'starforce' && c.label === '17★ → 22★')!;
  s.market.server = 'heroic';
  s.market.replacementCost = { 'Arcane Umbra': 50e9 };
  const heroic = find(rank(s, cls, modules));
  s.market.replacementCost = {};
  const heroicZero = find(rank(s, cls, modules));
  assert.equal(heroic.expectedCost, heroicZero.expectedCost);
  s.market.server = 'interactive';
  s.market.replacementCost = { 'Arcane Umbra': 50e9 };
  const inter = find(rank(s, cls, modules));
  assert.ok(inter.expectedCost > heroic.expectedCost + 10e9, `${inter.expectedCost} vs ${heroic.expectedCost}`);
});

test('IED and crit damage options are ranked once their FD rows are filled', () => {
  const cls = CLASS_BY_ID['night-lord'];
  const s = sampleNightLord();
  const r = rank(s, cls, modules);
  // The sample leaves the optional cooldown row blank, so only cooldown-only options may be unvalued.
  assert.ok(r.unvalued.every((c) => (c.after.CDR ?? 0) > 0));
  assert.ok(r.candidates.some((c) => (c.after.IED?.length ?? 0) > 0 && c.fdGain > 0));
  delete s.equivalences.rows.IED; delete s.equivalences.rows.CRITDMGp;
  assert.ok(rank(s, cls, modules).unvalued.length > 0);
});

test('cube sale takes 25% off the cube price (fee unchanged)', () => {
  const cls = CLASS_BY_ID['night-lord'];
  const s = sampleNightLord();
  // Commanding Force Earring: a lv200 item that can be cubed (badges can't).
  const full = rank(s, cls, modules).candidates.find((c) => c.slot === 'earring' && c.kind === 'cube')!;
  s.market.cubeSale = true;
  const sale = rank(s, cls, modules).candidates.find((c) => c.slot === 'earring' && c.label === full.label)!;
  const fee = 20 * 200 ** 2; // per-use cubing fee for a lv200 item
  const cubes = full.expectedCost / (12e6 + fee);
  assert.ok(Math.abs(sale.expectedCost - cubes * (9e6 + fee)) / sale.expectedCost < 1e-6, `${sale.expectedCost} vs ${cubes * (9e6 + fee)}`);
});

test('badges have no potential, so they are never cubed', () => {
  const cls = CLASS_BY_ID['night-lord'];
  const out = rank(sampleNightLord(), cls, modules).candidates.filter((c) => c.slot === 'badge');
  assert.ok(out.length === 0 || out.every((c) => c.kind === 'starforce' || c.kind === 'flame'));
  assert.ok(!out.some((c) => c.kind === 'cube' || c.kind === 'bpot-cube'));
});

test('planSteps chains higher rungs of the same item after the cheapest one, at their extra cost', () => {
  const r = rank(sampleNightLord(), CLASS_BY_ID['night-lord'], modules);
  const plan = planSteps(r.candidates);
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i - 1].costPerFd <= plan[i].costPerFd + 1e-9);
  const byGroup = new Map<string, typeof plan>();
  for (const c of plan) { const k = `${c.slot}:${c.kind}`; byGroup.set(k, [...(byGroup.get(k) ?? []), c]); }
  let chained = 0;
  for (const [k, steps] of byGroup) {
    const orig = r.candidates.filter((c) => `${c.slot}:${c.kind}` === k);
    const first = orig.slice().sort((a, b) => a.costPerFd - b.costPerFd)[0];
    assert.equal(steps[0].label, first.label, k);
    let cumFd = first.fdGain, cumCost = first.expectedCost;
    for (const s of steps.slice(1)) {
      chained++;
      const full = orig.find((c) => c.label === s.label)!;
      assert.ok(s.fdGain > 0 && Math.abs(cumFd + s.fdGain - full.fdGain) < 1e-9, `${k} ${s.label} fd`);
      if (s.kind === 'starforce') assert.ok(Math.abs(cumCost + s.expectedCost - full.expectedCost) < 1, `${k} ${s.label} cost`);
      else assert.equal(s.expectedCost, full.expectedCost);
      cumFd = full.fdGain; cumCost = full.expectedCost;
    }
  }
  assert.ok(chained > 0, 'expected at least one chained rung');
  // The sample gloves have one crit damage line: a second crit line must be offered as a later rung.
  assert.ok(plan.some((c) => c.slot === 'gloves' && c.kind === 'cube' && /2L Crit Dmg/.test(c.label)));
});

test('the "any upgrade" flame target is a whole-number score and the odds use that same number', () => {
  const cls = CLASS_BY_ID['hero'];
  const market = { mesoPerFlame: 3_000_000 };
  // Eternal Bottom with Kai's flame (STR 100, DEX 56, All Stat 4%): the current score is not a whole number.
  const equip = { slot: 'bottom', itemId: 'eternal-bottom', stars: 21, potTier: 'legendary', pot: [], bpotTier: 'legendary', bpot: [], flame: { STR: 100, DEX: 56, ALLp: 4 } } as never;
  const t = flameTargets(ITEM_BY_ID['eternal-bottom'], equip, cls, market);
  const any = t.find((c) => /any upgrade/.test(c.label))!;
  const m = any.label.match(/^Flame score ≥ (\d+) \(any upgrade\)$/);
  assert.ok(m, any.label);
  assert.ok(any.pPerFlame > 0 && any.pPerFlame < 1);
  for (const c of t) assert.doesNotMatch(c.label, /\d\.\d/, c.label);
});

test('armor flame pool includes flat ATT and MATT (wiki Bonus Stats: non-weapons, all levels)', () => {
  const pool = linePool(150, false);
  assert.ok(pool.includes('ATT') && pool.includes('MATT'));
  assert.ok(!pool.includes('BOSS') && !pool.includes('DMG'));
});
