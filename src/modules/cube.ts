// Cube module for the MapleStory EV calculator (GMS Heroic / Reboot).
//
// What it models
// - Main potential. Bonus potential (Interactive worlds only) lives in bpot.ts; targets(bonus=true)
//   delegates there.
// - Cubes: Glowing Cube (old Red) 12,000,000 and Bright Cube (old Black) 22,000,000 mesos each
//   from the Heroic Cube Shop, plus the per-use meso fee charged when cubing (20 * level^2 above
//   level 120, 2.5 * level^2 for levels 71-120).
// - Line odds: Nexon's KMS Red/Black legendary tables (lvl 120-200), as used by the community
//   calculators (brendonmay.github.io/cubingCalculator, maplestorycalculator.com). Items above
//   level 150 get +1 to %stat/%ATT/%HP/%all-stat values (12% -> 13% band).
// - Second/third line pools exclude capped "special" lines the way Nexon documents it:
//   displayed rate / (100 - sum of excluded displayed rates).
// - No tier-ups (Kai): every item is assumed to already have Legendary potential, so a target's
//   cost is rolling it on the cheapest cube (geometric in the per-cube hit chance).
//
// Everything is pure and synchronous. Enumerations are cached per (slot, cube, level band, cats).

import type { ClassDef, Equip, EquipSlot, ItemDef, MarketSettings, PotLine, StatBundle } from '../core/types';
import type { CostDistribution, CubeModule, CubeTarget, StatWeights } from '../core/modules';
import { bonusTargets } from './bpot';
import { LEGENDARY_LINES, type LineCat, type LinePools, type LineRow, type TableSlot } from './cube.data';

// ---------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------

export type CubeKind = 'glowing' | 'bright';
export const CUBE_KINDS: CubeKind[] = ['glowing', 'bright'];

/** Heroic Cube Shop prices (v.239 patch notes; maplestorywiki Heroic Cube Shop). */
export const HEROIC_CUBE_PRICE: Record<CubeKind, number> = { glowing: 12_000_000, bright: 22_000_000 };

export const CUBE_DISPLAY: Record<CubeKind, string> = { glowing: 'Glowing Cube', bright: 'Bright Cube' };

/** Max occurrences of special lines across the 3 lines. Boss / IED / drop are uncapped. */
const SPECIAL_MAX: Partial<Record<LineCat, number>> = { DS: 1, IT: 1, IG: 2, IV: 2 };

/** Meso fee charged per cube use (same constants as the community calculators). */
export function cubeFee(itemLevel: number): number {
  if (itemLevel < 30) return 0;
  if (itemLevel <= 70) return 0.5 * itemLevel ** 2;
  if (itemLevel <= 120) return 2.5 * itemLevel ** 2;
  return 20 * itemLevel ** 2;
}

/** Cube price + fee for one use. Honors market.cubeCostOverride (keys glowing/bright or red/black). */
export function unitCost(cube: CubeKind, itemLevel: number, market?: Partial<MarketSettings>): number {
  const o = market?.cubeCostOverride ?? {};
  const alias = cube === 'glowing' ? 'red' : 'black';
  const price = o[cube] ?? o[alias] ?? HEROIC_CUBE_PRICE[cube];
  const fee = (market as { includeCubeFee?: boolean } | undefined)?.includeCubeFee === false ? 0 : cubeFee(itemLevel);
  return price + fee;
}

export function tableSlotFor(slot: EquipSlot): TableSlot | null {
  switch (slot) {
    case 'hat': case 'top': case 'bottom': case 'overall': case 'shoes': case 'gloves': case 'cape':
    case 'shoulder': case 'belt': case 'emblem': case 'weapon': case 'secondary': case 'heart':
      return slot;
    case 'face': case 'eye': case 'earring': case 'ring1': case 'ring2': case 'ring3': case 'ring4':
    case 'pendant1': case 'pendant2':
      return 'ring';
    case 'badge':
      return 'heart'; // KMS publishes no badge table; same approximation as the community calculators
    default:
      return null; // pocket: no potential
  }
}

/** Prime value of a %stat line at Legendary for this item level (12 or 13). */
export function primeStat(itemLevel: number): number {
  return itemLevel > 150 ? 13 : 12;
}

