// Flame (Bonus Stats) module for the EV calculator.
//
// Sources (see flame-reference.md for the full write-up):
//  - Tier odds, line-count odds and the 19-option pools: Nexon KMS official probability page
//    https://maplestory.nexon.com/Guide/OtherProbability/game/gameAddOption
//  - GMS v.271 patch notes (Sep 9, 2026): meso reset costs 3,000,000, reset rates are identical to
//    Black Rebirth Flames, and you choose to keep the before or after result.
//  - Per-tier values by item level: https://maplestorywiki.net/w/Bonus_Stats/Stat_Tables
//
// Everything here is exact enumeration (no Monte Carlo). Pure functions, no DOM, no network.

import type { ClassDef, Equip, ItemDef, MarketSettings, StatBundle } from '../core/types';
import type { CostDistribution, FlameModule, FlameTarget, StatWeights } from '../core/modules';

// ---------------------------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------------------------

/** Ways to reset bonus stats. `reset` = the v.271 meso reset (Black flame odds, keep better). */
export type FlameSource =
  | 'reset' | 'black' | 'eternal' | 'rainbow' | 'powerful' | 'burning' | 'abyssal' | 'drop';

/**
 * Base tier odds for tiers 1..5 (index 0 = tier 1), from the KMS official page.
 * Flame-advantaged ("boss") items add +2 to the rolled tier (so 3..7).
 */
export const BASE_TIER_ODDS: Record<FlameSource, readonly number[]> = {
  reset:    [0, 0.29, 0.45, 0.25, 0.01],
  black:    [0, 0.29, 0.45, 0.25, 0.01],
  eternal:  [0, 0.29, 0.45, 0.25, 0.01],
  rainbow:  [0, 0.29, 0.45, 0.25, 0.01], // GMS name for Eternal-tier odds in older versions
  powerful: [0.20, 0.30, 0.36, 0.14, 0],
  burning:  [0.20, 0.30, 0.36, 0.14, 0], // v.271: "identical to Powerful", but keep-better
  abyssal:  [0, 0, 0.63, 0.34, 0.03],
  drop:     [0.25, 0.30, 0.30, 0.14, 0.01],
};

/** Sources that let you keep the old flame (so "roll until ≥ X" is a clean geometric process). */
export const KEEPS_BETTER: Record<FlameSource, boolean> = {
  reset: true, black: true, burning: true, abyssal: true,
  eternal: false, rainbow: false, powerful: false, drop: false,
};

/** Number of lines on NON flame-advantaged items when using any Rebirth Flame (1..4). */
export const NON_FA_LINE_COUNT_ODDS: readonly number[] = [0.40, 0.40, 0.16, 0.04];
/** Number of lines on a fresh drop / other acquisition (not used for resets). */
export const NON_FA_LINE_COUNT_ODDS_DROP: readonly number[] = [0.41, 0.40, 0.15, 0.04];

export type LineType =
  | 'STR' | 'DEX' | 'INT' | 'LUK'
  | 'STR+DEX' | 'STR+INT' | 'STR+LUK' | 'DEX+INT' | 'DEX+LUK' | 'INT+LUK'
  | 'HP' | 'MP' | 'REQ' | 'DEF' | 'ATT' | 'MATT'
  | 'BOSS' | 'DMG' | 'ALLp' | 'SPEED' | 'JUMP';

const COMMON_POOL: LineType[] = [
  'STR', 'DEX', 'INT', 'LUK',
  'STR+DEX', 'STR+INT', 'STR+LUK', 'DEX+INT', 'DEX+LUK', 'INT+LUK',
  'HP', 'MP', 'REQ', 'DEF', 'ATT', 'MATT', 'ALLp',
];
/** Weapons: 19 options, each equally likely, drawn without replacement. */
export const WEAPON_POOL: readonly LineType[] = [...COMMON_POOL, 'BOSS', 'DMG'];
/** Everything else (armor, accessories, pocket, heart-less): 19 options. */
export const ARMOR_POOL: readonly LineType[] = [...COMMON_POOL, 'SPEED', 'JUMP'];

/** Pool for an item, applying the official level restrictions. */
export function linePool(level: number, isWeapon: boolean): LineType[] {
  const pool = (isWeapon ? WEAPON_POOL : ARMOR_POOL).slice();
  return pool.filter((l) => {
    if (isWeapon && l === 'BOSS') return level >= 90;
    if (!isWeapon && (l === 'ATT' || l === 'MATT')) return level >= 60;
    if (!isWeapon && l === 'ALLp') return level >= 70;
    return true;
  });
}

