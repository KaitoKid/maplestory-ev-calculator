// Checks that pricing a mixed gear swap from the player's FD rows alone gives the same answer as the
// GMS damage formula itself (MapleStory Wiki, "Damage Formula"):
//   D = (4·main + secondary) × ATT × (1 + Dmg% + Boss%) × (1.35 + CritDmg%) × (1 − PDR·(1 − IED))
//   main = affectedMain × (1 + main%) + unaffectedMain,   ATT = baseATT × (1 + ATT%)
// For each synthetic character we (1) compute the 10 FD rows the way a player would read them off a
// stat-equivalence tool (add `amount` of one stat, see the % FD), (2) price swaps with damage.ts from
// those rows only, and (3) compare with the formula evaluated before/after the swap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fdGain, defaultAmount, rowsForClass, OPTIONAL_ROW } from '../src/modules/damage';
import { CLASS_BY_ID } from '../src/modules/damage.data';
import type { ClassDef, EquivKey, StatBundle, StatEquivalences } from '../src/core/types';

interface Char {
  level: number; mainAff: number; mainPct: number; mainUnaff: number; secAff: number; secPct: number; secUnaff: number;
  baseAtt: number; attPct: number; dmg: number; boss: number; cd: number; ied: number; pdr: number;
}

function damage(c: Char, cls: ClassDef, b: StatBundle): number {
  const m = cls.main, s = cls.secondary[0];
  const lv = Math.floor(c.level / 9);
  const mFlat = (b[m] ?? 0) + (b.ALL ?? 0) + ((b as Record<string, number>)[`${m}_PER_LV`] ?? 0) * lv;
  const mPct = ((b as Record<string, number>)[`${m}p`] ?? 0) + (b.ALLp ?? 0);
  const sFlat = (b[s] ?? 0) + (b.ALL ?? 0);
  const sPct = ((b as Record<string, number>)[`${s}p`] ?? 0) + (b.ALLp ?? 0);
  const main = (c.mainAff + mFlat) * (1 + (c.mainPct + mPct) / 100) + c.mainUnaff;
  const sec = (c.secAff + sFlat) * (1 + (c.secPct + sPct) / 100) + c.secUnaff;
  const a = cls.attack;
  const att = (c.baseAtt + (b[a] ?? 0)) * (1 + (c.attPct + ((b as Record<string, number>)[`${a}p`] ?? 0)) / 100);
  const dmg = 1 + (c.dmg + c.boss + (b.DMGp ?? 0) + (b.BOSSp ?? 0)) / 100;
  const crit = 1.35 + (c.cd + (b.CRITDMGp ?? 0)) / 100;
  let iedLeft = 1 - c.ied / 100;
  for (const x of b.IED ?? []) iedLeft *= 1 - x / 100;
  const def = 1 - (c.pdr / 100) * iedLeft;
  return (4 * main + sec) * att * dmg * crit * def;
}

/** Signed swap: remove `r`, add `a`. IED removal divides out that source. */
function formulaGain(c: Char, cls: ClassDef, r: StatBundle, a: StatBundle): number {
  const neg: StatBundle = {};
  for (const [k, v] of Object.entries(r)) if (k !== 'IED') (neg as Record<string, number>)[k] = -(v as number);
  const merged: StatBundle = { ...neg };
  for (const [k, v] of Object.entries(a)) if (k !== 'IED') (merged as Record<string, number>)[k] = ((merged as Record<string, number>)[k] ?? 0) + (v as number);
  const c2 = { ...c, ied: (1 - (1 - c.ied / 100) / (r.IED ?? []).reduce((p, x) => p * (1 - x / 100), 1)) * 100 };
  merged.IED = a.IED;
  return (damage(c2, cls, merged) / damage(c, cls, {}) - 1) * 100;
}

