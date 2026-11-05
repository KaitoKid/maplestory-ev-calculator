// Star Force module for the EV calculator (GMS, Heroic + Interactive; costs are identical).
//
// Rules modelled (GMS as of v.271, Nov 2026). See docs/starforce.md for sources.
//  - 30-star system ("Every Little Thing, Every Precious Thing"): no star loss on failure,
//    destroy rates from 15★, GMS trace restore stars 12/15/17/19/20.
//  - Star Catching removed in v.271 (Sep 2026): its x1.05 success bonus is now always on,
//    with the remainder split between maintain/destroy in the original proportion.
//  - Safeguard 15★-17★ for +200% of base cost (not discounted).
//  - Enhancement Mode (v.269, Jun 2026) levels 1-4 for 15★-21★ (level 4 only at 18★-21★).
//  - MVP discount 3/5/10% on attempts from 0★-16★, multiplicative with the 30% event.
//  - Events: 30% off, 30% destruction reduction (attempts at 21★ or below), 1+1 (≤10★),
//    legacy 5/10/15.
//  - Superior (Tyrant) items: separate table, stars drop on failure, chance time, boom -> 0★.
//
// Pure functions, no DOM, no dependencies. Exact expected values come from solving the
// absorbing Markov chain (Gaussian elimination); percentiles come from a seeded,
// memoised Monte Carlo run under the same policy.

import type { ClassDef, Equip, EquipSlot, ItemDef, MainStat, MarketSettings, StatBundle } from '../core/types';
import type { CostDistribution, StarforceModule } from '../core/modules';

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

/** Published base rates [success, destroy] for attempts at star s (maintain = rest).
 *  Source: MapleStory Wiki "Star Force Enhancement" (KMS/GMS/JMS/MSEA tab), KMS 1.2.401 notes. */
export const BASE_RATES: ReadonlyArray<readonly [number, number]> = [
  [0.95, 0], [0.9, 0], [0.85, 0], [0.85, 0], [0.8, 0], // 0-4
  [0.75, 0], [0.7, 0], [0.65, 0], [0.6, 0], [0.55, 0], // 5-9
  [0.5, 0], [0.45, 0], [0.4, 0], [0.35, 0], [0.3, 0], // 10-14
  [0.3, 0.021], [0.3, 0.021], [0.15, 0.068], [0.15, 0.068], [0.15, 0.085], // 15-19
  [0.3, 0.105], [0.15, 0.1275], [0.15, 0.17], [0.1, 0.18], [0.1, 0.18], // 20-24
  [0.1, 0.18], [0.07, 0.186], [0.05, 0.19], [0.03, 0.194], [0.01, 0.198], // 25-29
];

/** Former star-catch bonus, now permanently applied in GMS (v.271). */
export const STAR_CATCH_MULT = 1.05;

/** Enhancement Mode table for attempts at 15★-21★, levels 1-4 (index 0-3), as the game
 *  displays them after the star-catch removal. Level 4 is not offered at 15★-17★ (Safeguard
 *  is the same thing there). Source: starforce.tadeucci.dev rates.js, measured in-game
 *  (e.g. 18★ lv160: 15.75/77.51/6.74, 12.60/83.03/4.37, 10.50/87.71/1.79, 8.40/91.60/0). */
export interface ModeEntry { mult: number; success: number; boom: number }
export const ENHANCE_MODE: Readonly<Record<number, ReadonlyArray<ModeEntry | null>>> = {
  15: [{ mult: 1, success: 0.315, boom: 0.02055 }, { mult: 1.5, success: 0.315, boom: 0.0137 }, { mult: 2.5, success: 0.315, boom: 0.00685 }, null],
  16: [{ mult: 1, success: 0.315, boom: 0.02055 }, { mult: 1.5, success: 0.315, boom: 0.0137 }, { mult: 2.5, success: 0.315, boom: 0.00685 }, null],
  17: [{ mult: 1, success: 0.1575, boom: 0.0674 }, { mult: 1.5, success: 0.1575, boom: 0.042125 }, { mult: 2.5, success: 0.1575, boom: 0.01685 }, null],
  18: [{ mult: 1, success: 0.1575, boom: 0.0674 }, { mult: 2, success: 0.126, boom: 0.0437 }, { mult: 3.5, success: 0.105, boom: 0.0179 }, { mult: 6.5, success: 0.084, boom: 0 }],
  19: [{ mult: 1, success: 0.1575, boom: 0.08425 }, { mult: 2, success: 0.126, boom: 0.06118 }, { mult: 3.5, success: 0.105, boom: 0.0358 }, { mult: 6.5, success: 0.084, boom: 0 }],
  20: [{ mult: 1, success: 0.315, boom: 0.10275 }, { mult: 2, success: 0.2625, boom: 0.07375 }, { mult: 3.5, success: 0.21, boom: 0.0395 }, { mult: 6.5, success: 0.1575, boom: 0 }],
  21: [{ mult: 1, success: 0.1575, boom: 0.126375 }, { mult: 2, success: 0.126, boom: 0.0874 }, { mult: 3.5, success: 0.105, boom: 0.04475 }, { mult: 6.5, success: 0.084, boom: 0 }],
};

