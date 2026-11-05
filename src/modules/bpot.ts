// Bonus potential cubing for GMS Interactive worlds (Heroic / Reboot worlds have no bonus potential).
//
// What it models
// - Cubes: Bonus Glowing Cube (2,400 NX) and Bonus Bright Cube (3,500 NX) from the Interactive Cash
//   Shop (MapleStory Wiki, Cube). Their meso price is whatever the player pays, so both are settings;
//   the defaults use 10,000 mesos per NX, the same rate that makes a 1,200 NX Glowing Cube = 12M.
//   The per-use cubing fee is the same as for main potential.
// - Line odds: Nexon's official KMS Additional Cube page (item 5062500 = GMS Bonus Glowing Cube), see
//   bpot.data.ts. Lines 2 and 3 are Legendary ("prime") only ~0.5% of the time on Legendary rank.
//   Bonus potential has no capped lines, so the three lines are independent.
// - No tier-ups (Kai): bonus potential is assumed to already be Legendary.
// - Targets: bonus potential mixes % and flat lines, so a target is a BONUS SCORE threshold, like
//   flames: each line is scored by the player's own FD weights in units of 1% main stat (Xenon: 1%
//   All Stat, Demon Avenger: 1% HP; weapon / secondary / emblem: 1% ATT or MATT). A target's cost is
//   rolling until score >= target on the cheapest bonus cube.
// - The engine values each target by the conditional expected lines given a hit (IED folded into
//   one equivalent line), exactly like main potential.

import type { ClassDef, Equip, EquipSlot, ItemDef, MarketSettings, PotLine, StatBundle } from '../core/types';
import type { CubeTarget, StatWeights } from '../core/modules';
import { BONUS_LEGENDARY_LINES, type BpotCat, type BpotPools, type BpotSlot } from './bpot.data';
import { cubeFee, rollCost } from './cube';

export type BonusCubeKind = 'bonusGlowing' | 'bonusBright';
export const BONUS_CUBE_KINDS: BonusCubeKind[] = ['bonusGlowing', 'bonusBright'];
export const BONUS_CUBE_NX: Record<BonusCubeKind, number> = { bonusGlowing: 2400, bonusBright: 3500 };
export const DEFAULT_MESO_PER_NX = 10_000;
export const BONUS_CUBE_PRICE: Record<BonusCubeKind, number> = {
  bonusGlowing: BONUS_CUBE_NX.bonusGlowing * DEFAULT_MESO_PER_NX,
  bonusBright: BONUS_CUBE_NX.bonusBright * DEFAULT_MESO_PER_NX,
};
export const BONUS_CUBE_DISPLAY: Record<BonusCubeKind, string> = { bonusGlowing: 'Bonus Glowing Cube', bonusBright: 'Bonus Bright Cube' };

export function bonusUnitCost(cube: BonusCubeKind, itemLevel: number, market?: Partial<MarketSettings>): number {
  const price = market?.cubeCostOverride?.[cube] ?? BONUS_CUBE_PRICE[cube];
  const fee = (market as { includeCubeFee?: boolean } | undefined)?.includeCubeFee === false ? 0 : cubeFee(itemLevel);
  return price + fee;
}

export function bonusSlotFor(slot: EquipSlot): BpotSlot | null {
  switch (slot) {
    case 'ring1': case 'ring2': case 'ring3': case 'ring4': return 'ring';
    case 'pendant1': case 'pendant2': return 'pendant';
    case 'badge': return 'heart'; // no badge table; same approximation as main potential
    case 'pocket': return null;
    default: return (slot in BONUS_LEGENDARY_LINES ? slot : null) as BpotSlot | null;
  }
}

/** Weapon-type tables score in ATT % units, everything else in main stat % units. */
export function isAttTable(t: BpotSlot): boolean {
  return t === 'weapon' || t === 'secondary' || t === 'emblem';
}

const PER_LV: Partial<Record<BpotCat, keyof StatBundle>> = { STRlv: 'STR_PER_LV', DEXlv: 'DEX_PER_LV', INTlv: 'INT_PER_LV', LUKlv: 'LUK_PER_LV' };

/** Bundle key of a line category (null = no damage value). */
function keyOf(c: BpotCat): keyof StatBundle | 'IED' | null {
  if (c === 'J' || c === 'CDR') return null;
  return PER_LV[c] ?? (c as keyof StatBundle);
}

export interface ScoreUnit { key: string; name: string; w: number }

export function scoreUnit(cls: ClassDef, w: StatWeights, attTable: boolean): ScoreUnit {
  const W = w as Record<string, number>;
  if (attTable) {
    const k = `${cls.attack}p`;
    return { key: k, name: cls.attack === 'MATT' ? 'MATT %' : 'ATT %', w: W[k] ?? 0 };
  }
  if (cls.special === 'xenon') return { key: 'ALLp', name: 'All Stat %', w: W.ALLp ?? 0 };
  return { key: `${cls.main}p`, name: `${cls.main === 'HP' ? 'Max HP' : cls.main} %`, w: W[`${cls.main}p`] ?? 0 };
}

