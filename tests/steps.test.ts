import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cubeTarget, flameTarget, shortCube, shortFlame, toStep } from '../src/engine/steps';
import { rank, bestPerItem } from '../src/engine/rank';
import { CLASS_BY_ID } from '../src/modules/damage.data';
import { damageModule } from '../src/modules/damage';
import { starforceModule } from '../src/modules/starforce';
import { cubeModule, buildSpecs } from '../src/modules/cube';
import { flameModule } from '../src/modules/flame';
import { ITEM_BY_ID } from '../src/data/items';
import { sampleNightLord } from './fixtures';

test('cube labels become readable targets', () => {
  assert.equal(cubeTarget('≥ 26% LUK'), 'until LUK % adds up to 26% or more (All Stat % lines count)');
  assert.equal(cubeTarget('≥ 33% ATT'), 'until ATT % lines add up to 33% or more');
  assert.equal(cubeTarget('2L Boss + 1L IED'), 'until you roll 2× Boss % + 1× IED');
  assert.equal(cubeTarget('1L ATT + 1L Boss (+any)'), 'until you roll 1× ATT % + 1× Boss % (3rd line can be anything)');
  assert.equal(cubeTarget('2L Crit Dmg + ≥ 10% LUK'), 'until you roll 2× Crit Damage + LUK % ≥ 10%');
  assert.equal(cubeTarget('≥ 2s CDR + ≥ 10% LUK'), 'until you roll -2s cooldown or more + LUK % ≥ 10%');
  // Every label the cube module can emit is translated (no raw "2L" left).
  for (const cls of ['night-lord', 'bishop', 'xenon', 'demon-avenger']) {
    for (const table of ['weapon', 'emblem', 'hat', 'gloves', 'ring'] as const) {
      for (const sp of buildSpecs(table, 200, CLASS_BY_ID[cls])) assert.doesNotMatch(cubeTarget(sp.label), /\dL /, sp.label);
    }
  }
});

test('compact targets for the step list', () => {
  assert.equal(shortCube('≥ 33% LUK'), '33%+ LUK');
  assert.equal(shortCube('≥ 33% ATT'), '33%+ ATT');
  assert.equal(shortCube('≥ 20% all stat (Xenon equiv.)'), '20%+ all stat');
  assert.equal(shortCube('2L Boss + 1L IED (+any)'), '2× Boss + IED');
  assert.equal(shortCube('1L ATT + 1L Boss (+any)'), 'ATT + Boss');
  assert.equal(shortCube('2L Crit Dmg + ≥ 10% LUK'), '2× Crit Dmg + 10%+ LUK');
  assert.equal(shortCube('≥ 2s CDR + ≥ 10% LUK'), '-2s CD + 10%+ LUK');
  assert.equal(shortFlame('Flame score ≥ 140'), '140+ Flame Score');
  assert.equal(shortFlame('Flame score ≥ 92 (any upgrade)'), '92+ Flame Score');
  assert.equal(shortFlame('ATT T6+ (+61+) & Boss T6+'), 'ATT T6+ & Boss T6+');
  for (const cls of ['night-lord', 'bishop', 'xenon']) {
    for (const table of ['weapon', 'hat', 'ring'] as const) {
      for (const sp of buildSpecs(table, 200, CLASS_BY_ID[cls])) assert.doesNotMatch(shortCube(sp.label), /\dL |≥/, sp.label);
    }
  }
});

test('flame labels become readable targets', () => {
  assert.equal(flameTarget('Flame score ≥ 92 (any upgrade)'), 'until flame score ≥ 92 (any upgrade)');
  assert.equal(flameTarget('Flame score ≥ 140'), 'until flame score ≥ 140');
  assert.equal(flameTarget('ATT T6+ (+61+) & Boss T6+'), 'until ATT T6+ (+61 or more) & Boss T6+ (12%+)');
  assert.equal(flameTarget('ATT T7 (+80) & Boss T7'), 'until ATT T7 (+80) & Boss T7 (14%)');
});

test('every ranked step has an instruction, cost, FD gain and B per 1% FD', () => {
  const s = sampleNightLord(); const cls = CLASS_BY_ID['night-lord'];
  const r = rank(s, cls, { damage: damageModule, starforce: starforceModule, cube: cubeModule, flame: flameModule });
  for (const c of bestPerItem(r.candidates)) {
    const st = toStep(c, ITEM_BY_ID[s.equips[c.slot]!.itemId].name, r.weights, cls);
    assert.match(`${st.verb} ${st.item} ${st.target}`, /^(Star Force .+ from \d+★ to \d+★|Cube .+ until .+|Flame .+ until .+)$/);
    assert.ok(st.short.length > 0 && st.short.length < 40, st.short);
    assert.ok(st.cost > 0 && st.fd > 0);
    assert.ok(Math.abs(st.bPerFd - st.cost / st.fd / 1e9) < 1e-9);
  }
});
