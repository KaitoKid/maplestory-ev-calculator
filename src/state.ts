import type { Equip, EquipSlot, MarketSettings, Setup } from './core/types';
import type { StarforceMarketExtras } from './modules/starforce';
import { DEFAULT_MODE_PROFILES } from './modules/starforce';
import { DEFAULT_REPLACEMENT } from './data/items';

/** Heroic (Reboot) worlds such as Kronos and Hyperion vs Interactive worlds. */
export type ServerType = 'heroic' | 'interactive';
export type Market = MarketSettings & StarforceMarketExtras & {
  includeCubeFee?: boolean; server?: ServerType; cubeSale?: boolean;
};
export type AppSetup = Omit<Setup, 'market'> & { market: Market };

const KEY = 'msev:setup:v1';

export function defaultMarket(): Market {
  return {
    mvpDiscount: 0,
    sf30Off: false,
    sf51015: false,
    starCatch: true,
    safeguard: 'always',
    replacementCost: { ...DEFAULT_REPLACEMENT },
    mesoPerFlame: 3_000_000,
    cubeCostOverride: {},
    sfEnhanceMode: 'profile',
    sfModeProfiles: { pitched: [...DEFAULT_MODE_PROFILES.pitched], other: [...DEFAULT_MODE_PROFILES.other] },
    sf1plus1: false,
    includeCubeFee: true,
    server: 'heroic',
    cubeSale: false,
  };
}

export function emptyEquip(slot: EquipSlot, itemId = ''): Equip {
  return { slot, itemId, stars: 0, potTier: 'legendary', pot: [], bpotTier: 'legendary', bpot: [], flame: {} };
}

export function defaultSetup(): AppSetup {
  return {
    version: 1,
    equivalences: { classId: 'night-lord', level: 270, rows: {} },
    equips: {},
    market: defaultMarket(),
  };
}

export function load(): AppSetup {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSetup();
    const s = JSON.parse(raw) as AppSetup;
    if (s?.version !== 1) return defaultSetup();
    const d = defaultSetup();
    delete (s.market as { cubeMiracleTime?: boolean }).cubeMiracleTime;
    delete (s.market as { tierUpOverride?: unknown }).tierUpOverride;
    return { ...d, ...s, equivalences: { ...d.equivalences, ...s.equivalences }, market: { ...d.market, ...s.market } };
  } catch {
    return defaultSetup();
  }
}

export function save(s: AppSetup): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}
