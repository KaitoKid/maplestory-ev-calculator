// Damage module: % final damage of any gear change, from the player's FD-per-stat rows
// ("adding `amount` of a stat gives `fdPct` % FD", read off MapleScouter or a similar tool).
//
// Why this is exact, not just a sum of rows: damage is a product of factors
// ([W-DF] https://maplestorywiki.net/w/Damage_Formula):
//
//   D ∝ StatValue × ATT × (1 + Dmg% + Boss%) × (1.35 + CritDmg%) × (1 − PDR × (1 − IED)) × Π(1 + FD)
//
// Each row fixes one factor's current size: "40% boss = 6.9% FD" means (1 + Dmg% + Boss%) = 0.40/0.069;
// ATT and ATT% together fix (1 + ATT%) and ATT; "a new 40% IED line = 10% FD" fixes PDR × (1 − IED).
// A swap (lose 9% LUK + a 30% IED line, gain 3 lines of ATT%) then multiplies the factor ratios,
// including the flat-ATT × ATT% cross term and IED's multiplicative stacking. Nothing else is used:
// the only inputs are the player's own rows.
// StatValue = 4 × main + secondary (Xenon 4 × (STR+DEX+LUK); Demon Avenger HP-based); every stat row
// is linear in StatValue, so any amount gives the same per-unit value.
// See docs/fd-from-rows.md.

import type { ClassDef, EquivKey, EquivRow, MainStat, StatBundle, StatEquivalences } from '../core/types';
import type { DamageModule, StatWeights } from '../core/modules';

/** Default amount for each row. Bigger amounts give more precise FD numbers. */
export const EQUIV_DEFAULT_AMOUNTS: Record<EquivKey, number> = {
  STAT: 100,
  STATp: 10,
  SUBSTAT: 100,
  SUBSTATp: 10,
  ATT: 30,
  ATTp: 10,
  BOSSp: 40,
  DMGp: 40,
  IED: 40,
  CRITDMGp: 8,
  CDR: 1,
};

/** Default amount for this class (Demon Avenger's STAT row is HP, so a bigger unit). */
export function defaultAmount(key: EquivKey, cls: ClassDef): number {
  if (key === 'STAT' && cls.special === 'demon-avenger') return 2000;
  return EQUIV_DEFAULT_AMOUNTS[key];
}

/** The one row that may stay blank: cooldown reduction is worth nothing until the user prices it. */
export const OPTIONAL_ROW: EquivKey = 'CDR';

/** Rows to show in the form for this class, in display order. */
export function rowsForClass(cls: ClassDef): EquivKey[] {
  const keys: EquivKey[] = ['STAT', 'STATp'];
  if (cls.secondary.length > 0) keys.push('SUBSTAT', 'SUBSTATp');
  // Boss % and Damage % are worth the same per point against bosses, so one row covers both.
  keys.push('ATT', 'ATTp', 'BOSSp', 'IED', 'CRITDMGp', 'CDR');
  return keys;
}

/** Form labels, using the class's own stat names. */
export function rowLabel(key: EquivKey, cls: ClassDef): string {
  const main = cls.special === 'xenon' ? 'STR/DEX/LUK (each)' : cls.main;
  const sub = cls.secondary.join(' or ') || 'Substat';
  const att = cls.attack === 'MATT' ? 'Magic ATT' : 'ATT';
  const labels: Record<EquivKey, string> = {
    STAT: main, STATp: `${main} %`, SUBSTAT: sub, SUBSTATp: `${sub} %`,
    ATT: att, ATTp: `${att} %`, BOSSp: 'Boss / Dmg %', DMGp: 'Damage %', IED: 'IED %', CRITDMGp: 'Crit Dmg %', CDR: 'Cooldown −s',
  };
  return labels[key];
}

const n = (x: number | undefined): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

/** FD per one unit, as a fraction (row 30 ATT → 1.2% means 0.0004 per ATT). */
function per(row: EquivRow | undefined): number | undefined {
  if (!row || !(row.amount > 0) || !Number.isFinite(row.fdPct)) return undefined;
  return row.fdPct / 100 / row.amount;
}