/** Superior (Tyrant) base rates [success, maintain, decrease, destroy] per star.
 *  Source: brendonmay.github.io starforceCalculator/serverDiffs.js (tyrantRates). */
export const SUPERIOR_RATES: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.5, 0.5, 0, 0], [0.5, 0, 0.5, 0], [0.45, 0, 0.55, 0], [0.4, 0, 0.6, 0], [0.4, 0, 0.6, 0],
  [0.4, 0, 0.582, 0.018], [0.4, 0, 0.57, 0.03], [0.4, 0, 0.558, 0.042], [0.4, 0, 0.54, 0.06],
  [0.37, 0, 0.5355, 0.0945], [0.35, 0, 0.52, 0.13], [0.35, 0, 0.4875, 0.1625],
  [0.03, 0, 0.485, 0.485], [0.02, 0, 0.49, 0.49], [0.01, 0, 0.495, 0.495],
];

/** GMS: star level an item comes back at after its trace is restored. */
export function boomRestoreStar(star: number): number {
  if (star < 20) return 12;
  if (star === 20) return 15;
  if (star <= 22) return 17;
  if (star <= 25) return 19;
  return 20;
}

// ---------------------------------------------------------------------------
// Costs
// ---------------------------------------------------------------------------

/** [divisor, exponent] for 100*round(L^3 * (s+1)^exp / divisor + 10), L floored to 10s.
 *  Equivalent to the wiki's GMS formula 1000 + L^3 (s+1)^exp / (divisor/100), rounded to 100. */
const COST_COEF: ReadonlyArray<readonly [number, number]> = [
  ...Array.from({ length: 10 }, () => [2500, 1] as const), // 0-9   (/25)
  [40000, 2.7], [22000, 2.7], [15000, 2.7], [11000, 2.7], [7500, 2.7], // 10-14 (/400 /220 /150 /110 /75)
  [20000, 2.7], [20000, 2.7], [15000, 2.7], [7000, 2.7], [4500, 2.7], // 15-19 (/200 /200 /150 /70 /45)
  [20000, 2.7], [12500, 2.7], // 20-21 (/200 /125)
  ...Array.from({ length: 8 }, () => [20000, 2.7] as const), // 22-29 (/200)
];

/** Base meso cost of one attempt at `star` (no discounts, no safeguard). */
export function baseAttemptCost(itemLevel: number, star: number): number {
  const c = COST_COEF[star];
  if (!c) throw new RangeError(`No star force cost for star ${star}`);
  const L = Math.floor(itemLevel / 10) * 10;
  return 100 * Math.round((L ** 3 * (star + 1) ** c[1]) / c[0] + 10);
}

/** Superior items: fixed cost per attempt, no discounts. Wiki: 1000 + L^3.56, rounded to 100. */
export function superiorAttemptCost(itemLevel: number): number {
  return 100 * Math.round((1000 + itemLevel ** 3.56) / 100);
}

// ---------------------------------------------------------------------------
// Options and per-star actions
// ---------------------------------------------------------------------------

export type SafeguardPolicy = 'auto' | 'always' | 'never';
/** 'auto' = cheapest level per star; 'off' = level 1 everywhere; a number forces that level
 *  where it exists (level 4 at 15-17★ falls back to level 3). */
export type EnhanceModePolicy = 'auto' | 'off' | 1 | 2 | 3 | 4;
export type ModeLevel = 1 | 2 | 3 | 4;
/** Enhancement Mode level for the attempts at [18★, 19★, 20★, 21★] (the stars where all four
 *  levels exist). "1-1-4-4" = standard at 18★/19★, level 4 (no boom) at 20★/21★.
 *  15★-17★ are safeguarded by default in profile mode (level 4 there = Safeguard). */
