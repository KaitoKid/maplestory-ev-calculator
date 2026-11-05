// Ranking engine: every candidate action → expected meso cost → expected %FD → meso per 1% FD.

import type { Modules, StatWeights } from '../core/modules';
import { HEROIC_CUBE_PRICE } from '../modules/cube';
import { BONUS_CUBE_PRICE } from '../modules/bpot';
import type { Candidate, ClassDef, MarketSettings, Equip, EquipSlot, PotLine, RankedCandidate, Setup, StatBundle } from '../core/types';
import { linesToBundle } from '../core/bundle';
import { ITEM_BY_ID, type Item } from '../data/items';

/** Cube sale discount (Kai: 25% off). */
export const CUBE_SALE = 0.25;

export interface RankOutput {
  candidates: RankedCandidate[];
  /** Candidates whose only gain comes from stats the FD rows don't value (IED, crit damage). */
  unvalued: Candidate[];
  weights: StatWeights;
  warnings: string[];
  ms: number;
}

/** Item with the per-equip weapon ATT override applied. */
export function effectiveItem(item: Item, equip: Equip, cls: ClassDef): Item {
  if (equip.baseAtt === undefined || !(equip.baseAtt > 0)) return item;
  return { ...item, base: { ...item.base, [cls.attack]: equip.baseAtt } };
}


type SfDetail = { policy?: { star: number; mode: number; safeguard: boolean }[]; expectedBooms?: number; notes?: string[] };

function policySummary(d: SfDetail, from: number, to: number): string | undefined {
  if (!d.policy?.length) return undefined;
  const steps = d.policy.filter((p) => p.star >= Math.max(15, from) && p.star < to);
  if (!steps.length) return undefined;
  const sg = steps.filter((p) => p.safeguard).map((p) => p.star);
  const modes = steps.filter((p) => p.star >= 18 && p.star <= 21).map((p) => `${p.star}★:L${p.mode}`);
  const parts: string[] = [];
  if (sg.length) parts.push(`Safeguard ${sg[0]}${sg.length > 1 ? `–${sg[sg.length - 1]}` : ''}★`);
  if (modes.length) parts.push(`Mode ${modes.join(' ')}`);
  return parts.join(' · ') || undefined;
}

/**
 * The market the modules actually price with:
 * - Heroic (Reboot) worlds: no boom replacement cost (per Kai). Only Interactive pays for a new copy.
 * - Cube sale: 25% off every cube price (Glowing / Bright, and the Interactive bonus cubes); the
 *   per-use cubing fee is unchanged.
 */
export function effectiveMarket<M extends MarketSettings>(m: M): M {
  const x = m as M & { server?: string; cubeSale?: boolean };
  let out: M = m;
  if ((x.server ?? 'heroic') === 'heroic') out = { ...out, replacementCost: {} };
  if (x.cubeSale) {
    const o = m.cubeCostOverride ?? {};
    out = { ...out, cubeCostOverride: {
      ...o,
      glowing: (o.glowing ?? o.red ?? HEROIC_CUBE_PRICE.glowing) * (1 - CUBE_SALE),
      bright: (o.bright ?? o.black ?? HEROIC_CUBE_PRICE.bright) * (1 - CUBE_SALE),
      bonusGlowing: (o.bonusGlowing ?? BONUS_CUBE_PRICE.bonusGlowing) * (1 - CUBE_SALE),
      bonusBright: (o.bonusBright ?? BONUS_CUBE_PRICE.bonusBright) * (1 - CUBE_SALE),
    } };
  }
  return out;
}

export const isInteractive = (m: MarketSettings) => (m as { server?: string }).server === 'interactive';

const memo = new Map<string, { cands: Candidate[]; warns: string[] }>();