function rowBundle(key: EquivKey, amt: number, cls: ClassDef): StatBundle {
  const s = cls.secondary[0];
  const map: Record<EquivKey, StatBundle> = {
    STAT: { [cls.main]: amt }, STATp: { [`${cls.main}p`]: amt }, SUBSTAT: { [s]: amt }, SUBSTATp: { [`${s}p`]: amt },
    ATT: { [cls.attack]: amt }, ATTp: { [`${cls.attack}p`]: amt }, BOSSp: { BOSSp: amt }, DMGp: { DMGp: amt },
    IED: { IED: [amt] }, CRITDMGp: { CRITDMGp: amt },
  } as Record<EquivKey, StatBundle>;
  return map[key];
}

function rowsFor(c: Char, cls: ClassDef): StatEquivalences {
  const rows: StatEquivalences['rows'] = {};
  for (const k of rowsForClass(cls)) {
    if (k === OPTIONAL_ROW) continue; // cooldown reduction has no term in this independent model
    const amount = defaultAmount(k, cls);
    rows[k] = { amount, fdPct: (damage(c, cls, rowBundle(k, amount, cls)) / damage(c, cls, {}) - 1) * 100 };
  }
  return { classId: cls.id, level: c.level, rows };
}

const CHARS: [string, Char][] = [
  ['night-lord', { level: 275, mainAff: 4200, mainPct: 330, mainUnaff: 21000, secAff: 1900, secPct: 90, secUnaff: 400, baseAtt: 2700, attPct: 101, dmg: 60, boss: 330, cd: 92, ied: 93, pdr: 300 }],
  ['hero', { level: 268, mainAff: 3600, mainPct: 280, mainUnaff: 15000, secAff: 1500, secPct: 70, secUnaff: 300, baseAtt: 2400, attPct: 92, dmg: 55, boss: 280, cd: 80, ied: 90, pdr: 300 }],
  ['bishop', { level: 280, mainAff: 4400, mainPct: 360, mainUnaff: 24000, secAff: 2000, secPct: 95, secUnaff: 500, baseAtt: 3100, attPct: 115, dmg: 70, boss: 360, cd: 100, ied: 95, pdr: 380 }],
];

const SWAPS: [string, StatBundle, StatBundle, boolean][] = [
  // [description, remove, add, mixes flat and % of the same stat]
  ['hat cube 9% → 30% main', { LUKp: 9 }, { LUKp: 30 }, false],
  ['weapon: 1 ATT/1 boss/1 IED → 2 ATT + IED', { ATTp: 12, BOSSp: 30, IED: [30] }, { ATTp: 25, IED: [40] }, false],
  ['emblem: 2L ATT → 3L IED', { ATTp: 21 }, { IED: [40, 35, 35] }, false],
  ['gloves: 10% main → 2 crit dmg lines', { LUKp: 10 }, { CRITDMGp: 16 }, false],
  ['star force 17 → 22 (main, sub, ATT)', {}, { LUK: 65, DEX: 65, ATT: 95 }, false],
  ['flame reroll (main, sub, ATT, AS%)', { LUK: 60, DEX: 20, ATT: 3, ALLp: 4 }, { LUK: 90, DEX: 30, ATT: 5, ALLp: 6 }, true],
  ['weapon flame ATT + boss', { ATT: 61, BOSSp: 12 }, { ATT: 105, BOSSp: 14, DMGp: 5 }, false],
];

for (const [clsId, c] of CHARS) {
  const cls = CLASS_BY_ID[clsId];
  const eq = rowsFor(c, cls);
  for (const [desc, rem, add, mixed] of SWAPS) {
    test(`FD from rows = damage formula: ${clsId}, ${desc}`, () => {
      const map = (b: StatBundle): StatBundle => JSON.parse(JSON.stringify(b)
        .replace(/"LUK/g, `"${cls.main}`).replace(/"DEX/g, `"${cls.secondary[0]}`).replace(/"ATT/g, `"${cls.attack}`)) as StatBundle;
      const r = map(rem), a = map(add);
      const want = formulaGain(c, cls, r, a);
      const got = fdGain(eq, cls, r, a);
      // Rows are per-unit slopes, so mixing flat and % of the SAME stat drops a tiny flat×% cross term.
      const tol = mixed ? 0.02 : 1e-9;
      assert.ok(Math.abs(got - want) <= tol * Math.max(1, Math.abs(want)), `got ${got}, formula ${want}`);
    });
  }
}