export type ModeProfile = readonly [ModeLevel, ModeLevel, ModeLevel, ModeLevel];
export const MODE_PROFILE_STARS = [18, 19, 20, 21] as const;
/** Default profiles for EV calculations (Kai, 2026-11-05). */
export const DEFAULT_MODE_PROFILES: { readonly pitched: ModeProfile; readonly other: ModeProfile } = {
  pitched: [4, 4, 4, 4],
  other: [1, 1, 4, 4],
};
/** Turn a 4-slot profile into a per-star plan. */
export function profileToPlan(profile: ModeProfile): Partial<Record<number, ModeLevel>> {
  const plan: Partial<Record<number, ModeLevel>> = {};
  MODE_PROFILE_STARS.forEach((star, i) => { plan[star] = profile[i]; });
  return plan;
}

export interface SfOptions {
  superior?: boolean;
  /** MVP discount percent: 0, 3, 5 or 10. */
  mvpDiscount?: number;
  /** 30% off (Shining Star Force / Special Sunny Sunday). Not applied to the safeguard premium. */
  thirtyOff?: boolean;
  /** 30% lower destroy chance for attempts at 21★ or below. */
  boomReduction?: boolean;
  /** Legacy 5/10/15 event (100% at 5, 10, 15). No longer run in GMS, kept for comparisons. */
  fiveTenFifteen?: boolean;
  /** "1+1 Star Force" Sunny Sunday: a success at 10★ or below gives +2★. */
  onePlusOne?: boolean;
  /** Keep true for current GMS. false reproduces pre-v.271 rates without a star catch. */
  starCatch?: boolean;
  safeguard?: SafeguardPolicy;
  enhanceMode?: EnhanceModePolicy;
  /** Fixed Enhancement Mode per star (15-21). Overrides `enhanceMode` at the stars it lists.
   *  At 15★-17★: 4 means Safeguard, 1 means standard (safeguard setting still applies). */
  modePlan?: Partial<Record<number, ModeLevel>>;
  /** Meso cost of the clean copy (or Star Core) needed to restore a trace. */
  replacementCost?: number;
}

/** What to press at one star. mode 1 = standard. */
export interface StarAction { star: number; mode: 1 | 2 | 3 | 4; safeguard: boolean }

interface Transition {
  cost: number; success: number; maintain: number; boom: number;
  /** star reached on success */
  next: number; boomTo: number; action: StarAction;
}

function catchAdjust(p: number, b: number, starCatch: boolean): [number, number] {
  if (!starCatch) return [p, b];
  const p2 = Math.min(1, p * STAR_CATCH_MULT);
  const b2 = p >= 1 ? 0 : (b * (1 - p2)) / (1 - p);
  return [p2, b2];
}

