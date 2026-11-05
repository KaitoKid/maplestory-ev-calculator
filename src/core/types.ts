// Core shared types. Every module (damage, cube, starforce, flame) speaks in these.

export type MainStat = 'STR' | 'DEX' | 'INT' | 'LUK' | 'HP';
export type AttackType = 'ATT' | 'MATT';

/**
 * A bag of stat contributions. Keys are flat sums EXCEPT `IED`, which is a list
 * of individual IED sources (they stack multiplicatively).
 * All percentages are expressed as whole numbers (12 = 12%).
 */
export interface StatBundle {
  STR?: number; DEX?: number; INT?: number; LUK?: number; HP?: number;
  STRp?: number; DEXp?: number; INTp?: number; LUKp?: number; HPp?: number;
  /** All Stat % (adds to STR/DEX/INT/LUK %) */
  ALLp?: number;
  /** Flat all stat (adds to STR/DEX/INT/LUK flat) */
  ALL?: number;
  ATT?: number; MATT?: number;
  ATTp?: number; MATTp?: number;
  DMGp?: number; BOSSp?: number;
  CRITDMGp?: number;
  /** Individual IED sources, e.g. [30, 40] */
  IED?: number[];
  /** "+X main stat per 9 character levels" potential lines, value = X */
  STR_PER_LV?: number; DEX_PER_LV?: number; INT_PER_LV?: number; LUK_PER_LV?: number;
  /** Seconds of skill cooldown reduction (hat) */
  CDR?: number;
  /** Crit rate % (only matters if the player is below 100% crit). */
  CRp?: number;
  /** Individual multiplicative Final Damage sources, e.g. [10] for a +10% FD effect. */
  FD?: number[];
  /** Arcane Power / Sacred (Authentic) Power, e.g. from symbol upgrades. */
  ARC?: number;
  SAC?: number;
  /** Flat stat NOT multiplied by % (symbol upgrades, hyper stats, legion), e.g. { LUK: 100 }. */
  unaffected?: Partial<Record<MainStat, number>>;
}

export type NumericStatKey = Exclude<keyof StatBundle, 'IED' | 'FD' | 'unaffected'>;

export interface ClassDef {
  id: string;
  name: string;
  main: MainStat;
  /** Secondary stats; most classes have one, thieves (Shadower/DB/Cadena) have two. */
  secondary: MainStat[];
  attack: AttackType;
  /**
   * Special-case flags handled by the damage module.
   * xenon: stat value = 4 x (STR + DEX + LUK), no secondary.
   * demon-avenger: main stat is HP (pure HP vs additional HP), secondary STR.
   * kanna: +1 Magic ATT per 700 Max HP, not affected by MATT %.
   */
  special?: 'xenon' | 'demon-avenger' | 'kanna';
  /** Weapon constant (informational only; not used in any calculation). */
  weaponConst?: number;
}

/**
 * The rows the player fills in (from MapleScouter or any stat-equivalence tool):
 * "adding `amount` of this stat gives `fdPct` % final damage". These 8 rows only (Kai, 2026-11-05):
 * IED and crit damage are not inputs, so those lines get no value. Any amount works; bigger
 * amounts give more precise numbers. Defaults: EQUIV_DEFAULT_AMOUNTS in modules/damage.ts.
 */
export type EquivKey =
  /** Flat main stat on equipment, multiplied by stat % (Xenon: STR+DEX+LUK each; Demon Avenger: HP). */
  | 'STAT'
  /** Main stat % (Xenon: % of all three; Demon Avenger: HP %). */
  | 'STATp'
  /** Flat secondary stat (one of them for thieves with STR+DEX). */
  | 'SUBSTAT'
  | 'SUBSTATp'
  /** Flat ATT or Magic ATT (multiplied by ATT %). */
  | 'ATT'
  | 'ATTp'
  /** Boss damage %. */
  | 'BOSSp'
  /** Damage % (same factor as boss %, so the two rows should agree). */
  | 'DMGp'
  /** Ignore enemy defense, as ONE new source of `amount` % (stacks multiplicatively). */
  | 'IED'
  /** Critical damage %. */
  | 'CRITDMGp'
  /** Skill cooldown reduction, in seconds (optional: blank means it is worth nothing). */
  | 'CDR';

export interface EquivRow {
  /** How much of the stat, in its own unit (30 = 30 ATT, 40 = 40% boss). */
  amount: number;
  /** % final damage that amount gives (1.5 = +1.5% FD). */
  fdPct: number;
}