// ---------------------------------------------------------------------------------------------
// Line pools and enumeration
// ---------------------------------------------------------------------------------------------

const LEVEL_SCALED: Set<LineCat> = new Set(['STR', 'DEX', 'INT', 'LUK', 'ALL', 'HP', 'ATT', 'MATT']);
const SPECIALS: Set<LineCat> = new Set(Object.keys(SPECIAL_MAX) as LineCat[]);

export function linePools(table: TableSlot, cube: CubeKind, itemLevel: number): LinePools {
  const base = LEGENDARY_LINES[table][cube];
  const bonus = itemLevel > 150 ? 1 : 0;
  if (!bonus) return base;
  return base.map(rows => rows.map(([c, v, r]) => [c, LEVEL_SCALED.has(c) ? v + bonus : v, r] as LineRow)) as LinePools;
}

/** One fully-rolled 3-line outcome (after consolidation) with its probability (0..1). */
export interface Outcome { cats: LineCat[]; vals: number[]; p: number }

function consolidate(rows: LineRow[], relevant: Set<LineCat>): LineRow[] {
  const out: LineRow[] = [];
  let junk = 0;
  for (const [c, v, r] of rows) {
    if (relevant.has(c) || SPECIALS.has(c)) out.push([c, v, r]);
    else junk += r;
  }
  if (junk > 0) out.push(['J', 0, junk]);
  return out;
}

function adjustedRate(row: LineRow, prev: LineRow[], pool: LineRow[]): number {
  if (prev.length === 0) return row[2];
  const counts: Partial<Record<LineCat, number>> = {};
  for (const [c] of prev) if (SPECIALS.has(c)) counts[c] = (counts[c] ?? 0) + 1;
  const removed: LineCat[] = [];
  for (const c of Object.keys(counts) as LineCat[]) {
    const n = counts[c]!; const max = SPECIAL_MAX[c]!;
    if (n > max || (c === row[0] && n + 1 > max)) return 0;
    if (n === max) removed.push(c);
  }
  if (removed.length === 0) return row[2];
  let total = 100;
  for (const [c, , r] of pool) if (removed.includes(c)) total -= r;
  return (row[2] / total) * 100;
}

const enumCache = new Map<string, Outcome[]>();

