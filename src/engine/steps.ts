// Turns a ranked candidate into an explicit prog instruction ("Star Force X from 17★ to 18★",
// "Cube Y until 2× Boss % + 1× IED", "Flame Z until flame score ≥ 140").

import type { StatWeights } from '../core/modules';
import type { ClassDef, RankedCandidate } from '../core/types';

export interface Step {
  /** Verb phrase, e.g. "Star Force" */
  verb: string;
  item: string;
  /** What to do until: "from 17★ to 18★", "until LUK % ≥ 26% (All Stat % counts)" */
  target: string;
  /** Compact target for the step list: "17★ → 18★", "33%+ LUK", "2× Boss + IED", "flame score 140+". */
  short: string;
  /** Extra how-to: cube type, safeguard / mode policy, flame score formula. */
  how?: string;
  cost: number;
  median?: number;
  fd: number;
  /** Billion mesos per 1% FD. */
  bPerFd: number;
}

const ATT_NAMES = new Set(['ATT', 'MATT']);

/** "2L Boss + 1L IED (+any)" → "2× Boss % + 1× IED (3rd line can be anything)" */
export function cubeTarget(label: string): string {
  let m = label.match(/^≥ (\d+)% (ATT|MATT)$/);
  if (m) return `until ${m[2]} % lines add up to ${m[1]}% or more`;
  m = label.match(/^≥ (\d+)% all stat \(Xenon equiv\.\)$/);
  if (m) return `until STR/DEX/LUK % add up to ${m[1]}% or more (Xenon all-stat equivalent)`;
  m = label.match(/^≥ (\d+)% (\S+)$/);
  if (m) return `until ${m[2]} % adds up to ${m[1]}% or more (All Stat % lines count)`;
  const anyThird = /\(\+any\)$/.test(label);
  const body = label.replace(/\s*\(\+any\)$/, '')
    .replace(/(\d)L (ATT|MATT)\b/g, (_, n, a) => `${n}× ${a} %`)
    .replace(/(\d)L Boss/g, '$1× Boss %')
    .replace(/(\d)L IED/g, '$1× IED')
    .replace(/(\d)L Crit Dmg/g, '$1× Crit Damage')
    .replace(/≥ (\d+)s CDR/g, '-$1s cooldown or more')
    .replace(/≥ (\d+)% (\S+)/g, (_, n, s) => `${s} % ≥ ${n}%`);
  return `until you roll ${body}${anyThird ? ' (3rd line can be anything)' : ''}`;
}

/** Compact cube target: "≥ 33% LUK" → "33%+ LUK", "2L Boss + 1L IED (+any)" → "2× Boss + IED". */
export function shortCube(label: string): string {
  return label
    .replace(/\s*\(\+any\)$/, '')
    .replace(/\s*\(Xenon equiv\.\)/, '')
    .replace(/≥ (\d+)% (.+?)(?= \+|$)/g, '$1%+ $2')
    .replace(/≥ (\d+)s CDR/g, '-$1s CD')
    .replace(/1L /g, '')
    .replace(/(\d)L /g, '$1× ');
}

/** Compact flame target: "Flame score ≥ 140" → "140+ Flame Score" (thresholds are whole numbers), weapon rungs lose their parentheses. */
export function shortFlame(label: string): string {
  const m = label.match(/^Flame score ≥ ([\d.]+)(?: \(any upgrade\))?$/);
  if (m) return `${m[1]}+ Flame Score`;
  return label.replace(/\s*\([^)]*\)/g, '');
}

/** Compact bonus-potential target. */
export function shortBonus(label: string): string {
  if (/\(any upgrade\)/.test(label)) return 'any';
  return label.replace(/^Bonus score ≥ ([\d.]+)$/, 'bonus score $1+');
}

