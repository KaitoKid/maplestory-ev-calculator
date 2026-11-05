import type { NumericStatKey, PotLine, StatBundle } from './types';

export function addBundles(...bs: StatBundle[]): StatBundle {
  const out: StatBundle = {};
  for (const b of bs) {
    for (const [k, v] of Object.entries(b) as [keyof StatBundle, unknown][]) {
      if (k === 'IED') {
        out.IED = [...(out.IED ?? []), ...((v as number[]) ?? [])];
      } else if (typeof v === 'number' && v !== 0) {
        const o = out as Record<string, number>;
        o[k] = (o[k] ?? 0) + v;
      }
    }
  }
  return out;
}

export function linesToBundle(lines: PotLine[]): StatBundle {
  const out: StatBundle = {};
  for (const l of lines) {
    if (!l || !l.value) continue;
    if (l.key === 'IED') out.IED = [...(out.IED ?? []), l.value];
    else out[l.key as NumericStatKey] = ((out[l.key as NumericStatKey] as number | undefined) ?? 0) + l.value;
  }
  return out;
}

export function isEmpty(b: StatBundle): boolean {
  return Object.entries(b).every(([k, v]) => (k === 'IED' ? !(v as number[])?.length : !v));
}

/** Combined IED % from a list of sources. */
export function combineIed(list: number[] = []): number {
  return (1 - list.reduce((acc, x) => acc * (1 - x / 100), 1)) * 100;
}

const LABELS: Record<string, string> = {
  STRp: 'STR%', DEXp: 'DEX%', INTp: 'INT%', LUKp: 'LUK%', HPp: 'HP%', ALLp: 'All Stat%',
  ALL: 'All Stat', ATTp: 'ATT%', MATTp: 'MATT%', DMGp: 'Damage%', BOSSp: 'Boss%',
  CRITDMGp: 'Crit Dmg%', IED: 'IED%', CDR: 'Cooldown (s)',
  STR_PER_LV: 'STR per 9 lv', DEX_PER_LV: 'DEX per 9 lv', INT_PER_LV: 'INT per 9 lv', LUK_PER_LV: 'LUK per 9 lv',
};
export const statLabel = (k: string) => LABELS[k] ?? k;

export function describeBundle(b: StatBundle): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(b)) {
    if (k === 'IED') { for (const x of v as number[]) parts.push(`IED ${x}%`); continue; }
    if (k === 'CDR') { if (v) parts.push(`−${v}s cooldown`); continue; }
    if (!v) continue;
    const lbl = statLabel(k);
    parts.push(lbl.endsWith('%') ? `${v}% ${lbl.slice(0, -1)}` : `${v} ${lbl}`);
  }
  return parts.join(', ') || '—';
}

/** All stat keys, for UI pickers. */
export const LINE_KEYS: (NumericStatKey | 'IED')[] = [
  'STRp', 'DEXp', 'INTp', 'LUKp', 'HPp', 'ALLp', 'ATTp', 'MATTp', 'BOSSp', 'IED', 'DMGp', 'CRITDMGp',
  'STR', 'DEX', 'INT', 'LUK', 'HP', 'ALL', 'ATT', 'MATT', 'STR_PER_LV', 'DEX_PER_LV', 'INT_PER_LV', 'LUK_PER_LV', 'CDR',
];