/** All 3-line outcomes over the consolidated pools for the given relevant categories. */
export function enumerate(table: TableSlot, cube: CubeKind, itemLevel: number, relevantCats: LineCat[]): Outcome[] {
  const band = itemLevel > 150 ? 'hi' : 'lo';
  const relevant = new Set(relevantCats);
  const key = `${table}|${cube}|${band}|${[...relevant].sort().join(',')}`;
  const hit = enumCache.get(key);
  if (hit) return hit;
  const pools = linePools(table, cube, itemLevel).map(r => consolidate(r, relevant));
  const out: Outcome[] = [];
  for (const a of pools[0]) {
    const pa = adjustedRate(a, [], pools[0]);
    for (const b of pools[1]) {
      const pb = adjustedRate(b, [a], pools[1]);
      if (pb === 0) continue;
      for (const c of pools[2]) {
        const pc = adjustedRate(c, [a, b], pools[2]);
        if (pc === 0) continue;
        out.push({ cats: [a[0], b[0], c[0]], vals: [a[1], b[1], c[1]], p: (pa / 100) * (pb / 100) * (pc / 100) });
      }
    }
  }
  enumCache.set(key, out);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Target specs (predicates over outcomes)
// ---------------------------------------------------------------------------------------------

export type Measure = (o: Pick<Outcome, 'cats' | 'vals'>) => number;

export const count = (cat: LineCat): Measure => o => o.cats.reduce((n, c) => n + (c === cat ? 1 : 0), 0);
export const sum = (...cats: LineCat[]): Measure => o =>
  o.cats.reduce((s, c, i) => s + (cats.includes(c) ? o.vals[i] : 0), 0);

export interface TargetSpec {
  label: string;
  /** Categories the predicate / representative lines need (others are lumped as junk). */
  cats: LineCat[];
  test: (o: Pick<Outcome, 'cats' | 'vals'>) => boolean;
}

/** JSON-friendly target definition (used by cube.test-vectors.json). */
export interface SpecDef {
  label?: string;
  /** Each entry: sum of these categories' values must be >= min. */
  sums?: { cats: LineCat[]; min: number }[];
  /** Each entry: number of lines of this category must be >= n. */
  counts?: Partial<Record<LineCat, number>>;
  /** Xenon all-stat equivalent (ALL + (STR+DEX+LUK)/3) must be >= this. */
  xenonMin?: number;
}

export function makeSpec(def: SpecDef): TargetSpec {
  const cats = new Set<LineCat>();
  def.sums?.forEach(s => s.cats.forEach(c => cats.add(c)));
  Object.keys(def.counts ?? {}).forEach(c => cats.add(c as LineCat));
  if (def.xenonMin != null) ['ALL', 'STR', 'DEX', 'LUK'].forEach(c => cats.add(c as LineCat));
  const xen = statSpec({ kind: 'xenon' }).measure;
  return {
    label: def.label ?? JSON.stringify(def),
    cats: [...cats],
    test: o =>
      (def.sums ?? []).every(s => sum(...s.cats)(o) >= s.min) &&
      Object.entries(def.counts ?? {}).every(([c, n]) => count(c as LineCat)(o) >= (n as number)) &&
      (def.xenonMin == null || xen(o) >= def.xenonMin),
  };
}

export function probability(table: TableSlot, cube: CubeKind, itemLevel: number, spec: TargetSpec): number {
  let p = 0;
  for (const o of enumerate(table, cube, itemLevel, spec.cats)) if (spec.test(o)) p += o.p;
  return p;
}

const CAT_KEY: Partial<Record<LineCat, PotLine['key']>> = {
  STR: 'STRp', DEX: 'DEXp', INT: 'INTp', LUK: 'LUKp', ALL: 'ALLp', HP: 'HPp', ATT: 'ATTp', MATT: 'MATTp',
  BOSS: 'BOSSp', CD: 'CRITDMGp', CDR: 'CDR',
};
const KEY_CAT: Record<string, LineCat> = Object.fromEntries(
  Object.entries(CAT_KEY).map(([c, k]) => [k as string, c as LineCat]),
);

/**
 * Representative lines when the target is hit: the conditional expectation of each relevant
 * category's summed value. IED lines are folded into one equivalent line with the expected
 * multiplicative value 1 - prod(1 - v/100).
 */
export function representativeLines(table: TableSlot, cube: CubeKind, itemLevel: number, spec: TargetSpec): PotLine[] {
  const outs = enumerate(table, cube, itemLevel, spec.cats);
  let pt = 0; const sums: Partial<Record<LineCat, number>> = {}; let ied = 0;
  for (const o of outs) {
    if (!spec.test(o)) continue;
    pt += o.p;
    let keep = 1;
    o.cats.forEach((c, i) => {
      if (c === 'IED') keep *= 1 - o.vals[i] / 100;
      else if (CAT_KEY[c]) sums[c] = (sums[c] ?? 0) + o.p * o.vals[i];
    });
    ied += o.p * (1 - keep) * 100;
  }
  if (pt === 0) return [];
  const lines: PotLine[] = [];
  for (const c of Object.keys(sums) as LineCat[]) {
    const v = round2(sums[c]! / pt);
    if (v > 0) lines.push({ key: CAT_KEY[c]!, value: v });
  }
  if (ied > 0) lines.push({ key: 'IED', value: round2(ied / pt) });
  return lines;
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Converts an equip's current potential lines to the outcome shape so specs can test them. */
export function potToOutcome(pot: PotLine[]): Pick<Outcome, 'cats' | 'vals'> {
  const cats: LineCat[] = []; const vals: number[] = [];
  for (const l of pot) { cats.push(l.key === 'IED' ? 'IED' : (KEY_CAT[l.key] ?? 'J')); vals.push(l.value); }
  return { cats, vals };
}

// ---------------------------------------------------------------------------------------------
// Ladders per slot / class
// ---------------------------------------------------------------------------------------------

type StatMode = { kind: 'normal'; main: 'STR' | 'DEX' | 'INT' | 'LUK' } | { kind: 'hp' } | { kind: 'xenon' };

function statMode(cls: ClassDef): StatMode {
  if (cls.special === 'xenon') return { kind: 'xenon' };
  if (cls.special === 'demon-avenger' || cls.main === 'HP') return { kind: 'hp' };
  return { kind: 'normal', main: cls.main as 'STR' | 'DEX' | 'INT' | 'LUK' };
}

function statSpec(mode: StatMode): { cats: LineCat[]; measure: Measure; name: string } {
  if (mode.kind === 'hp') return { cats: ['HP'], measure: sum('HP'), name: 'Max HP' };
  if (mode.kind === 'xenon') {
    const all = sum('ALL'); const sdl = sum('STR', 'DEX', 'LUK');
    return { cats: ['ALL', 'STR', 'DEX', 'LUK'], measure: o => all(o) + sdl(o) / 3, name: 'All Stat (Xenon)' };
  }
  return { cats: [mode.main, 'ALL'], measure: sum(mode.main, 'ALL'), name: mode.main };
}

function statLadder(itemLevel: number, mode: StatMode): number[] {
  const P = primeStat(itemLevel);
  if (mode.kind === 'xenon') {
    const A = P - 3, a = P - 6; // all-stat prime / non-prime
    return uniq([A + a, 2 * A, 3 * a, A + 2 * a, 2 * A + a, 3 * A]);
  }
  const N = P - 3;
  return uniq([P + N, 2 * P, 3 * N, P + 2 * N, 2 * P + N, 3 * P]);
}

const uniq = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

export function buildSpecs(table: TableSlot, itemLevel: number, cls: ClassDef): TargetSpec[] {
  const specs: TargetSpec[] = [];
  if (table === 'weapon' || table === 'secondary' || table === 'emblem') {
    const A: LineCat = cls.attack === 'MATT' ? 'MATT' : 'ATT';
    const Aname = cls.attack === 'MATT' ? 'MATT' : 'ATT';
    const P = primeStat(itemLevel), N = P - 3;
    const hasBoss = table !== 'emblem';
    const cats: LineCat[] = hasBoss ? [A, 'BOSS', 'IED'] : [A, 'IED'];
    for (const t of uniq([P, P + N, 2 * P, P + 2 * N, 2 * P + N, 3 * P])) {
      specs.push({ label: `≥ ${t}% ${Aname}`, cats, test: o => sum(A)(o) >= t });
    }
    const cA = count(A), cB = count('BOSS'), cI = count('IED');
    for (const total of [2, 3]) {
      for (let a = 0; a <= total; a++) for (let b = 0; a + b <= total; b++) {
        const c = total - a - b;
        if (a === total) continue; // pure ATT covered by the % thresholds
        if (!hasBoss && b > 0) continue;
        const parts = [a && `${a}L ${Aname}`, b && `${b}L Boss`, c && `${c}L IED`].filter(Boolean);
        specs.push({
          label: parts.join(' + ') + (total === 2 ? ' (+any)' : ''),
          cats,
          test: o => cA(o) >= a && cB(o) >= b && cI(o) >= c,
        });
      }
    }
    return specs;
  }

  const mode = statMode(cls);
  const st = statSpec(mode);
  const extra: LineCat[] = table === 'gloves' ? ['CD'] : table === 'hat' ? ['CDR'] : [];
  const cats = [...st.cats, ...extra];
  for (const t of statLadder(itemLevel, mode)) {
    const label = mode.kind === 'xenon' ? `≥ ${t}% all stat (Xenon equiv.)` : `≥ ${t}% ${st.name}`;
    specs.push({ label, cats, test: o => st.measure(o) >= t });
  }
  const N = primeStat(itemLevel) - 3;
  const lowStat = mode.kind === 'xenon' ? N - 3 : N;
  if (table === 'gloves') {
    const cd = count('CD');
    const combos: [number, number][] = [[1, 0], [1, lowStat], [1, 2 * lowStat], [2, 0], [2, lowStat], [3, 0]];
    for (const [n, s] of combos) {
      specs.push({
        label: `${n}L Crit Dmg` + (s ? ` + ≥ ${s}% ${st.name}` : ''), cats,
        test: o => cd(o) >= n && st.measure(o) >= s,
      });
    }
  }
  if (table === 'hat') {
    const cdr = sum('CDR');
    const combos: [number, number][] = [[2, 0], [3, 0], [4, 0], [2, lowStat], [3, lowStat], [4, lowStat], [2, 2 * lowStat]];
    for (const [sec, s] of combos) {
      specs.push({
        label: `≥ ${sec}s CDR` + (s ? ` + ≥ ${s}% ${st.name}` : ''), cats,
        test: o => cdr(o) >= sec && st.measure(o) >= s,
      });
    }
  }
  return specs;
}

// ---------------------------------------------------------------------------------------------
// Cost model
// ---------------------------------------------------------------------------------------------

export interface Stage<C extends string = CubeKind> { cube: C; p: number; unit: number }

export interface CostOptions {
  market?: Partial<MarketSettings>;
  /** Restrict the cubes considered (default both). */
  cubes?: CubeKind[];
}

/** Cheapest cube to roll a Legendary target, with its per-cube probability. */
export function rollStage(table: TableSlot, itemLevel: number, spec: TargetSpec, opts: CostOptions = {}): Stage | null {
  let best: Stage | null = null;
  for (const cube of opts.cubes ?? CUBE_KINDS) {
    const p = probability(table, cube, itemLevel, spec);
    if (p <= 0) continue;
    const unit = unitCost(cube, itemLevel, opts.market);
    if (!best || unit / p < best.unit / best.p) best = { cube, p, unit };
  }
  return best;
}

/** Geometric quantile: smallest n with P(N <= n) >= q. */
export function geoQuantile(p: number, q: number): number {
  if (p >= 1) return 1;
  return Math.max(1, Math.ceil(Math.log(1 - q) / Math.log(1 - p)));
}

/** Geometric cost of rolling until a hit (chance `p` per cube, `unit` mesos per cube). Exact. */
export function rollCost(p: number, unit: number): CostDistribution {
  return { mean: unit / p, p50: geoQuantile(p, 0.5) * unit, p75: geoQuantile(p, 0.75) * unit, p90: geoQuantile(p, 0.9) * unit };
}

export interface CubePlan { roll: Stage; cost: CostDistribution; expectedCubes: number }

/**
 * Expected meso cost to hit `spec` on a Legendary item.
 * Example: expectedCubeCost('weapon', 200, spec).
 */
export function expectedCubeCost(
  slot: EquipSlot | TableSlot, itemLevel: number, spec: TargetSpec, opts: CostOptions = {},
): CubePlan | null {
  const table = (LEGENDARY_LINES as Record<string, unknown>)[slot] ? (slot as TableSlot) : tableSlotFor(slot as EquipSlot);
  if (!table) return null;
  const roll = rollStage(table, itemLevel, spec, opts);
  if (!roll) return null;
  return { roll, cost: rollCost(roll.p, roll.unit), expectedCubes: 1 / roll.p };
}

// ---------------------------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------------------------

export const cubeModule: CubeModule = {
  targets(item: ItemDef, equip: Equip, cls: ClassDef, bonus: boolean, market: MarketSettings, weights?: StatWeights, charLevel?: number): CubeTarget[] {
    if (bonus) return weights ? bonusTargets(item, equip, cls, market, weights, charLevel ?? 260) : [];
    const table = tableSlotFor(equip.slot);
    if (!table) return [];
    const level = item.level;
    const have = potToOutcome(equip.pot ?? []);
    const opts: CostOptions = { market };
    const out: CubeTarget[] = [];
    for (const spec of buildSpecs(table, level, cls)) {
      if (spec.test(have)) continue; // already satisfied
      const roll = rollStage(table, level, spec, opts);
      if (!roll) continue;
      out.push({
        label: spec.label,
        lines: representativeLines(table, roll.cube, level, spec),
        tier: 'legendary',
        cost: rollCost(roll.p, roll.unit),
        pPerCube: roll.p,
        cubeName: CUBE_DISPLAY[roll.cube],
      });
    }
    return out;
  },
};

/** Sum a list of potential lines into a StatBundle (helper for callers/tests). */
export function linesToBundle(lines: PotLine[]): StatBundle {
  const b: StatBundle = {};
  for (const l of lines) {
    if (l.key === 'IED') (b.IED ??= []).push(l.value);
    else (b as Record<string, number>)[l.key] = ((b as Record<string, number>)[l.key] ?? 0) + l.value;
  }
  return b;
}
