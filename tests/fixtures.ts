import type { Equip, EquipSlot } from '../src/core/types';
import { defaultSetup, emptyEquip, type AppSetup } from '../src/state';

const e = (slot: EquipSlot, itemId: string, stars: number, pot: [string, number][], flame: Record<string, number>, extra: Partial<Equip> = {}): Equip => ({
  ...emptyEquip(slot, itemId), stars, potTier: 'legendary',
  pot: pot.map(([key, value]) => ({ key, value })) as Equip['pot'], flame, ...extra,
});

/** A typical mid/late end-game Night Lord (CRA + Arcane, some pitched), level 270. */
export function sampleNightLord(): AppSetup {
  const s = defaultSetup();
  s.equivalences = {
    classId: 'night-lord', level: 270,
    rows: {
      STAT: { amount: 100, fdPct: 0.8 }, STATp: { amount: 10, fdPct: 0.9 },
      SUBSTAT: { amount: 100, fdPct: 0.04 }, SUBSTATp: { amount: 10, fdPct: 0.06 },
      ATT: { amount: 30, fdPct: 1.2 }, ATTp: { amount: 10, fdPct: 3.5 },
      BOSSp: { amount: 40, fdPct: 6.5 }, DMGp: { amount: 40, fdPct: 6.5 },
      IED: { amount: 40, fdPct: 10 }, CRITDMGp: { amount: 8, fdPct: 3 },
    },
  };
  const eqs: Equip[] = [
    e('weapon', 'arcane-weapon', 22, [['ATTp', 13], ['ATTp', 10], ['IED', 30]], { ATT: 61, BOSSp: 12, LUK: 40 }, { baseAtt: 276 }),
    e('secondary', 'secondary', 0, [['ATTp', 12], ['ATTp', 9], ['BOSSp', 30]], {}),
    e('emblem', 'gold-maple-emblem', 0, [['ATTp', 12], ['ATTp', 9], ['IED', 30]], {}),
    e('hat', 'cra-hat', 22, [['LUKp', 12], ['LUKp', 9], ['ALLp', 6]], { LUK: 60, DEX: 20, ATT: 3, ALLp: 4 }),
    e('top', 'cra-top', 22, [['LUKp', 12], ['LUKp', 9], ['LUKp', 9]], { LUK: 72, ATT: 4, ALLp: 5 }),
    e('bottom', 'cra-bottom', 22, [['LUKp', 12], ['LUKp', 9], ['ALLp', 6]], { LUK: 55, ATT: 3, ALLp: 4 }),
    e('shoes', 'arcane-shoes', 17, [['LUKp', 13], ['LUKp', 10]], { LUK: 66, ATT: 4, ALLp: 4 }),
    e('gloves', 'arcane-gloves', 17, [['CRITDMGp', 8], ['LUKp', 10]], { LUK: 55, ATT: 5, ALLp: 3 }),
    e('cape', 'arcane-cape', 17, [['LUKp', 13], ['LUKp', 10], ['ALLp', 7]], { LUK: 77, ATT: 3, ALLp: 5 }),
    e('shoulder', 'arcane-shoulder', 17, [['LUKp', 13], ['LUKp', 10]], {}),
    e('belt', 'dreamy-belt', 17, [['LUKp', 13], ['LUKp', 10]], { LUK: 80, ATT: 4, ALLp: 4 }),
    e('face', 'berserked', 17, [['LUKp', 13], ['LUKp', 10]], { LUK: 63, ATT: 3, ALLp: 4 }),
    e('eye', 'magic-eyepatch', 17, [['LUKp', 13], ['LUKp', 10]], { LUK: 63, ATT: 3, ALLp: 4 }),
    e('earring', 'commanding-force', 17, [['LUKp', 13], ['LUKp', 10]], { LUK: 80, ATT: 3, ALLp: 3 }),
    e('pendant1', 'source-of-suffering', 17, [['LUKp', 13], ['LUKp', 10]], { LUK: 63, ATT: 3, ALLp: 4 }),
    e('pendant2', 'dominator-pendant', 22, [['LUKp', 12], ['LUKp', 9], ['LUKp', 9]], { LUK: 50, ATT: 4, ALLp: 4 }),
    e('ring1', 'endless-terror', 17, [['LUKp', 13], ['LUKp', 10]], {}),
    e('ring2', 'gollux-ring', 22, [['LUKp', 12], ['LUKp', 9], ['LUKp', 9]], {}),
    e('ring3', 'meister-ring', 22, [['LUKp', 12], ['LUKp', 9]], {}),
    e('ring4', 'kannas-treasure', 22, [['LUKp', 12], ['LUKp', 9]], {}),
    e('pocket', 'pink-holy-cup', 0, [], { LUK: 50, ATT: 3 }),
    e('badge', 'genesis-badge', 0, [], {}),
  ];
  for (const x of eqs) s.equips[x.slot] = x;
  return s;
}