export function rank(setup: Setup, cls: ClassDef, m: Modules): RankOutput {
  const t0 = performance.now();
  const eq = setup.equivalences;
  const warnings: string[] = [];
  const market = effectiveMarket(setup.market);
  const missing = m.damage.missingRows(eq, cls);
  if (missing.length) warnings.push(`Missing FD rows: ${missing.join(', ')}. Those stats count as 0 FD.`);
  const weights = m.damage.statWeights(eq, cls);
  const out: Candidate[] = [];

  for (const [slot, equip] of Object.entries(setup.equips) as [EquipSlot, Equip][]) {
    if (!equip?.itemId) continue;
    const base = ITEM_BY_ID[equip.itemId];
    if (!base) continue;
    // Per-equip memo: candidates only depend on this equip, the class, weights and market.
    const memoKey = JSON.stringify([equip, cls.id, eq.level, weights, market]);
    const hit = memo.get(memoKey);
    if (hit) { out.push(...hit.cands); warnings.push(...hit.warns); continue; }
    const startLen = out.length; const startWarn = warnings.length;
    const item = effectiveItem(base, equip, cls);
    const label = item.name;

    // --- Starforce ---
    if (item.starforceable) {
      let before: StatBundle | null = null;
      try { before = m.starforce.starStats(item, equip.stars, cls, equip); } catch (e) { warnings.push(`${label}: ${(e as Error).message}`); }
      if (before) {
        for (const to of m.starforce.targets(item, equip.stars)) {
          let after: StatBundle;
          try { after = m.starforce.starStats(item, to, cls, equip); } catch { continue; }
          const sf = m.starforce as typeof m.starforce & { costDetailed?: (...a: Parameters<typeof m.starforce.cost>) => ReturnType<typeof m.starforce.cost> & SfDetail };
          const cost = (sf.costDetailed ?? sf.cost).call(sf, item, equip.stars, to, market) as ReturnType<typeof m.starforce.cost> & SfDetail;
          const notes: string[] = [];
          const pol = policySummary(cost, equip.stars, to);
          if (pol) notes.push(pol);
          if (cost.expectedBooms) notes.push(`${cost.expectedBooms.toFixed(2)} expected booms`);
          const booms = cost.expectedBooms ?? 0;
          if (to >= 23 && booms > 0.05) {
            // Past 22★ there is no safeguard. The expected cost already includes booms: a spare re-starred
            // from the trace star with the user's Enhancement settings (plus a replacement where one is priced).
            notes.push('⚠ Can boom. The cost includes the average cost of a spare, re-starred with your settings.');
          }
          out.push({
            slot, kind: 'starforce', label: `${equip.stars}★ → ${to}★`,
            expectedCost: cost.mean, p50Cost: cost.p50, p75Cost: cost.p75,
            before, after, notes,
          });
        }
      }
    }

    // --- Cube: main potential (badges have no potential) ---
    for (const t of base.cubeable === false ? [] : m.cube.targets(item, equip, cls, false, market, weights)) {
      out.push({
        slot, kind: 'cube', label: t.label,
        expectedCost: t.cost.mean, p50Cost: t.cost.p50, p75Cost: t.cost.p75, pPerAttempt: t.pPerCube,
        before: linesToBundle(equip.pot ?? []),
        after: linesToBundle(t.lines),
        notes: t.cubeName ? [t.cubeName] : [],
      });
    }

    // --- Bonus potential cube (Interactive worlds only; Heroic has no bonus potential) ---
    if (isInteractive(market) && base.cubeable !== false) {
      const before = linesToBundle(equip.bpot ?? []);
      const fdOf = (lines: PotLine[]) => m.damage.fdGain(eq, cls, before, linesToBundle(lines));
      for (const t of m.cube.targets(item, equip, cls, true, market, weights, eq.level)) {
        out.push({
          slot, kind: 'bpot-cube', label: t.label,
          expectedCost: t.cost.mean, p50Cost: t.cost.p50, p75Cost: t.cost.p75, pPerAttempt: t.pPerCube,
          before,
          after: linesToBundle(t.lines),
          notes: [t.cubeName ?? '', ...(t.notes ?? [])],
          fdExact: t.expectFd?.(fdOf),
        });
      }
    }

    // --- Flame ---
    for (const t of m.flame.targets(item, equip, cls, market, weights)) {
      const notes: string[] = [];
      out.push({
        slot, kind: 'flame', label: t.label,
        expectedCost: t.cost.mean, p50Cost: t.cost.p50, p75Cost: t.cost.p75, pPerAttempt: t.pPerFlame,
        before: equip.flame ?? {}, after: t.flame, notes,
      });
    }
    if (memo.size > 500) memo.clear();
    memo.set(memoKey, { cands: out.slice(startLen), warns: warnings.slice(startWarn) });
  }

  // Options whose only possible value is IED / crit damage while that FD row is still empty.
  const iedMissing = missing.includes('IED' as never), cdMissing = missing.includes('CRITDMGp' as never);
  const cdrMissing = !(eq.rows?.CDR && eq.rows.CDR.amount > 0 && Number.isFinite(eq.rows.CDR.fdPct));
  const unvaluedKeys = (b: StatBundle) => (iedMissing && (b.IED?.length ?? 0) > 0) || (cdMissing && (b.CRITDMGp ?? 0) > 0) || (cdrMissing && (b.CDR ?? 0) > 0);
  const candidates: RankedCandidate[] = [];
  const unvalued: Candidate[] = [];
  for (const c of out) {
    if (!(c.expectedCost > 0) || !Number.isFinite(c.expectedCost)) continue;
    const fd = c.fdExact ?? m.damage.fdGain(eq, cls, c.before, c.after);
    if (fd > 1e-4) candidates.push({ ...c, fdGain: fd, costPerFd: c.expectedCost / fd });
    else if (unvaluedKeys(c.after)) unvalued.push(c);
  }
  candidates.sort((a, b) => a.costPerFd - b.costPerFd);
  return { candidates, unvalued, weights, warnings, ms: performance.now() - t0 };
}