/** Single-stat value per tier (STR/DEX/INT/LUK and DEF). */
export function singleStatPerTier(level: number): number {
  if (level >= 230) return 12;
  if (level >= 200) return 11;
  return Math.floor(level / 20) + 1;
}

/** Dual-stat value per tier (each of the two stats gets this). Also the weapon ATT level factor. */
export function dualStatPerTier(level: number): number {
  if (level >= 250) return 7;
  if (level >= 200) return 6;
  return Math.floor(level / 40) + 1;
}

/** Max HP / Max MP per tier. */
export function hpPerTier(level: number): number {
  if (level < 10) return 3;
  if (level >= 200) return 600 + 20 * Math.min(5, Math.floor((level - 200) / 10));
  return Math.floor(level / 10) * 30;
}

/**
 * Weapon ATT/MATT line as a % of the weapon's base attack.
 * Normal: f × tier × 1.1^(tier−1); flame-advantaged: f × tier × 1.1^(tier−3), with
 * f = dualStatPerTier(level) (matches the wiki table rows 0-39 … 200-249, 250+).
 */
export function weaponAttPercent(level: number, tier: number, flameAdvantaged: boolean): number {
  return dualStatPerTier(level) * tier * Math.pow(1.1, tier - (flameAdvantaged ? 3 : 1));
}

/** Flat ATT from a weapon ATT line. Rounded up (as in misaomaki's simulator; ±1 ATT uncertainty). */
export function weaponAttValue(baseAtt: number, level: number, tier: number, fa: boolean): number {
  if (baseAtt <= 0 || tier <= 0) return 0;
  return Math.ceil((baseAtt * weaponAttPercent(level, tier, fa)) / 100 - 1e-9);
}

// ---------------------------------------------------------------------------------------------
// Item spec + per-line values
// ---------------------------------------------------------------------------------------------

export interface FlameItemSpec {
  level: number;
  isWeapon: boolean;
  /** Boss / flame-advantaged item: always 4 lines, tier +2. */
  flameAdvantaged: boolean;
  /** Weapon base ATT / MATT (only used for weapons). */
  baseAtt?: number;
  baseMatt?: number;
}

/** Stats a single line at a given tier adds. */
export function lineStats(line: LineType, tier: number, spec: FlameItemSpec): StatBundle {
  const s = singleStatPerTier(spec.level) * tier;
  const d = dualStatPerTier(spec.level) * tier;
  switch (line) {
    case 'STR': case 'DEX': case 'INT': case 'LUK': return { [line]: s };
    case 'STR+DEX': return { STR: d, DEX: d };
    case 'STR+INT': return { STR: d, INT: d };
    case 'STR+LUK': return { STR: d, LUK: d };
    case 'DEX+INT': return { DEX: d, INT: d };
    case 'DEX+LUK': return { DEX: d, LUK: d };
    case 'INT+LUK': return { INT: d, LUK: d };
    case 'HP': return { HP: hpPerTier(spec.level) * tier };
    case 'ATT':
      return { ATT: spec.isWeapon ? weaponAttValue(spec.baseAtt ?? 0, spec.level, tier, spec.flameAdvantaged) : tier };
    case 'MATT':
      return { MATT: spec.isWeapon ? weaponAttValue(spec.baseMatt ?? 0, spec.level, tier, spec.flameAdvantaged) : tier };
    case 'BOSS': return { BOSSp: 2 * tier };
    case 'DMG': return { DMGp: tier };
    case 'ALLp': return { ALLp: tier };
    default: return {}; // MP, REQ, DEF, SPEED, JUMP: no damage value
  }
}