/** The player's input: class, level and FD-per-stat rows. Percentages are whole numbers. */
export interface StatEquivalences {
  classId: string;
  /** Needed for "+X stat per 9 levels" potential lines. */
  level: number;
  rows: Partial<Record<EquivKey, EquivRow>>;
}

export type EquipSlot =
  | 'hat' | 'top' | 'bottom' | 'overall' | 'shoes' | 'gloves' | 'cape' | 'shoulder'
  | 'belt' | 'face' | 'eye' | 'earring' | 'ring1' | 'ring2' | 'ring3' | 'ring4'
  | 'pendant1' | 'pendant2' | 'pocket' | 'badge' | 'emblem' | 'weapon' | 'secondary' | 'heart';

export type PotTier = 'rare' | 'epic' | 'unique' | 'legendary';

/** A single potential line, e.g. { key: 'STRp', value: 13 } */
export interface PotLine { key: NumericStatKey | 'IED'; value: number }

export interface Equip {
  slot: EquipSlot;
  /** Item id in data/items.ts */
  itemId: string;
  stars: number;
  potTier: PotTier;
  pot: PotLine[];
  bpotTier: PotTier;
  bpot: PotLine[];
  /** Flame (bonus stat) contributions, already summed per stat. */
  flame: StatBundle;
  /** Weapon base ATT/MATT override (weapon type varies); falls back to ItemDef.base. */
  baseAtt?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  set: string;
  slot: EquipSlot | EquipSlot[];
  level: number;
  /** Base stats before starforce/flame/potential. */
  base: StatBundle;
  maxStars: number;
  /** Superior items (Tyrant) use a different SF table. */
  superior?: boolean;
  /** Can this item receive flames? (most pitched accessories can, some can't) */
  flameable: boolean;
  /** Can starforce? */
  starforceable: boolean;
  /** Lowest star the item can have (Destiny stage 2 starts at 22★ and a boom replaces it at 22★). */
  minStars?: number;
  /** Boom replacement cost in every world (Destiny stage 2: 10B from the Ark of Determination). */
  boomCost?: number;
  /** Icon in public/icons: a maplestory.io item id, or a MapleStory Wiki file name (Eqp_*). */
  iconId?: number | string;
  weaponType?: string;
}

export interface Setup {
  version: 1;
  /** The player's FD-per-stat rows (from MapleScouter or similar). */
  equivalences: StatEquivalences;
  equips: Partial<Record<EquipSlot, Equip>>;
  /** Market assumptions */
  market: MarketSettings;
}

export interface MarketSettings {
  /** Starforce: MVP discount % (0, 3, 5, 10) */
  mvpDiscount: number;
  /** 30% off event active */
  sf30Off: boolean;
  /** 5/10/15 100% event */
  sf51015: boolean;
  /** Star catching on? */
  starCatch: boolean;
  /** Safeguard 15-17 (only if cheaper in EV; module decides if 'auto') */
  safeguard: 'auto' | 'always' | 'never';
  /** Meso cost of replacing a boomed item, per item id. Fallback per set. */
  replacementCost: Record<string, number>;
  /** Meso per flame (default 3M per the latest change). */
  mesoPerFlame: number;
  /** Optional override of meso per cube by cube type. */
  cubeCostOverride: Record<string, number>;
}

/** A candidate upgrade produced by one of the action modules. */
export interface Candidate {
  slot: EquipSlot;
  kind: 'starforce' | 'cube' | 'bpot-cube' | 'flame';
  /** Short label e.g. "17★ → 22★" or "Cube to ≥ 30% STR" */
  label: string;
  /** Expected meso cost to reach the target state. */
  expectedCost: number;
  /** Median / 75th percentile cost if the module can supply it (optional). */
  p50Cost?: number;
  p75Cost?: number;
  /** Probability of success per attempt, if relevant (cube/flame). */
  pPerAttempt?: number;
  /** Stats this item contributes BEFORE the action (only the parts the action changes). */
  before: StatBundle;
  /** Stats this item contributes AFTER the action (expected/target state). */
  after: StatBundle;
  /** Free-form notes (assumptions, warnings). */
  notes?: string[];
  /** Exact expected FD gain when the module can average FD over every outcome (overrides before/after). */
  fdExact?: number;
}

export interface RankedCandidate extends Candidate {
  /** Final damage % gained, e.g. 1.25 = +1.25% FD. */
  fdGain: number;
  /** Meso per 1% FD (lower is better). */
  costPerFd: number;
  /** Plan view: label of the rung on the same item this step builds on (its cost and FD are the extra over that rung). */
  chainFrom?: string;
}