/** Weight of one unit of a bundle key, in main-stat units. */
function keyWeight(key: string, w: StatWeights, charLevel: number): number {
  const W = w as Record<string, number>;
  const m = key.match(/^(STR|DEX|INT|LUK)_PER_LV$/);
  if (m) return (W[m[1]] ?? 0) * Math.floor(charLevel / 9);
  return W[key] ?? 0;
}

/** Bonus score of a set of lines (or a bundle) in ScoreUnit units. */
export function bonusScore(lines: PotLine[], w: StatWeights, unit: ScoreUnit, charLevel: number): number {
  if (!(unit.w > 0)) return 0;
  let s = 0;
  for (const l of lines) if (l?.key) s += keyWeight(l.key, w, charLevel) * (l.value || 0);
  return s / unit.w;
}

interface Row { key: string | null; value: number; p: number; score: number; label: string }

const LABEL: Record<string, string> = {
  ATTp: 'ATT %', MATTp: 'MATT %', ALLp: 'All Stat %', HPp: 'Max HP %', DMGp: 'Damage %', BOSSp: 'Boss %', IED: 'IED %',
  CRITDMGp: 'Crit Dmg %', ATT: 'ATT', MATT: 'MATT', HP: 'Max HP',
};
function rowLabel(key: string, v: number): string {
  const m = key.match(/^(STR|DEX|INT|LUK)(p|_PER_LV)?$/);
  if (m) return m[2] === 'p' ? `${m[1]} ${v}%` : m[2] ? `${m[1]} +${v} per 9 Lv` : `${m[1]} +${v}`;
  const l = LABEL[key] ?? key;
  return l.endsWith('%') ? `${l.slice(0, -2)} ${v}%` : `${l} +${v}`;
}

/** Per-line distributions (rows with no score are merged into one junk row). */
function linePools(pools: BpotPools, w: StatWeights, unit: ScoreUnit, charLevel: number): Row[][] {
  return pools.map((rows) => {
    const out: Row[] = []; let junk = 0;
    for (const [c, v, r] of rows) {
      const key = keyOf(c);
      const score = key && unit.w > 0 ? (keyWeight(key, w, charLevel) * v) / unit.w : 0;
      if (!key || !(score > 1e-9)) { junk += r; continue; }
      out.push({ key, value: v, p: r / 100, score, label: rowLabel(key, v) });
    }
    if (junk > 0) out.push({ key: null, value: 0, p: junk / 100, score: 0, label: 'any' });
    return out;
  });
}

interface Outcome { score: number; p: number; rows: [Row, Row, Row] }

const cache = new Map<string, Outcome[]>();