interface Coeffs {
  /** ΔStatValue/StatValue per 1 flat main stat, and per 1% main stat (per stat for Xenon). */
  stat: number;
  statPct: number;
  sub: number;
  subPct: number;
  /** ΔATT/ATT per 1 flat ATT, and per 1% ATT. */
  att: number;
  attPct: number;
  /** Δ/(1 + Dmg + Boss) per 1% boss, and per 1% damage (same factor; two rows let either be used). */
  boss: number;
  dmg: number;
  /** Δ/(1.35 + CritDmg) per 1% crit damage. */
  cd: number;
  /** FD per second of cooldown reduction (0 when the optional row is blank). */
  cdr: number;
  /** PDR × (1 − IED): the share of boss defense still in effect (0 if no IED row). */
  k: number;
}

/**
 * From "a new x% IED source gives g% FD": defense factor (1 − K) → (1 − K(1 − x)), so g = K·x / (1 − K)
 * and K = g / (x + g). K is the defense still in effect, PDR × (1 − current IED).
 */
function iedK(row: EquivRow | undefined): number {
  if (!row || !(row.amount > 0) || !(row.amount < 100) || !(row.fdPct > 0)) return 0;
  const x = row.amount / 100, g = row.fdPct / 100;
  return g / (x + g);
}

function coeffs(eq: StatEquivalences, cls: ClassDef): Coeffs {
  const r = eq.rows ?? {};
  // Xenon's STAT rows are for STR, DEX and LUK together, so each stat gets a third.
  const x3 = cls.special === 'xenon' ? 3 : 1;
  return {
    stat: (per(r.STAT) ?? 0) / x3,
    statPct: (per(r.STATp) ?? 0) / x3,
    sub: per(r.SUBSTAT) ?? 0,
    subPct: per(r.SUBSTATp) ?? 0,
    att: per(r.ATT) ?? 0,
    attPct: per(r.ATTp) ?? 0,
    boss: per(r.BOSSp) ?? per(r.DMGp) ?? 0,
    dmg: per(r.BOSSp) ?? per(r.DMGp) ?? 0, // same value as Boss %; DMGp row only read from old saves
    cd: per(r.CRITDMGp) ?? 0,
    cdr: per(r.CDR) ?? 0,
    k: iedK(r.IED),
  };
}

/** Rows still missing or invalid for this class; the form should ask for these. */
export function missingRows(eq: StatEquivalences, cls: ClassDef): EquivKey[] {
  const r = eq.rows ?? {};
  return rowsForClass(cls).filter((key) => key !== OPTIONAL_ROW && (per(r[key]) === undefined || (key === 'IED' && iedK(r.IED) === 0)));
}

function mainStatsOf(cls: ClassDef): MainStat[] {
  return cls.special === 'xenon' ? ['STR', 'DEX', 'LUK'] : [cls.main];
}

/** Net change (add − remove) of every additive key. */
function netDeltas(remove: StatBundle, add: StatBundle, cls: ClassDef, level: number) {
  const z = (): Record<MainStat, number> => ({ STR: 0, DEX: 0, INT: 0, LUK: 0, HP: 0 });
  const flat = z(), pct = z();
  let att = 0, attP = 0, dmg = 0, boss = 0, cd = 0, cdr = 0;
  const lvMult = Math.floor(n(level) / 9);
  const a = cls.attack;
  for (const [b, sign] of [[remove, -1], [add, 1]] as [StatBundle, number][]) {
    if (!b) continue;
    for (const s of ['STR', 'DEX', 'INT', 'LUK'] as const) {
      flat[s] += sign * (n(b[s]) + n(b.ALL) + n(b[`${s}_PER_LV`]) * lvMult);
      pct[s] += sign * (n(b[`${s}p`]) + n(b.ALLp));
    }
    flat.HP += sign * n(b.HP);
    pct.HP += sign * n(b.HPp);
    att += sign * n(b[a]);
    attP += sign * n(b[`${a}p` as 'ATTp']);
    dmg += sign * n(b.DMGp);
    boss += sign * n(b.BOSSp);
    cd += sign * n(b.CRITDMGp);
    cdr += sign * n(b.CDR);
  }
  return { flat, pct, att, attP, dmg, boss, cd, cdr };
}

