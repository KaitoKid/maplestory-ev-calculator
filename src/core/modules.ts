// Module contracts. Each research area plugs in by implementing one of these.
// The ranking engine only ever talks to these interfaces.

import type {
  ClassDef, Equip, ItemDef, MarketSettings, NumericStatKey, PotLine, PotTier, StatBundle, StatEquivalences,
} from './types';

/**
 * Main-stat equivalents at the player's CURRENT state, computed by the engine from the
 * damage module (e.g. ATT: 3.9 means 1 flat ATT ≈ 3.9 flat main stat). Use these to
 * score flames / cube lines so thresholds are personalised. Keys mirror StatBundle;
 * IED/BOSSp/etc are "per 1%". main = 1 by definition.
 */
export type StatWeights = Partial<Record<NumericStatKey | 'IED', number>>;

/** Damage: how much %FD does swapping `remove` for `add` give, from the player's stat-efficiency table? */
export interface DamageModule {
  /**
   * % final damage gained (1.5 = +1.5% FD) when the player loses `remove` and gains `add`.
   * Handles flat-vs-% interactions and multiplicative IED.
   */
  fdGain(eq: StatEquivalences, cls: ClassDef, remove: StatBundle, add: StatBundle): number;
  /** Main-stat equivalents of 1 unit of each stat (main = 1). */
  statWeights(eq: StatEquivalences, cls: ClassDef): StatWeights;
  /** Rows that are missing or unusable for this class (show these in the form). */
  missingRows(eq: StatEquivalences, cls: ClassDef): string[];
}

export interface CostDistribution {
  mean: number;
  p50?: number;
  p75?: number;
  p90?: number;
  /** Expected number of booms (starforce) */
  expectedBooms?: number;
}

export interface StarforceModule {
  /** Total stat/ATT that starforcing an item to `stars` grants (just the SF part). */
  starStats(item: ItemDef, stars: number, cls: ClassDef, equip: Equip): StatBundle;
  /** Expected meso cost to go from `from` to `to` stars, including boom replacement. */
  cost(item: ItemDef, from: number, to: number, market: MarketSettings): CostDistribution;
  /** Upgrade targets worth evaluating from the current star count. */
  targets(item: ItemDef, current: number): number[];
}

export interface CubeTarget {
  /** e.g. "≥ 30% LUK" or "2L Boss + IED" */
  label: string;
  /** The (representative) lines rolled when the target is hit. */
  lines: PotLine[];
  /** Tier the item ends at. */
  tier: PotTier;
  cost: CostDistribution;
  pPerCube?: number;
  cubeName?: string;
  /** Extra how-to lines (bonus potential: score formula, typical hit). */
  notes?: string[];
  /** Exact expected FD gain given a hit, from an FD function of the rolled lines (bonus potential). */
  expectFd?: (fdOf: (lines: PotLine[]) => number) => number;
}

export interface CubeModule {
  /** Candidate outcomes for main (`bonus=false`) or bonus potential (Interactive) on this item. */
  targets(
    item: ItemDef, equip: Equip, cls: ClassDef, bonus: boolean, market: MarketSettings,
    weights: StatWeights, charLevel?: number,
  ): CubeTarget[];
}

export interface FlameTarget {
  label: string;
  /** Flame stats once the target is hit (replaces the current flame entirely). */
  flame: StatBundle;
  cost: CostDistribution;
  pPerFlame?: number;
}

export interface FlameModule {
  targets(
    item: ItemDef, equip: Equip, cls: ClassDef, market: MarketSettings, weights: StatWeights,
  ): FlameTarget[];
  /** Flame score in main-stat-equivalent units, for display. */
  score?(flame: StatBundle, cls: ClassDef): number;
}

export interface Modules {
  damage: DamageModule;
  starforce: StarforceModule;
  cube: CubeModule;
  flame: FlameModule;
}
