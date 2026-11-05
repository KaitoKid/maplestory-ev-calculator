// Bonus potential (Interactive only): data sanity, probabilities vs a brute-force recount from the
// raw Nexon tables, cost model, server gating and prog-step wording.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BONUS_LEGENDARY_LINES } from '../src/modules/bpot.data';
import {
  BONUS_CUBE_PRICE, bonusOutcomes, bonusScore, bonusSlotFor, bonusTargets, bonusUnitCost, conditional, scoreUnit,
} from '../src/modules/bpot';
import { cubeFee } from '../src/modules/cube';
import { rank, effectiveMarket } from '../src/engine/rank';
import { toStep, bonusTarget } from '../src/engine/steps';
import { CLASS_BY_ID } from '../src/modules/damage.data';
import { damageModule } from '../src/modules/damage';
import { starforceModule } from '../src/modules/starforce';
import { cubeModule } from '../src/modules/cube';
import { flameModule } from '../src/modules/flame';
import { ITEM_BY_ID } from '../src/data/items';
import { sampleNightLord } from './fixtures';

const NL = CLASS_BY_ID['night-lord'];
const modules = { damage: damageModule, starforce: starforceModule, cube: cubeModule, flame: flameModule };
const setup = sampleNightLord();
const w = damageModule.statWeights(setup.equivalences, NL);

test('every bonus line pool sums to 100% and matches spot values from Nexon\'s page', () => {
  for (const [slot, bands] of Object.entries(BONUS_LEGENDARY_LINES)) {
    for (const [band, pools] of Object.entries(bands)) {
      for (const rows of pools) {
        const total = rows.reduce((s, r) => s + r[2], 0);
        assert.ok(Math.abs(total - 100) < 0.01, `${slot} ${band} ${total}`);
      }
    }
  }
  const find = (rows: [string, number, number][], c: string, v: number) => rows.find((r) => r[0] === c && r[1] === v)?.[2];
  assert.equal(find(BONUS_LEGENDARY_LINES.weapon.lo[0], 'ATTp', 12), 5.1282);
  assert.equal(find(BONUS_LEGENDARY_LINES.weapon.hi[0], 'ATTp', 13), 5.1282);
  assert.equal(find(BONUS_LEGENDARY_LINES.weapon.lo[1], 'ATTp', 12), 0.02551); // prime on line 2 is rare
  assert.equal(find(BONUS_LEGENDARY_LINES.top.hi[0], 'LUK', 21), 5.2632);
  assert.equal(find(BONUS_LEGENDARY_LINES.gloves.lo[0], 'CRITDMGp', 3), 3.3898);
  // Lines 2 and 3 are prime (Legendary-tier values) ~0.5% of the time on a weapon; the damage lines
  // among them (everything except MP / crit rate, which sit in 'J') add up to 0.434%.
  const prime = BONUS_LEGENDARY_LINES.weapon.lo[1].filter((r) => BONUS_LEGENDARY_LINES.weapon.lo[0].some((x) => x[0] === r[0] && x[1] === r[1] && r[0] !== 'J'));
  assert.ok(Math.abs(prime.reduce((s, r) => s + r[2], 0) - 0.43372) < 1e-6);
});

test('slot mapping: accessories share tables, pocket has none', () => {
  assert.equal(bonusSlotFor('ring3'), 'ring');
  assert.equal(bonusSlotFor('pendant2'), 'pendant');
  assert.equal(bonusSlotFor('face'), 'face');
  assert.equal(bonusSlotFor('pocket'), null);
});

test('P(score >= t) matches a brute-force recount over the raw Nexon rows', () => {
  for (const [slot, lv] of [['weapon', 200], ['top', 150], ['ring', 160]] as const) {
    const att = slot === 'weapon';
    const unit = scoreUnit(NL, w, att);
    const outs = bonusOutcomes(slot, lv, w, unit, 270);
    const pools = BONUS_LEGENDARY_LINES[slot][lv > 150 ? 'hi' : 'lo'];
    const lineScore = (c: string, v: number) => {
      const key = c.endsWith('lv') ? `${c.slice(0, -2)}_PER_LV` : c;
      return c === 'J' || c === 'CDR' ? 0 : bonusScore([{ key: key as never, value: v }], w, unit, 270);
    };
    for (const t of [5, 10, 15, 20]) {
      let p = 0;
      for (const a of pools[0]) for (const b of pools[1]) for (const c of pools[2]) {
        if (lineScore(a[0], a[1]) + lineScore(b[0], b[1]) + lineScore(c[0], c[1]) >= t - 1e-9) p += (a[2] * b[2] * c[2]) / 1e6;
      }
      const got = conditional(outs, t).p;
      assert.ok(Math.abs(got - p) < 1e-12, `${slot} t=${t}: ${got} vs ${p}`);
    }
  }
});