/** All available actions at a (normal-item) star, with their cost and outcome odds. */
export function starActions(itemLevel: number, star: number, o: SfOptions): Transition[] {
  const base = baseAttemptCost(itemLevel, star);
  const starCatch = o.starCatch !== false;
  const mvp = star <= 16 ? (o.mvpDiscount ?? 0) / 100 : 0;
  const disc = (o.thirtyOff ? 0.7 : 1) * (1 - mvp);
  const next = o.onePlusOne && star <= 10 ? star + 2 : star + 1;
  const boomTo = boomRestoreStar(star);
  const boomMul = o.boomReduction && star <= 21 ? 0.7 : 1;

  if (o.fiveTenFifteen && (star === 5 || star === 10 || star === 15)) {
    return [{ cost: Math.round(base * disc), success: 1, maintain: 0, boom: 0, next, boomTo, action: { star, mode: 1, safeguard: false } }];
  }

  const out: Transition[] = [];
  const [p0, b0] = catchAdjust(BASE_RATES[star][0], BASE_RATES[star][1], starCatch);
  const mk = (cost: number, p: number, b: number, action: StarAction): Transition =>
    ({ cost, success: p, boom: b, maintain: Math.max(0, 1 - p - b), next, boomTo, action });

  const canSafeguard = star >= 15 && star <= 17;
  const planned = o.modePlan?.[star];
  let sgPolicy = o.safeguard ?? 'auto';
  let modePolicy: EnhanceModePolicy = o.enhanceMode ?? 'auto';
  if (planned !== undefined) {
    if (canSafeguard && planned === 4) { sgPolicy = 'always'; modePolicy = 'off'; }
    else if (planned === 1) modePolicy = 'off';
    else { modePolicy = planned; if (canSafeguard) sgPolicy = 'never'; }
  }
  const modeRow = ENHANCE_MODE[star];

  // Standard attempt (mode 1), unless safeguard is forced at this star.
  if (!(canSafeguard && sgPolicy === 'always')) {
    out.push(mk(Math.round(base * disc), p0, b0 * boomMul, { star, mode: 1, safeguard: false }));
  }
  if (canSafeguard && sgPolicy !== 'never') {
    out.push(mk(Math.round(base * (disc + 2)), p0, 0, { star, mode: 1, safeguard: true }));
  }
  if (modeRow && modePolicy !== 'off' && !(canSafeguard && sgPolicy === 'always')) {
    const levels: number[] = modePolicy === 'auto' ? [2, 3, 4] : [modePolicy];
    let pushed = 0;
    for (const lv of levels) {
      if (lv < 2) continue;
      pushed++;
      const e = modeRow[lv - 1] ?? modeRow[2];
      if (!e) continue;
      // Measured tables already include the star-catch bonus.
      const [p, b] = starCatch ? [e.success, e.boom] : [e.success / STAR_CATCH_MULT, e.boom];
      out.push(mk(Math.round(base * e.mult * disc), p, b * boomMul, { star, mode: (modeRow[lv - 1] ? lv : 3) as 2 | 3 | 4, safeguard: false }));
    }
    // A forced level replaces the standard attempt.
    if (modePolicy !== 'auto' && pushed > 0 && out[0].action.mode === 1 && !out[0].action.safeguard) out.splice(0, 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Markov chain solver
// ---------------------------------------------------------------------------

/** Solve A x = b in place (Gaussian elimination with partial pivoting). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    [b[c], b[piv]] = [b[piv], b[c]];
    const d = A[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / d;
      if (f === 0) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return x;
}

/** Expected value of sum(reward(transition)) until reaching `to`, for every start star < to. */
function evaluate(policy: Transition[], to: number, reward: (t: Transition) => number): number[] {
  const n = to;
  const A = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const b = new Array<number>(n).fill(0);
  for (let s = 0; s < n; s++) {
    const t = policy[s];
    A[s][s] += 1 - t.maintain;
    if (t.next < to) A[s][t.next] -= t.success;
    if (t.boom > 0) A[s][t.boomTo] -= t.boom;
    b[s] = reward(t);
  }
  return solve(A, b);
}

export interface SfResult extends CostDistribution {
  /** Expected mesos spent on attempts only (excludes boom replacement). */
  meanAttemptMesos: number;
  expectedAttempts: number;
  /** Chosen action per star (from..to-1, plus lower stars a boom can drop to). */
  policy: StarAction[];
  notes: string[];
}

const memo = new Map<string, SfResult>();

/**
 * Expected meso cost (attempts + boom replacement) to go from `from` to `to` stars.
 * Safeguard / Enhancement Mode set to 'auto' are chosen per star by policy iteration to
 * minimise that expected cost.
 */
export function expectedStarforceCost(itemLevel: number, from: number, to: number, opts: SfOptions = {}, percentiles = true): SfResult {
  const key = JSON.stringify([itemLevel, from, to, opts, percentiles]);
  const hit = memo.get(key);
  if (hit) return hit;
  const res = opts.superior ? superiorCost(itemLevel, from, to, opts, percentiles) : normalCost(itemLevel, from, to, opts, percentiles);
  if (memo.size > 5000) memo.clear();
  memo.set(key, res);
  return res;
}

function normalCost(level: number, from: number, to: number, o: SfOptions, pct: boolean): SfResult {
  if (to <= from) return emptyResult();
  if (to > 30 || from < 0) throw new RangeError('stars must be within 0-30');
  const R = o.replacementCost ?? 0;
  const actions = Array.from({ length: to }, (_, s) => starActions(level, s, o));
  const total = (t: Transition) => t.cost + t.boom * R;
  // Start from the cheapest-per-attempt (standard) action, then improve.
  let policy = actions.map((a) => a[0]);
  let E = evaluate(policy, to, total);
  for (let iter = 0; iter < 50; iter++) {
    let changed = false;
    const val = (s: number) => (s >= to ? 0 : E[s]);
    policy = policy.map((cur, s) => {
      let best = cur;
      let bestQ = q(cur);
      for (const a of actions[s]) {
        const qa = q(a);
        if (qa < bestQ - 1e-9 * Math.max(1, Math.abs(bestQ))) { best = a; bestQ = qa; }
      }
      if (best !== cur) changed = true;
      return best;
      function q(t: Transition) {
        return (total(t) + t.success * val(t.next) + t.boom * val(t.boomTo)) / (1 - t.maintain);
      }
    });
    if (!changed) break;
    E = evaluate(policy, to, total);
  }
  const booms = evaluate(policy, to, (t) => t.boom);
  const attempts = evaluate(policy, to, () => 1);
  const mesos = evaluate(policy, to, (t) => t.cost);
  const lowest = reachableFloor(policy, from, to);
  const res: SfResult = {
    mean: E[from],
    meanAttemptMesos: mesos[from],
    expectedBooms: booms[from],
    expectedAttempts: attempts[from],
    policy: policy.slice(lowest, to).map((t) => t.action),
    notes: [],
  };
  if (R === 0 && booms[from] > 1e-9) res.notes.push('Boom replacement cost not set; mean counts attempt mesos only.');
  if (pct) addPercentiles(res, (rng) => simulateNormal(policy, from, to, R, rng));
  return res;
}

function reachableFloor(policy: Transition[], from: number, to: number): number {
  let floor = from;
  for (;;) {
    let next = floor;
    for (let s = floor; s < to; s++) if (policy[s].boom > 0) next = Math.min(next, policy[s].boomTo);
    if (next === floor) return floor;
    floor = next;
  }
}

// Superior items ------------------------------------------------------------

function superiorCost(level: number, from: number, to: number, o: SfOptions, pct: boolean): SfResult {
  if (to <= from) return emptyResult();
  if (to > 15) throw new RangeError('Superior items cap at 15 stars');
  const R = o.replacementCost ?? 0;
  const cost = superiorAttemptCost(level);
  const starCatch = o.starCatch !== false;
  // State index: star*3 + d, d = consecutive decreases (0, 1) or 2 = chance time.
  const n = to * 3;
  const build = (reward: (boom: number) => number) => {
    const A = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const b = new Array<number>(n).fill(0);
    for (let s = 0; s < to; s++) for (let d = 0; d < 3; d++) {
      const i = s * 3 + d;
      A[i][i] += 1;
      if (d === 2) { if (s + 1 < to) A[i][(s + 1) * 3] -= 1; b[i] = reward(0); continue; }
      const [p, m, dec, bm] = superiorRates(s, starCatch);
      if (s + 1 < to) A[i][(s + 1) * 3] -= p;
      A[i][s * 3] -= m;
      if (dec > 0) A[i][(s - 1) * 3 + d + 1] -= dec;
      A[i][0] -= bm;
      b[i] = reward(bm);
    }
    return solve(A, b);
  };
  const E = build((bm) => cost + bm * R);
  const booms = build((bm) => bm);
  const attempts = build(() => 1);
  const res: SfResult = {
    mean: E[from * 3],
    meanAttemptMesos: attempts[from * 3] * cost,
    expectedBooms: booms[from * 3],
    expectedAttempts: attempts[from * 3],
    policy: [],
    notes: ['Superior item: no discounts, events or safeguard apply; booms reset to 0★.'],
  };
  if (pct) addPercentiles(res, (rng) => simulateSuperior(level, from, to, R, starCatch, rng));
  return res;
}

function superiorRates(s: number, starCatch: boolean): [number, number, number, number] {
  const [p, m, d, b] = SUPERIOR_RATES[s];
  if (!starCatch) return [p, m, d, b];
  const p2 = Math.min(1, p * STAR_CATCH_MULT);
  const k = (1 - p2) / (1 - p);
  return [p2, m * k, d * k, b * k];
}

// Percentiles (seeded Monte Carlo) ---------------------------------------------

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Percentile simulation settings: at most `budget` simulated attempts per call (~5 ms). */
export const sfSimConfig = { budget: 600_000, trials: 1000, enabled: true };


function addPercentiles(res: SfResult, run: (rng: () => number) => number) {
  if (!sfSimConfig.enabled) return;
  const trials = Math.min(sfSimConfig.trials, Math.floor(sfSimConfig.budget / Math.max(1, res.expectedAttempts)));
  if (trials < 200) { res.notes.push('Percentiles skipped (too many attempts to simulate quickly).'); return; }
  const rng = mulberry32(0x5f3759df);
  const xs = new Float64Array(trials);
  for (let i = 0; i < trials; i++) xs[i] = run(rng);
  xs.sort();
  const at = (p: number) => xs[Math.min(trials - 1, Math.floor(p * trials))];
  res.p50 = at(0.5); res.p75 = at(0.75); res.p90 = at(0.9);
}

function simulateNormal(policy: Transition[], from: number, to: number, R: number, rng: () => number): number {
  let s = from, total = 0;
  while (s < to) {
    const t = policy[s];
    total += t.cost;
    const r = rng();
    if (r < t.success) s = t.next;
    else if (r >= t.success + t.maintain) { s = t.boomTo; total += R; }
  }
  return total;
}

function simulateSuperior(level: number, from: number, to: number, R: number, starCatch: boolean, rng: () => number): number {
  const cost = superiorAttemptCost(level);
  let s = from, d = 0, total = 0;
  while (s < to) {
    total += cost;
    if (d === 2) { s++; d = 0; continue; }
    const [p, m, dec] = superiorRates(s, starCatch);
    const r = rng();
    if (r < p) { s++; d = 0; } else if (r < p + m) { d = 0; } else if (r < p + m + dec) { s--; d++; } else { s = 0; d = 0; total += R; }
  }
  return total;
}

function emptyResult(): SfResult {
  return { mean: 0, meanAttemptMesos: 0, expectedBooms: 0, expectedAttempts: 0, p50: 0, p75: 0, p90: 0, policy: [], notes: [] };
}

// ---------------------------------------------------------------------------
// Stat gains
// ---------------------------------------------------------------------------

const ARMOR_HP_1_15 = [5, 5, 10, 10, 10, 15, 15, 20, 20, 25, 25, 25, 25, 25, 25];
const WEAPON_HP_1_15 = [5, 5, 5, 10, 10, 15, 15, 20, 20, 25, 25, 25, 25, 25, 25];
const GLOVE_ATT_STARS = new Set([5, 7, 9, 11, 13, 14, 15]);
const NO_HP_SLOTS = new Set<EquipSlot>(['gloves', 'shoes', 'face', 'eye']);

/** Level bands used by the 16★+ tables. */
const BANDS = [128, 138, 150, 160, 200, 250] as const;
function bandIndex(level: number): number {
  let i = -1;
  for (let k = 0; k < BANDS.length; k++) if (level >= BANDS[k]) i = k;
  return i;
}
/** 16★-22★ class-stat delta per band (128,138,150,160,200,250). */
const STAT_16_22 = [7, 9, 11, 13, 15, 17];
/** Armor/accessory ATT delta per star from 16★, per band. Source: wiki Stat Tables. */
const ARMOR_ATT_16: number[][] = [
  [7, 8, 9, 10, 11],
  [8, 9, 10, 11, 12, 13, 15, 17, 19, 21, 22, 23, 24, 25, 26],
  [9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 23, 24, 25, 26, 27],
  [10, 11, 12, 13, 14, 15, 17, 19, 21, 23, 24, 25, 26, 27, 28],
  [12, 13, 14, 15, 16, 17, 19, 21, 23, 25, 26, 27, 28, 29, 30],
  [14, 15, 16, 17, 18, 19, 21, 23, 25, 27, 28, 29, 30, 31, 32],
];
/** Weapon ATT delta per star from 16★ (to 25★; the wiki has no 26★+ weapon data yet).
 *  No Lv250 weapon column exists, so 250 uses the 200 row. */
const WEAPON_ATT_16: number[][] = [
  [6, 6, 7, 8, 9],
  [7, 7, 8, 9, 10, 11, 12, 30, 31, 32],
  [8, 8, 9, 10, 11, 12, 13, 31, 32, 33],
  [9, 9, 10, 11, 12, 13, 14, 32, 33, 34],
  [13, 13, 14, 14, 15, 16, 17, 34, 35, 36],
  [13, 13, 14, 14, 15, 16, 17, 34, 35, 36],
];
/** Superior: all-stat deltas 1-5★ and ATT/MATT deltas 6-15★, bands 138-149 and 150+. */
const SUPERIOR_STAT: Record<number, number[]> = { 138: [17, 18, 20, 23, 27], 150: [19, 20, 22, 25, 29] };
const SUPERIOR_ATT: Record<number, number[]> = { 138: [8, 9, 10, 11, 12, 14, 16, 18, 20, 22], 150: [9, 10, 11, 12, 13, 15, 17, 19, 21, 23] };

export type SfItemKind = 'weapon' | 'armor' | 'gloves' | 'badge';

export interface StarGainInput {
  level: number;
  kind: SfItemKind;
  slot?: EquipSlot;
  superior?: boolean;
  /** Weapons only: ATT (or MATT) before star force = base + scrolls + flame. */
  weaponAttBeforeSf?: number;
}

/** Highest star the stat tables cover for this item. */
export function statDataCap(kind: SfItemKind, level: number, superior = false): number {
  if (superior) return 15;
  if (level < 128) return 15;
  if (level < 138) return 20;
  if (kind === 'weapon') return 25;
  if (kind === 'badge') return 22;
  return 30;
}

/** Cumulative SF gains at `stars`: { stat, hp, att } where stat applies to each class stat. */
export function starforceStatGain(input: StarGainInput, stars: number): { stat: number; hp: number; att: number } {
  const { level, kind } = input;
  let stat = 0, hp = 0, att = 0;
  if (input.superior) {
    const band = level >= 150 ? 150 : 138;
    for (let s = 1; s <= Math.min(stars, 15); s++) {
      if (s <= 5) stat += SUPERIOR_STAT[band][s - 1]; else att += SUPERIOR_ATT[band][s - 6];
    }
    return { stat, hp, att };
  }
  const cap = statDataCap(kind, level);
  if (stars > cap) throw new RangeError(`No star force stat data above ${cap}★ for this item`);
  let watt = input.weaponAttBeforeSf ?? 0;
  for (let s = 1; s <= Math.min(stars, 15); s++) {
    stat += s <= 5 ? 2 : 3;
    if (kind === 'weapon') {
      hp += WEAPON_HP_1_15[s - 1];
      const g = Math.floor(watt / 50) + 1;
      att += g; watt += g;
    } else {
      if (!(input.slot && NO_HP_SLOTS.has(input.slot)) && kind !== 'gloves') hp += ARMOR_HP_1_15[s - 1];
      if (kind === 'gloves' && GLOVE_ATT_STARS.has(s)) att += 1;
    }
  }
  const bi = bandIndex(level);
  for (let s = 16; s <= stars; s++) {
    if (s <= 22) stat += STAT_16_22[bi];
    if (kind === 'badge') continue;
    const row = kind === 'weapon' ? WEAPON_ATT_16[bi] : ARMOR_ATT_16[bi];
    att += row[s - 16];
  }
  return { stat, hp, att };
}

// ---------------------------------------------------------------------------
// Module adapter
// ---------------------------------------------------------------------------

/** Market fields this module reads beyond the shared MarketSettings (all optional). */
export interface StarforceMarketExtras {
  /** 30% destroy reduction. Defaults to sf30Off, since GMS runs both perks together. */
  sfBoomReduction?: boolean;
  /** 1+1 Star Force event (≤10★). */
  sf1plus1?: boolean;
  /** 'profile' (default): use sfModeProfiles for the item's group. 'auto': cheapest level per
   *  star. 'off': standard attempts only. A number forces that level at 15-21★. */
  sfEnhanceMode?: 'profile' | EnhanceModePolicy;
  /** User mode preferences; defaults to DEFAULT_MODE_PROFILES. */
  sfModeProfiles?: { pitched?: ModeProfile; other?: ModeProfile };
}

/** Pitched and Brilliant boss items share one mode preference; everything else the other.
 *  Detected from ItemDef.set (contains "pitched" or "brilliant"), or an explicit `sfGroup`. */
export function modeGroup(item: ItemDef): 'pitched' | 'other' {
  const g = (item as ItemDef & { sfGroup?: 'pitched' | 'other' }).sfGroup;
  if (g) return g;
  return /pitched|brilliant/i.test(item.set) ? 'pitched' : 'other';
}

function slotsOf(item: ItemDef): EquipSlot[] {
  return Array.isArray(item.slot) ? item.slot : [item.slot];
}
function kindOf(item: ItemDef, equip?: Equip): SfItemKind {
  const slot = equip?.slot ?? slotsOf(item)[0];
  if (slot === 'weapon') return 'weapon';
  if (slot === 'gloves') return 'gloves';
  if (slot === 'badge') return 'badge';
  return 'armor';
}

export function optionsFromMarket(item: ItemDef, market: MarketSettings): SfOptions {
  const x = market as MarketSettings & StarforceMarketExtras;
  return {
    superior: !!item.superior,
    mvpDiscount: market.mvpDiscount,
    thirtyOff: market.sf30Off,
    boomReduction: x.sfBoomReduction ?? market.sf30Off,
    fiveTenFifteen: market.sf51015,
    onePlusOne: x.sf1plus1 ?? false,
    // Star catching no longer exists in GMS; its bonus is always on.
    starCatch: true,
    safeguard: market.safeguard,
    ...modeOptions(item, x),
    replacementCost: market.replacementCost[item.id] ?? market.replacementCost[item.set] ?? 0,
  };
}

function modeOptions(item: ItemDef, market: MarketSettings & StarforceMarketExtras): Pick<SfOptions, 'enhanceMode' | 'modePlan'> {
  const m = market.sfEnhanceMode ?? 'profile';
  if (m !== 'profile') return { enhanceMode: m };
  const group = modeGroup(item);
  const profile = market.sfModeProfiles?.[group] ?? DEFAULT_MODE_PROFILES[group];
  // Profile default (Kai, 2026-11-05): players safeguard 15★-17★ (i.e. up to 18★). Only an
  // explicit safeguard: 'never' turns that off.
  const plan = profileToPlan(profile);
  if (market.safeguard !== 'never') for (const s of [15, 16, 17]) plan[s] = 4;
  return { enhanceMode: 'auto', modePlan: plan };
}

function classStats(cls: ClassDef): MainStat[] {
  if (cls.special === 'xenon') return ['STR', 'DEX', 'LUK'];
  return [cls.main, ...cls.secondary];
}

export const starforceModule: StarforceModule & {
  costDetailed(item: ItemDef, from: number, to: number, market: MarketSettings): SfResult;
} = {
  starStats(item: ItemDef, stars: number, cls: ClassDef, equip: Equip): StatBundle {
    if (!item.starforceable || stars <= 0) return {};
    const kind = kindOf(item, equip);
    const atkKey = cls.attack;
    const scroll = (equip as Equip & { scrollATT?: number; scrollMATT?: number });
    const weaponAtt = kind === 'weapon'
      ? (item.base[atkKey] ?? 0) + (equip.flame?.[atkKey] ?? 0) + ((atkKey === 'ATT' ? scroll.scrollATT : scroll.scrollMATT) ?? 0)
      : 0;
    const g = starforceStatGain({ level: item.level, kind, slot: equip?.slot ?? slotsOf(item)[0], superior: item.superior, weaponAttBeforeSf: weaponAtt }, stars);
    const out: StatBundle = {};
    const statList: MainStat[] = item.superior ? ['STR', 'DEX', 'INT', 'LUK'] : classStats(cls);
    for (const k of statList) {
      if (k === 'HP') { if (g.hp) out.HP = (out.HP ?? 0) + g.hp; }
      else if (g.stat) out[k] = (out[k] ?? 0) + g.stat;
    }
    if (classStats(cls).includes('HP') && g.hp && out.HP === undefined) out.HP = g.hp;
    if (g.att) {
      // Weapons only grow the attack type they have a base value for.
      if (kind !== 'weapon' || (item.base[atkKey] ?? 0) > 0) out[atkKey] = g.att;
    }
    return out;
  },

  cost(item: ItemDef, from: number, to: number, market: MarketSettings): CostDistribution {
    return this.costDetailed(item, from, to, market);
  },

  costDetailed(item: ItemDef, from: number, to: number, market: MarketSettings): SfResult {
    return expectedStarforceCost(item.level, from, to, optionsFromMarket(item, market));
  },

  targets(item: ItemDef, current: number): number[] {
    if (!item.starforceable) return [];
    const kind = kindOf(item);
    const cap = Math.min(item.maxStars, statDataCap(kind, item.level, item.superior));
    const start = item.superior ? current + 1 : Math.max(current + 1, Math.min(15, cap));
    const out: number[] = [];
    for (let s = start; s <= cap; s++) out.push(s);
    return out;
  },
};