/**
 * Plan view: per item and action, the cheapest-per-FD target first, then each higher rung as a later step
 * priced at its extra cost. Star Force rungs are cumulative, so a higher rung costs the difference; cube and
 * flame rerolls start over, so a higher rung costs its full expected cost again. Steps come back sorted by
 * meso per 1% FD, so "2L Crit Dmg" shows up after "1L Crit Dmg" instead of being hidden behind it.
 */
export function planSteps(list: RankedCandidate[]): RankedCandidate[] {
  const groups = new Map<string, RankedCandidate[]>();
  for (const c of list) {
    const k = `${c.slot}:${c.kind}`;
    const g = groups.get(k);
    if (g) g.push(c); else groups.set(k, [c]);
  }
  const out: RankedCandidate[] = [];
  for (const g of groups.values()) {
    const sorted = g.slice().sort((a, b) => a.costPerFd - b.costPerFd);
    let prev = sorted[0];
    out.push(prev);
    let rest = sorted.slice(1).filter((c) => c.fdGain > prev.fdGain + 1e-6);
    while (rest.length) {
      let best: RankedCandidate | undefined, bestM = Infinity, bestFd = 0, bestCost = 0;
      for (const c of rest) {
        const dFd = c.fdGain - prev.fdGain;
        const dCost = c.kind === 'starforce' ? c.expectedCost - prev.expectedCost : c.expectedCost;
        if (!(dCost > 0)) continue;
        const m = dCost / dFd;
        if (m < bestM) { best = c; bestM = m; bestFd = dFd; bestCost = dCost; }
      }
      if (!best) break;
      const scale = bestCost / best.expectedCost;
      const { fdExact: _x, ...keep } = best;
      out.push({
        ...keep, before: prev.before, chainFrom: prev.label, fdGain: bestFd, expectedCost: bestCost, costPerFd: bestM,
        p50Cost: best.p50Cost !== undefined ? best.p50Cost * scale : undefined,
        p75Cost: best.p75Cost !== undefined ? best.p75Cost * scale : undefined,
      });
      prev = best;
      rest = rest.filter((c) => c.fdGain > prev.fdGain + 1e-6);
    }
  }
  return out.sort((a, b) => a.costPerFd - b.costPerFd);
}

/** Keep only the best (lowest meso per FD) candidate per slot + action kind. */
export function bestPerItem(list: RankedCandidate[]): RankedCandidate[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const k = `${c.slot}:${c.kind}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
