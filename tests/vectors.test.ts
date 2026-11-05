// Re-runs the research threads' public-calculator vectors against the modules the app ships.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as sf from '../src/modules/starforce';
import { probability, makeSpec, expectedCubeCost, tableSlotFor } from '../src/modules/cube';
import type { EquipSlot, ItemDef } from '../src/core/types';

const load = (f: string) => JSON.parse(readFileSync(new URL(`../src/modules/${f}`, import.meta.url), 'utf8'));

test('starforce: base attempt costs match the in-game values', () => {
  const v = load('starforce.test-vectors.json');
  for (const b of v.baseAttemptCost) {
    const acts = sf.starActions(b.level, b.star, { thirtyOff: b.thirtyOff, mvpDiscount: b.mvpDiscount, enhanceMode: b.enhanceMode ?? 'off', safeguard: 'never' });
    assert.ok(Math.abs(acts[0].cost - b.expected) <= (b.tolerance ?? 0), `lv${b.level} ${b.star}★ got ${acts[0].cost} want ${b.expected}`);
  }
});

test('starforce: expected costs match public SF calculators (mochachai / BlueMagic / tadeucci)', () => {
  const v = load('starforce.test-vectors.json');
  for (const c of v.expectedCost) {
    const r = sf.expectedStarforceCost(c.level, c.from, c.to, c.options, false);
    assert.ok(Math.abs(r.mean - c.expectedMean) / c.expectedMean <= c.relTolerance, `lv${c.level} ${c.from}→${c.to} ${JSON.stringify(c.options)}: got ${r.mean}, want ${c.expectedMean}`);
  }
  assert.ok(v.expectedCost.length >= 90);
});

test('starforce: stat gains match the wiki tables', () => {
  const v = load('starforce.test-vectors.json');
  for (const s of v.starStats) {
    const g = sf.starforceStatGain(s.input, s.stars);
    assert.equal(g.stat, s.expected.stat); assert.equal(g.att, s.expected.att);
  }
});

test('starforce: default mode profiles (1-1-4-4 / 4-4-4-4, safeguard 15-17)', () => {
  const v = load('starforce.test-vectors.json');
  for (const m of v.modeProfiles) {
    const r = sf.starforceModule.costDetailed(m.item as ItemDef, m.from, m.to, m.market);
    assert.ok(Math.abs(r.mean - m.expectedMean) / m.expectedMean <= m.relTolerance, `${m.note}: ${r.mean}`);
    assert.equal(JSON.stringify(r.policy.filter((a) => a.star >= 15 && a.star <= 21)), JSON.stringify(m.expectedPolicy));
  }
});

test('cube: probabilities match brendonmay cubingCalculator exactly', () => {
  const v = load('cube.test-vectors.json');
  for (const c of v.probability) {
    const table = tableSlotFor(c.slot as EquipSlot) ?? c.slot;
    const p = probability(table, c.cube, c.level, makeSpec(c.spec));
    assert.ok(Math.abs(p - c.expectedP) / c.expectedP < 1e-9, `${c.id}: got ${p} want ${c.expectedP}`);
  }
  assert.equal(v.probability.length, 18);
});

test('cube: expected cube counts match maplestorycalculator.com', () => {
  const v = load('cube.test-vectors.json');
  for (const c of v.cost) {
    const plan = expectedCubeCost(c.slot, c.level, makeSpec(c.spec), { cubes: c.cubes });
    assert.ok(plan, c.id);
    assert.ok(Math.abs(plan!.expectedCubes - c.expectedCubes) <= 0.05, `${c.id}: got ${plan!.expectedCubes} want ${c.expectedCubes}`);
  }
});