/** Tier probabilities on this item (index = tier 0..7). */
export function tierOdds(source: FlameSource, flameAdvantaged: boolean): number[] {
  const out = new Array(8).fill(0);
  BASE_TIER_ODDS[source].forEach((p, i) => { out[i + 1 + (flameAdvantaged ? 2 : 0)] = p; });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Exact outcome distribution
// ---------------------------------------------------------------------------------------------

export interface FlameOutcomeDistribution {
  /** Lines tracked individually; any other line is lumped as "irrelevant". */
  lines: LineType[];
  /** Flat array: outcome i has tier tiers[i*lines.length + j] for lines[j] (0 = line absent). */
  tiers: Uint8Array;
  probs: Float64Array;
  /** Flat matrix: outcome i, stat STAT_KEYS[k] at stats[i*STAT_KEYS.length + k]. */
  stats: Float64Array;
  spec: FlameItemSpec;
  source: FlameSource;
}

/** Stat keys tracked in the outcome matrix (StatBundle keys). */
export const STAT_KEYS = ['STR', 'DEX', 'INT', 'LUK', 'HP', 'ATT', 'MATT', 'ALLp', 'BOSSp', 'DMGp'] as const;
const K = STAT_KEYS.length;

function bundleToVec(b: StatBundle): Float64Array {
  const v = new Float64Array(K);
  STAT_KEYS.forEach((k, i) => { v[i] = (b[k] as number | undefined) ?? 0; });
  return v;
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/**
 * Exact distribution of one reset over the tiers of the `relevant` lines.
 * Lines are 4 (flame-advantaged) or 1-4 distinct options drawn uniformly from the 19-option pool;
 * each line's tier is independent.
 */
export function flameOutcomeDistribution(
  spec: FlameItemSpec,
  source: FlameSource = 'reset',
  relevant?: LineType[],
): FlameOutcomeDistribution {
  const pool = linePool(spec.level, spec.isWeapon);
  const lines = (relevant ?? pool).filter((l) => pool.includes(l));
  const R = lines.length;
  const N = pool.length;
  const odds = tierOdds(source, spec.flameAdvantaged);
  const tierList: [number, number][] = [];
  odds.forEach((p, t) => { if (p > 0) tierList.push([t, p]); });

  const lineCountOdds = spec.flameAdvantaged
    ? [0, 0, 0, 1]
    : source === 'drop' ? NON_FA_LINE_COUNT_ODDS_DROP : NON_FA_LINE_COUNT_ODDS;
  // P(a particular set of k relevant lines is exactly the relevant part of the draw)
  const pSubset = new Array(5).fill(0);
  for (let k = 0; k <= 4; k++) {
    let p = 0;
    lineCountOdds.forEach((pn, idx) => {
      const n = idx + 1;
      if (pn === 0 || k > n) return;
      p += (pn * choose(N - R, n - k)) / choose(N, n);
    });
    pSubset[k] = p;
  }

  // Per line/tier stat vectors.
  const lineVec: Float64Array[][] = lines.map((l) => {
    const arr: Float64Array[] = [];
    for (let t = 0; t <= 7; t++) arr.push(bundleToVec(t ? lineStats(l, t, spec) : {}));
    return arr;
  });
  // Count outcomes first so we can allocate typed arrays once.
  let count = 0;
  for (let k = 0; k <= Math.min(4, R); k++) if (pSubset[k] > 0) count += choose(R, k) * Math.pow(tierList.length, k);
  const tiers = new Uint8Array(count * R);
  const probs = new Float64Array(count);
  const stats = new Float64Array(count * K);
  let idx = 0;
  const row = new Array(R).fill(0);
  const acc: Float64Array[] = [0, 1, 2, 3, 4].map(() => new Float64Array(K));
  const chosen: number[] = [];
  const emit = (i: number, pp: number, k: number) => {
    if (i === k) {
      for (let j = 0; j < R; j++) tiers[idx * R + j] = row[j];
      probs[idx] = pp * pSubset[k];
      stats.set(acc[k], idx * K);
      idx++;
      return;
    }
    const line = chosen[i];
    for (const [t, pt] of tierList) {
      row[line] = t;
      const a = acc[i], b = acc[i + 1], v = lineVec[line][t];
      for (let q = 0; q < K; q++) b[q] = a[q] + v[q];
      emit(i + 1, pp * pt, k);
    }
    row[line] = 0;
  };
  const rec = (start: number) => {
    const k = chosen.length;
    if (pSubset[k] > 0) emit(0, 1, k);
    if (k === 4) return;
    for (let j = start; j < R; j++) {
      chosen.push(j);
      rec(j + 1);
      chosen.pop();
    }
  };
  rec(0);
  return { lines, tiers, probs, stats, spec, source };
}

/** Stats of outcome i. */
export function outcomeStats(dist: FlameOutcomeDistribution, i: number): StatBundle {
  const out: StatBundle = {};
  for (let q = 0; q < K; q++) {
    const v = dist.stats[i * K + q];
    if (v) (out as Record<string, number>)[STAT_KEYS[q]] = v;
  }
  return out;
}


// ---------------------------------------------------------------------------------------------
// Flame score
// ---------------------------------------------------------------------------------------------

/** Score weights in "main stat equivalents". */
export interface FlameWeights {
  /** Per point of each stat key (main = 1). */
  stat: Partial<Record<'STR' | 'DEX' | 'INT' | 'LUK' | 'HP', number>>;
  /** Per flat ATT or MATT (whichever the class uses). */
  att: number;
  /** Per 1% All Stat. */
  allPct: number;
  /** Per 1% boss damage / damage (weapons). */
  bossPct: number;
  dmgPct: number;
}

/**
 * Community defaults (WhackyBeanz flame guide: main 1, secondary 1/8, ATT 4, All Stat% 10).
 * Boss/damage default to 0 because weapons are ranked by tier ladders, not score.
 * These are only used to pick ladder thresholds; the engine values each target from its StatBundle.
 */
export function defaultWeights(cls: ClassDef): FlameWeights {
  const w: FlameWeights = { stat: {}, att: 4, allPct: 10, bossPct: 0, dmgPct: 0 };
  if (cls.special === 'xenon') {
    // Xenon: STR, DEX and LUK all count as main stat; All Stat% hits all three. Rough.
    w.stat = { STR: 1, DEX: 1, LUK: 1 };
    w.att = 12;
    w.allPct = 30;
    return w;
  }
  if (cls.special === 'demon-avenger' || cls.main === 'HP') {
    // Demon Avenger: HP lines are main stat; All Stat% does not raise HP. Rough.
    w.stat = { HP: 1, STR: 0.5 };
    w.att = 90;
    w.allPct = 3;
    return w;
  }
  w.stat[cls.main as 'STR'] = 1;
  for (const s of cls.secondary) if (s !== cls.main) w.stat[s as 'STR'] = 0.125;
  // Kanna: +1 Magic ATT per 700 Max HP (not affected by MATT%), so flat HP is worth ATT/700.
  if (cls.special === 'kanna') w.stat.HP = w.att / 700;
  return w;
}

/**
 * Build weights from the damage module's marginal FD (most accurate). `fd(bundle)` should return
 * the % FD gained from adding `bundle` to the player's current stats.
 */
export function weightsFromMarginalFd(fd: (b: StatBundle) => number, cls: ClassDef): FlameWeights {
  const base = defaultWeights(cls);
  const mainKey = cls.special === 'xenon' ? 'STR' : cls.main;
  const unit = 100; // use 100-point bumps to stay out of rounding noise
  const perMain = fd({ [mainKey]: unit } as StatBundle) / unit;
  if (!(perMain > 0)) return base;
  const rel = (b: StatBundle, n: number) => fd(b) / n / perMain;
  const w: FlameWeights = { stat: {}, att: 0, allPct: 0, bossPct: 0, dmgPct: 0 };
  for (const k of Object.keys(base.stat) as ('STR' | 'DEX' | 'INT' | 'LUK' | 'HP')[]) {
    w.stat[k] = rel({ [k]: unit } as StatBundle, unit);
  }
  w.att = rel({ [cls.attack]: 10 } as StatBundle, 10);
  w.allPct = rel({ ALLp: 10 }, 10);
  w.bossPct = rel({ BOSSp: 10 }, 10);
  w.dmgPct = rel({ DMGp: 10 }, 10);
  return w;
}

/**
 * Convert the engine's StatWeights (main-stat equivalents from the damage module, main = 1)
 * into FlameWeights. Missing keys fall back to the community defaults.
 */
export function flameWeightsFromStatWeights(sw: StatWeights | undefined, cls: ClassDef): FlameWeights {
  const w = defaultWeights(cls);
  if (!sw) return w;
  for (const k of Object.keys(w.stat) as ('STR' | 'DEX' | 'INT' | 'LUK' | 'HP')[]) {
    const v = sw[k];
    if (typeof v === 'number' && Number.isFinite(v)) w.stat[k] = v;
  }
  const pick = (v: number | undefined, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  w.att = pick(sw[cls.attack], w.att);
  w.allPct = pick(sw.ALLp, w.allPct);
  w.bossPct = pick(sw.BOSSp, w.bossPct);
  w.dmgPct = pick(sw.DMGp, w.dmgPct);
  return w;
}

/** Weight per STAT_KEYS entry, consistent with scoreBundle. */
export function weightVector(w: FlameWeights, cls: ClassDef): Float64Array {
  const v = new Float64Array(K);
  STAT_KEYS.forEach((k, q) => {
    if (k === 'STR' || k === 'DEX' || k === 'INT' || k === 'LUK' || k === 'HP') v[q] = w.stat[k] ?? 0;
    else if (k === cls.attack) v[q] = w.att;
    else if (k === 'ALLp') v[q] = w.allPct;
    else if (k === 'BOSSp') v[q] = w.bossPct;
    else if (k === 'DMGp') v[q] = w.dmgPct;
  });
  return v;
}

export function scoreBundle(b: StatBundle, w: FlameWeights, cls: ClassDef): number {
  let s = 0;
  for (const [k, wk] of Object.entries(w.stat)) s += (b[k as 'STR'] ?? 0) * (wk ?? 0);
  s += (b[cls.attack] ?? 0) * w.att;
  s += (b.ALLp ?? 0) * w.allPct + (b.ALL ?? 0) * (w.stat[cls.main as 'STR'] ?? 0);
  s += (b.BOSSp ?? 0) * w.bossPct + (b.DMGp ?? 0) * w.dmgPct;
  return s;
}

/** Lines that can add damage for this class (everything else is lumped together). */
export function relevantLines(cls: ClassDef, isWeapon: boolean): LineType[] {
  const stats = new Set<string>(cls.special === 'xenon' ? ['STR', 'DEX', 'LUK'] : [cls.main, ...cls.secondary]);
  const all: LineType[] = isWeapon ? [...WEAPON_POOL] : [...ARMOR_POOL];
  return all.filter((l) => {
    if (l === 'ATT' || l === 'MATT') return l === cls.attack;
    if (l === 'ALLp' || l === 'BOSS' || l === 'DMG') return true;
    if (l === 'HP') return stats.has('HP') || cls.special === 'kanna';
    if (['STR', 'DEX', 'INT', 'LUK'].includes(l)) return stats.has(l);
    if (l.includes('+')) return l.split('+').some((x) => stats.has(x));
    return false;
  });
}

// ---------------------------------------------------------------------------------------------
// Score distribution, odds and costs
// ---------------------------------------------------------------------------------------------

export interface ScoredDistribution {
  dist: FlameOutcomeDistribution;
  /** Per-outcome score, same order as dist.probs. */
  scores: Float64Array;
  /** Distinct scores ascending, with probability mass and P(score ≥ x). */
  values: number[];
  mass: number[];
  tail: number[];
}

export function scoreDistribution(
  spec: FlameItemSpec, cls: ClassDef, weights: FlameWeights = defaultWeights(cls), source: FlameSource = 'reset',
): ScoredDistribution {
  const dist = flameOutcomeDistribution(spec, source, relevantLines(cls, spec.isWeapon));
  const n = dist.probs.length;
  const scores = new Float64Array(n);
  const m = new Map<number, number>();
  const wv = weightVector(weights, cls);
  for (let i = 0; i < n; i++) {
    let raw = 0;
    for (let q = 0; q < K; q++) raw += dist.stats[i * K + q] * wv[q];
    const sc = Math.round(raw * 1000) / 1000;
    scores[i] = sc;
    m.set(sc, (m.get(sc) ?? 0) + dist.probs[i]);
  }
  const values = [...m.keys()].sort((a, b) => a - b);
  const mass = values.map((v) => m.get(v)!);
  const tail = new Array(values.length);
  let acc = 0;
  for (let i = values.length - 1; i >= 0; i--) { acc += mass[i]; tail[i] = acc; }
  return { dist, scores, values, mass, tail };
}

/** P(one reset scores ≥ x). */
export function probAtLeast(sd: ScoredDistribution, x: number): number {
  let lo = 0, hi = sd.values.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sd.values[mid] < x - 1e-9) lo = mid + 1; else hi = mid; }
  return lo < sd.values.length ? Math.min(1, sd.tail[lo]) : 0;
}

export function meanScore(sd: ScoredDistribution): number {
  return sd.values.reduce((s, v, i) => s + v * sd.mass[i], 0);
}

export function scoreQuantile(sd: ScoredDistribution, q: number): number {
  let c = 0;
  for (let i = 0; i < sd.values.length; i++) { c += sd.mass[i]; if (c >= q - 1e-12) return sd.values[i]; }
  return sd.values[sd.values.length - 1];
}

/** Geometric cost of rolling until a success with probability p per roll. */
export function geometricCost(p: number, costPerRoll: number): CostDistribution {
  if (!(p > 0)) return { mean: Infinity, p50: Infinity, p75: Infinity, p90: Infinity };
  if (p >= 1) return { mean: costPerRoll, p50: costPerRoll, p75: costPerRoll, p90: costPerRoll };
  const q = (x: number) => Math.max(1, Math.ceil(Math.log(1 - x) / Math.log(1 - p))) * costPerRoll;
  return { mean: costPerRoll / p, p50: q(0.5), p75: q(0.75), p90: q(0.9) };
}

/** Expected mesos (and resets) to get a flame scoring strictly higher than `currentScore`. */
export function expectedFlameCostToBeat(
  currentScore: number, spec: FlameItemSpec, cls: ClassDef,
  opts: { weights?: FlameWeights; source?: FlameSource; costPerFlame?: number } = {},
): { pPerFlame: number; expectedFlames: number; cost: CostDistribution } {
  const sd = scoreDistribution(spec, cls, opts.weights ?? defaultWeights(cls), opts.source ?? 'reset');
  const p = probAtLeast(sd, currentScore + 1e-6);
  const cost = geometricCost(p, opts.costPerFlame ?? 3_000_000);
  return { pPerFlame: p, expectedFlames: p > 0 ? 1 / p : Infinity, cost };
}

/** E[best score after n resets], keeping the better each time, starting from `start`. */
export function expectedBestAfter(sd: ScoredDistribution, n: number, start = 0): number {
  let e = 0, prev = 0, c = 0;
  for (let i = 0; i < sd.values.length; i++) {
    c += sd.mass[i];
    const Fn = Math.pow(Math.min(1, c), n);
    e += Math.max(sd.values[i], start) * (Fn - prev);
    prev = Fn;
  }
  return e;
}

/** Probability-weighted mean stats over outcomes matching `pred`. Returns [p, E[stats | pred]]. */
export function conditionalStats(
  dist: FlameOutcomeDistribution, pred: (i: number) => boolean,
): [number, StatBundle] {
  let p = 0;
  const acc = new Float64Array(K);
  const n = dist.probs.length;
  for (let i = 0; i < n; i++) {
    if (!pred(i)) continue;
    const pi = dist.probs[i];
    p += pi;
    for (let q = 0; q < K; q++) acc[q] += dist.stats[i * K + q] * pi;
  }
  const out: StatBundle = {};
  if (p > 0) for (let q = 0; q < K; q++) if (acc[q]) (out as Record<string, number>)[STAT_KEYS[q]] = acc[q] / p;
  return [p, out];
}

// ---------------------------------------------------------------------------------------------
// Item helpers
// ---------------------------------------------------------------------------------------------

/** Known boss-drop items that are NOT flame-advantaged (1-4 lines, tiers not boosted). */
const NON_FA_PATTERNS = [/horntail/i, /gollux/i, /sweetwater/i, /zero/i, /meister/i];

/**
 * Flame advantage. Uses `item.flameAdvantaged` if the item DB provides it, else a heuristic:
 * end-game boss gear is advantaged except Chaos Root Abyss hats, Horntail necklaces, Gollux,
 * Sweetwater, Zero weapons and Meister symbols.
 */
export function isFlameAdvantaged(item: ItemDef): boolean {
  const explicit = (item as ItemDef & { flameAdvantaged?: boolean }).flameAdvantaged;
  if (typeof explicit === 'boolean') return explicit;
  const text = `${item.set} ${item.name}`;
  if (NON_FA_PATTERNS.some((r) => r.test(text))) return false;
  const slots = Array.isArray(item.slot) ? item.slot : [item.slot];
  if (/root abyss|\bcra\b/i.test(item.set) && slots.includes('hat')) return false;
  return true;
}

function isWeaponItem(item: ItemDef): boolean {
  const slots = Array.isArray(item.slot) ? item.slot : [item.slot];
  return slots.includes('weapon');
}

export function specFromItem(item: ItemDef): FlameItemSpec {
  return {
    level: item.level,
    isWeapon: isWeaponItem(item),
    flameAdvantaged: isFlameAdvantaged(item),
    baseAtt: item.base.ATT ?? 0,
    baseMatt: item.base.MATT ?? 0,
  };
}

/** Infer the tier of an ATT/MATT line from its flat value on a weapon (0 = none). */
export function weaponAttTier(value: number, base: number, spec: FlameItemSpec): number {
  if (!value || !base) return 0;
  let best = 0, bestErr = Infinity;
  for (let t = 1; t <= 7; t++) {
    const err = Math.abs(weaponAttValue(base, spec.level, t, spec.flameAdvantaged) - value);
    if (err < bestErr) { best = t; bestErr = err; }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------------------------

export interface FlameTargetOptions {
  /** Override score weights (ideally from weightsFromMarginalFd). */
  weights?: FlameWeights;
  /** Max rungs for armor ladders. */
  maxRungs?: number;
  /** Drop rungs rarer than this per reset. */
  minP?: number;
}

const cache = new Map<string, ScoredDistribution>();
function cachedScoreDist(spec: FlameItemSpec, cls: ClassDef, w: FlameWeights): ScoredDistribution {
  const key = JSON.stringify([spec, cls.main, cls.secondary, cls.attack, cls.special, w]);
  let sd = cache.get(key);
  if (!sd) {
    sd = scoreDistribution(spec, cls, w, 'reset');
    if (cache.size > 200) cache.clear();
    cache.set(key, sd);
  }
  return sd;
}

function fmtPct(p: number): string {
  const v = p * 100;
  return v >= 10 ? `${v.toFixed(0)}%` : v >= 1 ? `${v.toFixed(1)}%` : `${v.toPrecision(2)}%`;
}

/** Round to 0.01 and keep only stats this class can use. */
function roundBundle(b: StatBundle, cls: ClassDef): StatBundle {
  const keep = new Set<string>(cls.special === 'xenon' ? ['STR', 'DEX', 'LUK'] : [cls.main, ...cls.secondary]);
  if (cls.special === 'kanna') keep.add('HP');
  keep.add(cls.attack); keep.add('ALLp'); keep.add('BOSSp'); keep.add('DMGp');
  const out: StatBundle = {};
  for (const [k, v] of Object.entries(b)) {
    if (keep.has(k) && typeof v === 'number' && Math.abs(v) > 1e-9) (out as Record<string, number>)[k] = Math.round(v * 100) / 100;
  }
  return out;
}

/** Smallest whole-number score strictly above the current one: the "any upgrade" threshold shown and used in the odds. */
function nextWhole(current: number): number {
  return Math.floor(current + 1e-9) + 1;
}

function armorTargets(
  item: ItemDef, equip: Equip | undefined, cls: ClassDef, cost: number, o: FlameTargetOptions,
): FlameTarget[] {
  const spec = specFromItem(item);
  const w = o.weights ?? defaultWeights(cls);
  const sd = cachedScoreDist(spec, cls, w);
  const current = equip ? scoreBundle(equip.flame ?? {}, w, cls) : 0;
  const minP = o.minP ?? 2e-5;
  const maxRungs = o.maxRungs ?? 8;
  const notes = [
    `Meso reset at ${(cost / 1e6).toFixed(1)}M each, Black Rebirth Flame odds, keep the better result.`,
    spec.flameAdvantaged ? 'Flame-advantaged: always 4 lines, tiers 4-7.' : 'Not flame-advantaged: 1-4 lines, tiers 2-5.',
    `Current flame score ${current.toFixed(1)} (main-stat equivalent).`,
  ];
  const targets: FlameTarget[] = [];
  const mk = (label: string, threshold: number) => {
    const [p, stats] = conditionalStats(sd.dist, (i) => sd.scores[i] >= threshold - 1e-9);
    if (p < minP) return;
    targets.push({ label, flame: roundBundle(stats, cls), cost: geometricCost(p, cost), pPerFlame: p, notes } as FlameTarget);
  };
  // Rung 0: any improvement over the current flame, at the next whole-number score.
  const nextUp = nextWhole(current);
  mk(`Flame score ≥ ${nextUp} (any upgrade)`, nextUp);
  // Rungs at upper-tail quantiles, rounded to a step of 5 main stat.
  const tails = [0.5, 0.25, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001, 0.0005, 0.0002, 0.0001];
  const seen = new Set<number>();
  for (const q of tails) {
    if (targets.length >= maxRungs) break;
    const x = Math.ceil(scoreQuantile(sd, 1 - q) / 5) * 5;
    if (x <= current + 2.5 || seen.has(x)) continue;
    seen.add(x);
    mk(`Flame score ≥ ${x}`, x);
  }
  return targets;
}

function weaponTargets(
  item: ItemDef, equip: Equip | undefined, cls: ClassDef, cost: number, o: FlameTargetOptions,
): FlameTarget[] {
  const spec = specFromItem(item);
  const base = cls.attack === 'MATT' ? (spec.baseMatt ?? 0) : (spec.baseAtt ?? 0);
  const w = o.weights ?? defaultWeights(cls);
  const sd = cachedScoreDist(spec, cls, w);
  const dist = sd.dist;
  const attIdx = dist.lines.indexOf(cls.attack);
  const bossIdx = dist.lines.indexOf('BOSS');
  const R = dist.lines.length;
  const cur = equip?.flame ?? {};
  const curAtt = weaponAttTier(cur[cls.attack] ?? 0, base, spec);
  const curBoss = Math.round((cur.BOSSp ?? 0) / 2);
  const top = spec.flameAdvantaged ? 7 : 5;
  const minP = o.minP ?? 1e-5;
  const notes = [
    `Meso reset at ${(cost / 1e6).toFixed(1)}M each, Black Rebirth Flame odds, keep the better result.`,
    `Weapon base ${cls.attack} ${base}; current flame ≈ ${cls.attack} T${curAtt || '-'}, Boss T${curBoss || '-'}.`,
    'Stats are the expected flame when you stop (includes any extra boss/damage/stat lines).',
  ];
  const out: FlameTarget[] = [];
  // Rung 0: any flame that scores higher than the current one (uses the engine's weights).
  const curScore = scoreBundle(cur, w, cls);
  const nextUp = nextWhole(curScore);
  {
    const [p, stats] = conditionalStats(sd.dist, (i) => sd.scores[i] >= nextUp - 1e-9);
    if (p >= minP) out.push({ label: `Flame score ≥ ${nextUp} (any upgrade)`, flame: roundBundle(stats, cls), cost: geometricCost(p, cost), pPerFlame: p, notes } as FlameTarget);
  }
  for (const a of [top - 2, top - 1, top]) {
    for (const b of [0, top - 2, top - 1, top]) {
      if (curAtt >= a && curBoss >= b) continue; // already satisfied
      const [p, stats] = conditionalStats(dist, (i) =>
        dist.tiers[i * R + attIdx] >= a && (b === 0 || (bossIdx >= 0 && dist.tiers[i * R + bossIdx] >= b)));
      if (p < minP) continue;
      const attLabel = `${cls.attack} T${a}${a < top ? '+' : ''}`;
      const bossLabel = b ? ` & Boss T${b}${b < top ? '+' : ''}` : '';
      const ex = weaponAttValue(base, spec.level, a, spec.flameAdvantaged);
      out.push({
        label: `${attLabel} (+${ex}${a < top ? '+' : ''})${bossLabel}`,
        flame: roundBundle(stats, cls), cost: geometricCost(p, cost), pPerFlame: p, notes,
      } as FlameTarget);
    }
  }
  return out;
}

export const flameModule: FlameModule = {
  targets(item, equip, cls, market, weights) {
    if (!item.flameable) return [];
    const cost = market?.mesoPerFlame > 0 ? market.mesoPerFlame : 3_000_000;
    const opts: FlameTargetOptions = { weights: flameWeightsFromStatWeights(weights, cls) };
    return isWeaponItem(item)
      ? weaponTargets(item, equip, cls, cost, opts)
      : armorTargets(item, equip, cls, cost, opts);
  },
  score(flame, cls) {
    return scoreBundle(flame, defaultWeights(cls), cls);
  },
};

/** Same as flameModule.targets but with explicit FlameWeights / rung options (for tests and tools). */
export function flameTargets(
  item: ItemDef, equip: Equip | undefined, cls: ClassDef, market: Partial<MarketSettings>, opts: FlameTargetOptions = {},
): FlameTarget[] {
  if (!item.flameable) return [];
  const cost = market?.mesoPerFlame && market.mesoPerFlame > 0 ? market.mesoPerFlame : 3_000_000;
  return isWeaponItem(item) ? weaponTargets(item, equip, cls, cost, opts) : armorTargets(item, equip, cls, cost, opts);
}

export default flameModule;