/**
 * % final damage gained when the player loses `remove` and gains `add` (1.5 = +1.5% FD).
 * Bundles use StatBundle keys (STR, LUKp, ALLp, ATT, MATTp, BOSSp, DMGp, CRITDMGp, IED: [..], FD: [..]).
 */
export function fdGain(eq: StatEquivalences, cls: ClassDef, remove: StatBundle, add: StatBundle): number {
  const c = coeffs(eq, cls);
  const d = netDeltas(remove ?? {}, add ?? {}, cls, eq.level);
  let sv = 0;
  for (const s of mainStatsOf(cls)) sv += c.stat * d.flat[s] + c.statPct * d.pct[s];
  for (const s of cls.secondary) sv += c.sub * d.flat[s] + c.subPct * d.pct[s];
  let ratio = 1 + sv;
  // ATT × (1 + ATT%): the cross term uses 1/ATT = att × attPct, both known from the rows.
  ratio *= 1 + c.att * d.att + c.attPct * d.attP + c.att * c.attPct * d.att * d.attP;
  ratio *= 1 + c.boss * d.boss + c.dmg * d.dmg;
  ratio *= 1 + c.cd * d.cd;
  ratio *= 1 + c.cdr * d.cdr; // cooldown seconds, only if the optional row is filled in
  // IED: defense left = 1 − K·Π(1 − added)/Π(1 − removed), relative to 1 − K now.
  if (c.k > 0) {
    let rel = 1;
    for (const x of add?.IED ?? []) rel *= 1 - n(x) / 100;
    for (const x of remove?.IED ?? []) { const q = 1 - n(x) / 100; if (q > 0) rel /= q; }
    ratio *= (1 - c.k * rel) / (1 - c.k);
  }
  for (const x of add?.FD ?? []) ratio *= 1 + n(x) / 100;
  for (const x of remove?.FD ?? []) { const q = 1 + n(x) / 100; if (q > 0) ratio /= q; }
  return (ratio - 1) * 100;
}

/** Main-stat equivalents of 1 unit of each stat (main = 1; Xenon: 1 = one of STR/DEX/LUK). */
export function statWeights(eq: StatEquivalences, cls: ClassDef): StatWeights {
  const mainKey = cls.special === 'xenon' ? 'LUK' : cls.main;
  const unit = fdGain(eq, cls, {}, { [mainKey]: 1 } as StatBundle);
  const w: StatWeights = {};
  if (!(unit > 0)) return w;
  const eqv = (b: StatBundle) => fdGain(eq, cls, {}, b) / unit;
  const a = cls.attack;
  const bundles: Record<string, StatBundle> = {
    [a]: { [a]: 1 } as StatBundle,
    [`${a}p`]: { [`${a}p`]: 1 } as StatBundle,
    DMGp: { DMGp: 1 }, BOSSp: { BOSSp: 1 }, CRITDMGp: { CRITDMGp: 1 }, CDR: { CDR: 1 },
  };
  for (const s of [...mainStatsOf(cls), ...cls.secondary]) {
    bundles[s] = { [s]: 1 } as StatBundle;
    bundles[`${s}p`] = { [`${s}p`]: 1 } as StatBundle;
  }
  if (cls.special !== 'demon-avenger') { bundles.ALL = { ALL: 1 }; bundles.ALLp = { ALLp: 1 }; }
  for (const [key, b] of Object.entries(bundles)) (w as Record<string, number>)[key] = eqv(b);
  w.IED = eqv({ IED: [1] });
  return w;
}

export const damageModule: DamageModule = { fdGain, statWeights, missingRows };