export function flameTarget(label: string): string {
  let m = label.match(/^Flame score ≥ ([\d.]+) \(any upgrade\)$/);
  if (m) return `until flame score ≥ ${m[1]} (any upgrade)`;
  m = label.match(/^Flame score ≥ (\d+)$/);
  if (m) return `until flame score ≥ ${m[1]}`;
  // Weapon rungs: "ATT T6+ (+61+) & Boss T6+"
  const pretty = label
    .replace(/\(\+(\d+)\+\)/g, '(+$1 or more)')
    .replace(/\(\+(\d+)\)/g, '(+$1)')
    .replace(/Boss T(\d)(\+?)/g, (_, t, plus) => `Boss T${t}${plus} (${2 * Number(t)}%${plus ? '+' : ''})`);
  return `until ${pretty}`;
}

/** "Flame score = LUK + 0.05 DEX + 5 ATT + 12 × All Stat %" from the engine's weights. */
export function flameScoreFormula(w: StatWeights, cls: ClassDef, isWeapon = false): string {
  const f = (x: number | undefined) => (x === undefined ? undefined : x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x.toFixed(2));
  const mains = cls.special === 'xenon' ? ['STR', 'DEX', 'LUK'] : [cls.main];
  const parts: string[] = mains.map((s) => s);
  for (const s of cls.secondary) { const v = f((w as Record<string, number>)[s]); if (v && v !== '0.00') parts.push(`${v} ${s}`); }
  const a = f((w as Record<string, number>)[cls.attack]);
  if (a) parts.push(`${a} ${cls.attack === 'MATT' ? 'MATT' : 'ATT'}`);
  const as = f(w.ALLp);
  if (as && cls.special !== 'demon-avenger') parts.push(`${as} × All Stat %`);
  if (isWeapon) {
    const b = f(w.BOSSp), d = f(w.DMGp);
    if (b) parts.push(`${b} × Boss %`);
    if (d) parts.push(`${d} × Damage %`);
  }
  return `Flame score = ${parts.join(' + ')} (in ${cls.special === 'xenon' ? 'stat' : cls.main} equivalents, from your FD values)`;
}

/** "Bonus score ≥ 15" → "until bonus score ≥ 15"; "Bonus score > 14.3 (any upgrade)" → "until the bonus score beats your current 14.3". */
export function bonusTarget(label: string, example?: string): string {
  const m = label.match(/^Bonus score > ([\d.]+) \(any upgrade\)$/);
  const base = m ? `until the bonus score beats your current ${m[1]}` : `until ${label.replace(/^Bonus score/, 'bonus score')}`;
  return example ? `${base} (most common hit: ${example})` : base;
}

export function toStep(c: RankedCandidate, itemName: string, weights: StatWeights, cls: ClassDef): Step {
  const base = { item: itemName, cost: c.expectedCost, median: c.p50Cost, fd: c.fdGain, bPerFd: c.costPerFd / 1e9 };
  if (c.kind === 'starforce') {
    const [from, to] = c.label.split('→').map((x) => x.trim());
    return { ...base, verb: 'Star Force', target: `from ${from} to ${to}`, short: `to ${to}`, how: c.notes?.length ? c.notes.join(' · ') : undefined };
  }
  if (c.kind === 'cube') {
    const cube = c.notes?.[0];
    return { ...base, verb: 'Cube', target: cubeTarget(c.label), short: shortCube(c.label), how: cube ? `Use: ${cube}` : undefined };
  }
  if (c.kind === 'bpot-cube') {
    const [cube, formula, hit] = c.notes ?? [];
    return {
      ...base, verb: 'Bonus cube', target: bonusTarget(c.label, hit?.replace(/^most common hit: /, '')), short: shortBonus(c.label),
      how: [cube && `Use: ${cube}`, formula].filter(Boolean).join(' · ') || undefined,
    };
  }
  const isWeapon = c.slot === 'weapon';
  return {
    ...base, verb: 'Flame', target: flameTarget(c.label), short: shortFlame(c.label),
    how: isWeapon && !/Flame score/.test(c.label) ? 'Meso flame reset, keep the better result' : flameScoreFormula(weights, cls, isWeapon),
  };
}