test('cost = rolls on the cheapest bonus cube (no tier-ups); sale applies', () => {
  const s = sampleNightLord(); s.market.server = 'interactive';
  const eq = { ...s.equips.top!, bpot: [] };
  const item = ITEM_BY_ID[eq.itemId];
  const unit = bonusUnitCost('bonusGlowing', item.level, s.market);
  assert.equal(unit, BONUS_CUBE_PRICE.bonusGlowing + cubeFee(item.level));
  const ts = bonusTargets(item, eq, NL, s.market, w, 270);
  assert.ok(ts.length >= 4);
  for (const t of ts) {
    assert.ok(Math.abs(t.cost.mean - unit / t.pPerCube!) / t.cost.mean < 1e-12, t.label);
    assert.equal(t.cubeName, 'Bonus Glowing Cube');
  }
  // Higher targets are rarer and cost more.
  for (let i = 1; i < ts.length; i++) assert.ok(ts[i].pPerCube! < ts[i - 1].pPerCube!);
  // Cube sale: 25% off the cube price, fee unchanged.
  const sale = effectiveMarket({ ...s.market, cubeSale: true });
  assert.equal(bonusUnitCost('bonusBright', item.level, sale), BONUS_CUBE_PRICE.bonusBright * 0.75 + cubeFee(item.level));
  // Bright is only used when it is cheaper per roll.
  const m3 = { ...s.market, cubeCostOverride: { bonusBright: 1e6 } };
  assert.equal(bonusTargets(item, eq, NL, m3, w, 270)[0].cubeName, 'Bonus Bright Cube');
});

test('bonus potential is ranked on Interactive only, with explicit prog steps', () => {
  const heroic = sampleNightLord();
  heroic.equips.weapon!.bpot = [{ key: 'ATTp', value: 12 }];
  assert.equal(rank(heroic, NL, modules).candidates.filter((c) => c.kind === 'bpot-cube').length, 0);
  const inter = sampleNightLord(); inter.market.server = 'interactive';
  inter.equips.weapon!.bpot = [{ key: 'ATTp', value: 12 }, { key: 'LUKp', value: 9 }];
  const r = rank(inter, NL, modules);
  const bp = r.candidates.filter((c) => c.kind === 'bpot-cube');
  assert.ok(bp.length > 20);
  assert.ok(bp.every((c) => c.fdGain > 0 && c.slot !== 'pocket'));
  const wpn = bp.filter((c) => c.slot === 'weapon');
  assert.ok(wpn.some((c) => /any upgrade/.test(c.label)));
  // The "any upgrade" step beats the current lines' score.
  const cur = bonusScore(inter.equips.weapon!.bpot, r.weights, scoreUnit(NL, r.weights, true), 270);
  assert.match(wpn.find((c) => /any upgrade/.test(c.label))!.label, new RegExp(`> ${(Math.round(cur * 10) / 10).toString().replace('.', '\\.')}`));
  const st = toStep(wpn[0], 'Arcane Umbra Weapon', r.weights, NL);
  assert.equal(st.verb, 'Bonus cube');
  assert.match(st.target, /^until (the bonus score beats your current [\d.]+|bonus score ≥ \d+) \(most common hit: .+\)$/);
  assert.match(st.how!, /^Use: Bonus (Glowing|Bright) Cube · Bonus score = ATT % \+ /);
});

test('bonus target wording', () => {
  assert.equal(bonusTarget('Bonus score ≥ 15'), 'until bonus score ≥ 15');
  assert.equal(bonusTarget('Bonus score > 14.3 (any upgrade)', 'ATT 13% + LUK 10%'), 'until the bonus score beats your current 14.3 (most common hit: ATT 13% + LUK 10%)');
});
