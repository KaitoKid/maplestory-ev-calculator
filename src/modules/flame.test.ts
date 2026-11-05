// Run: npx tsx --test modules/flame.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from './flame';
import vectorsJson from './flame.test-vectors.json';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vectors = vectorsJson as any;
const hero = { id: 'hero', name: 'Hero', main: 'STR', secondary: ['DEX'], attack: 'ATT' } as const;
const asCls = (c: { main: string; secondary: string[]; attack: string }) => ({ id: 'x', name: 'x', ...c }) as never;

test('probabilities sum to 1 for every item kind', () => {
  for (const spec of [
    { level: 200, isWeapon: false, flameAdvantaged: true },
    { level: 150, isWeapon: false, flameAdvantaged: false },
    { level: 200, isWeapon: true, flameAdvantaged: true, baseAtt: 295 },
    { level: 160, isWeapon: true, flameAdvantaged: false, baseAtt: 200 },
  ]) {
    for (const src of ['reset', 'powerful', 'abyssal', 'drop'] as const) {
      const d = F.flameOutcomeDistribution(spec, src, F.relevantLines(hero as never, spec.isWeapon));
      const s = d.probs.reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(s - 1) < 1e-12, `${JSON.stringify(spec)} ${src} sums to ${s}`);
    }
  }
});

test('official pools have 19 options', () => {
  assert.equal(F.WEAPON_POOL.length, 19);
  assert.equal(F.ARMOR_POOL.length, 19);
  assert.ok(!F.WEAPON_POOL.includes('SPEED') && F.WEAPON_POOL.includes('BOSS'));
});

test('per-tier values match WhackyBeanz tables', () => {
  for (const c of vectors.valueVectors.cases) {
    const fa = c.flameAdvantaged;
    for (const [tier, v] of Object.entries(c.whackybeanz['Pure Stats'] as Record<string, number>)) {
      assert.equal(F.singleStatPerTier(c.level) * Number(tier.slice(1)), v);
    }
    for (const [tier, v] of Object.entries(c.whackybeanz['Mixed Stats'] as Record<string, number>)) {
      assert.equal(F.dualStatPerTier(c.level) * Number(tier.slice(1)), v);
    }
    for (const [tier, v] of Object.entries(c.whackybeanz['Max HP/MP'] as Record<string, number>)) {
      assert.equal(F.hpPerTier(c.level) * Number(tier.slice(1)), v);
    }
    for (const [tier, v] of Object.entries(c.whackybeanz['Weapon WA/MA'] as Record<string, number>)) {
      assert.equal(F.weaponAttValue(c.weaponBaseAtt, c.level, Number(tier.slice(1)), fa), v, `${c.level} ${c.weaponBaseAtt} ${tier}`);
    }
  }
});

test('P(score ≥ target) matches devcomma (official KMS odds)', () => {
  for (const c of vectors.probabilityVectors.cases) {
    for (const [src, expected] of Object.entries(c.expected as Record<string, number>)) {
      const sd = F.scoreDistribution(c.spec, asCls(c.class), c.weights, src as F.FlameSource);
      const p = F.probAtLeast(sd, c.target);
      if (c.expectMismatch) continue; // Lv 250: devcomma uses 13/tier, we use 12/tier (see vectors note)
      assert.ok(Math.abs(p - expected) <= 1e-6, `${JSON.stringify(c.spec)} ≥${c.target} ${src}: ${p} vs ${expected}`);
    }
  }
});

test('average flames match MathBro', () => {
  for (const c of vectors.mathbroVectors.cases) {
    const sd = F.scoreDistribution(c.spec, asCls(c.class), c.weights, c.source);
    const avg = 1 / F.probAtLeast(sd, c.target);
    assert.ok(Math.abs(Math.round(avg) - c.expectedAverageFlames) <= c.tolerance, `${JSON.stringify(c.spec)} ≥${c.target}: ${avg} vs ${c.expectedAverageFlames}`);
  }
});

test('mean score matches hand calculation (Lv 200 FA, STR class)', () => {
  // 4/19 × E[tier] × Σ per-tier line scores, E[tier] = 4.98
  const perTier = 11 + 11 / 8 + 6 * 1.125 + 6 + 6 + 6 / 8 + 6 / 8 + 4 + 10;
  const sd = F.scoreDistribution({ level: 200, isWeapon: false, flameAdvantaged: true }, hero as never,
    { stat: { STR: 1, DEX: 0.125 }, att: 4, allPct: 10, bossPct: 0, dmgPct: 0 });
  assert.ok(Math.abs(F.meanScore(sd) - (4 / 19) * 4.98 * perTier) < 1e-9);
});

test('module: unflameable items return [] and targets beat the current flame', () => {
  const market = { mesoPerFlame: 3_000_000 } as never;
  const equip = (flame: object) => ({ slot: 'hat', itemId: 'x', stars: 22, potTier: 'legendary', pot: [], bpotTier: 'rare', bpot: [], flame }) as never;
  const emblem = { id: 'e', name: 'Emblem', set: 'x', slot: 'emblem', level: 100, base: {}, maxStars: 0, flameable: false, starforceable: false } as never;
  assert.deepEqual(F.flameModule.targets(emblem, equip({}), hero as never, market, {}), []);

  const hat = { id: 'h', name: 'Arcane Umbra Hat', set: 'Arcane Umbra', slot: 'hat', level: 200, base: {}, maxStars: 25, flameable: true, starforceable: true } as never;
  const cur = { STR: 66, ATT: 4, ALLp: 5 };
  const ts = F.flameModule.targets(hat, equip(cur), hero as never, market, { STR: 1, DEX: 0.125, ATT: 4, ALLp: 10 });
  assert.ok(ts.length >= 3);
  const curScore = F.flameModule.score!(cur, hero as never);
  for (const t of ts) {
    assert.ok(F.flameModule.score!(t.flame, hero as never) > curScore, t.label);
    assert.ok(Math.abs(t.cost.mean - 3_000_000 / t.pPerFlame!) < 1);
  }
  // Ladder is monotone: rarer rungs cost more.
  for (let i = 1; i < ts.length; i++) assert.ok(ts[i].cost.mean >= ts[i - 1].cost.mean);
});

test('CRA hat is not flame-advantaged; Arcane is', () => {
  const mk = (set: string, slot: string) => ({ id: 'x', name: 'x', set, slot, level: 150, base: {}, maxStars: 22, flameable: true, starforceable: true }) as never;
  assert.equal(F.isFlameAdvantaged(mk('Root Abyss', 'hat')), false);
  assert.equal(F.isFlameAdvantaged(mk('Root Abyss', 'top')), true);
  assert.equal(F.isFlameAdvantaged(mk('Arcane Umbra', 'hat')), true);
  assert.equal(F.isFlameAdvantaged(mk('Horntail', 'pendant1')), false);
});