/** All 3-line outcomes, sorted by score (highest first). */
export function bonusOutcomes(table: BpotSlot, itemLevel: number, w: StatWeights, unit: ScoreUnit, charLevel: number): Outcome[] {
  const band = itemLevel > 150 ? 'hi' : 'lo';
  const key = JSON.stringify([table, band, w, unit.key, Math.floor(charLevel / 9)]);
  const hit = cache.get(key);
  if (hit) return hit;
  const [a, b, c] = linePools(BONUS_LEGENDARY_LINES[table][band], w, unit, charLevel);
  const out: Outcome[] = [];
  for (const x of a) for (const y of b) for (const z of c) {
    out.push({ score: x.score + y.score + z.score, p: x.p * y.p * z.p, rows: [x, y, z] });
  }
  out.sort((u, v) => v.score - u.score);
  if (cache.size > 64) cache.clear();
  cache.set(key, out);
  return out;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/** P(score >= t), expected lines given a hit, and the most common hit (for the instruction). */
export function conditional(outs: Outcome[], t: number): { p: number; lines: PotLine[]; example: string } {
  let p = 0; let ied = 0;
  const sums: Record<string, number> = {};
  const combos = new Map<string, number>();
  for (const o of outs) {
    if (o.score < t - 1e-9) break;
    p += o.p;
    let keep = 1;
    for (const r of o.rows) {
      if (!r.key) continue;
      if (r.key === 'IED') keep *= 1 - r.value / 100;
      else sums[r.key] = (sums[r.key] ?? 0) + o.p * r.value;
    }
    ied += o.p * (1 - keep) * 100;
    const sig = o.rows.filter((r) => r.key).map((r) => r.label).sort().join(' + ');
    combos.set(sig, (combos.get(sig) ?? 0) + o.p);
  }
  if (!(p > 0)) return { p: 0, lines: [], example: '' };
  const lines: PotLine[] = [];
  for (const [k, v] of Object.entries(sums)) if (v / p > 0) lines.push({ key: k as PotLine['key'], value: r2(v / p) });
  if (ied > 0) lines.push({ key: 'IED', value: r2(ied / p) });
  let best = ''; let bp = -1;
  for (const [sig, q] of combos) if (q > bp) { bp = q; best = sig; }
  return { p, lines, example: best };
}

/** "Bonus score = LUK % + 1.2 × All Stat % + 0.11 × LUK + 0.55 × ATT + ..." */
export function bonusScoreFormula(cls: ClassDef, w: StatWeights, unit: ScoreUnit, charLevel: number, attTable: boolean): string {
  const f = (x: number) => (x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x.toFixed(2));
  const mains = cls.special === 'xenon' ? ['STR', 'DEX', 'LUK'] : [cls.main];
  const keys: [string, string][] = [];
  if (attTable) keys.push([`${cls.attack}p`, LABEL[`${cls.attack}p`]]);
  for (const s of mains) keys.push([`${s}p`, s === 'HP' ? 'Max HP %' : `${s} %`]);
  if (cls.special !== 'demon-avenger') keys.push(['ALLp', 'All Stat %']);
  if (attTable) keys.push(['BOSSp', 'Boss %'], ['DMGp', 'Damage %'], ['IED', 'IED %']);
  keys.push([cls.attack, cls.attack === 'MATT' ? 'flat MATT' : 'flat ATT']);
  for (const s of mains) if (s !== 'HP') keys.push([s, `flat ${s}`]);
  if (cls.special === 'demon-avenger') keys.push(['HP', 'flat Max HP']);
  const parts: string[] = [];
  for (const [k, name] of keys) {
    const x = keyWeight(k, w, charLevel) / unit.w;
    if (!(x > 0.005)) continue;
    parts.push(k === unit.key ? name : `${f(x)} × ${name}`);
  }
  const lv = Math.floor(charLevel / 9);
  return `Bonus score = ${parts.join(' + ')}; a "+2 per 9 levels" line counts as +${2 * lv} flat at your level (in ${unit.name} equivalents, from your FD values)`;
}

const RUNG_TAILS = [0.3, 0.1, 0.03, 0.01, 0.003, 0.001, 0.0003];

export function bonusTargets(item: ItemDef, equip: Equip, cls: ClassDef, market: MarketSettings, w: StatWeights, charLevel: number): CubeTarget[] {
  const table = bonusSlotFor(equip.slot);
  if (!table) return [];
  const attTable = isAttTable(table);
  const unit = scoreUnit(cls, w, attTable);
  if (!(unit.w > 0)) return [];
  const outs = bonusOutcomes(table, item.level, w, unit, charLevel);
  const current = bonusScore(equip.bpot ?? [], w, unit, charLevel);

  // Cheapest bonus cube per roll (both share the same odds, so this is the lower price).
  const cheapest = (): { cube: BonusCubeKind; unit: number } => {
    const [a, b] = BONUS_CUBE_KINDS.map((cube) => ({ cube, unit: bonusUnitCost(cube, item.level, market) }));
    return b.unit < a.unit ? b : a;
  };

  const formula = bonusScoreFormula(cls, w, unit, charLevel, attTable);
  const out: CubeTarget[] = [];
  // Exact E[FD | hit]: FD of every hitting outcome, computed once (outcomes are sorted by score,
  // so every target's hits are a prefix) and shared by all targets of this item.
  let lowest = Infinity; let fds: Float64Array | null = null; let n = 0;
  const expectFd = (threshold: number) => (fdOf: (lines: PotLine[]) => number): number => {
    if (!fds) {
      n = outs.findIndex((o) => o.score < lowest - 1e-9); if (n < 0) n = outs.length;
      fds = new Float64Array(n);
      const seen = new Map<string, number>(); // same lines in another order = same FD
      for (let i = 0; i < n; i++) {
        const rows = outs[i].rows.filter((r) => r.key);
        const sig = rows.map((r) => `${r.key}${r.value}`).sort().join(',');
        let v = seen.get(sig);
        if (v === undefined) {
          v = fdOf(rows.map((r) => ({ key: r.key as PotLine['key'], value: r.value })));
          seen.set(sig, v);
        }
        fds[i] = v;
      }
    }
    let p = 0; let e = 0;
    for (let i = 0; i < n && outs[i].score >= threshold - 1e-9; i++) { p += outs[i].p; e += outs[i].p * fds[i]; }
    return p > 0 ? e / p : 0;
  };
  const mk = (label: string, threshold: number) => {
    const c = conditional(outs, threshold);
    if (!(c.p > 0)) return;
    lowest = Math.min(lowest, threshold);
    const roll = cheapest();
    out.push({
      label, lines: c.lines, tier: 'legendary', cost: rollCost(c.p, roll.unit), pPerCube: c.p,
      cubeName: BONUS_CUBE_DISPLAY[roll.cube],
      notes: [formula, c.example ? `most common hit: ${c.example}` : ''].filter(Boolean),
      expectFd: expectFd(threshold),
    });
  };

  // "Any upgrade" only makes sense once there are lines to beat.
  const cur = Math.round(current * 10) / 10;
  if (current > 0) mk(`Bonus score > ${cur} (any upgrade)`, current + 1e-6);
  const seen = new Set<number>();
  for (const q of RUNG_TAILS) {
    // Highest whole score reached with probability >= q.
    let acc = 0; let s: number | undefined;
    for (const o of outs) { acc += o.p; if (acc >= q) { s = o.score; break; } }
    if (s === undefined) continue;
    const t = Math.floor(s + 1e-9);
    if (t <= current + 0.5 || t <= 0 || seen.has(t)) continue;
    seen.add(t);
    mk(`Bonus score ≥ ${t}`, t);
  }
  return out;
}
