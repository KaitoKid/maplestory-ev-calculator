// Data tables for the damage module. Every number cites its source; see docs/damage-formula.md.
//
// Sources
//  [W-DF]  MapleStory Wiki, "Damage Formula" (wikitext via API, read 2026-11-05)
//          https://maplestorywiki.net/w/Damage_Formula  (paraphrases StrategyWiki MapleStory/Formulas)
//  [W-CLS] MapleStory Wiki class pages (infobox mainStat/secondaryStat), e.g. https://maplestorywiki.net/w/Cadena

import type { ClassDef } from '../core/types';

/**
 * GMS job list with main/secondary stat, attack type and "Current Applied Weapon Constant".
 * Weapon constants: [W-DF] table. Main/secondary: [W-CLS] and the standard explorer/cygnus/hero splits.
 * Where a job has two weapon options we use the common end-game one and note it.
 */
export const CLASSES: ClassDef[] = [
  // ---- Warriors (STR / DEX) ----
  { id: 'hero', name: 'Hero', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.44 }, // 2H sword/axe; 1H = 1.34
  { id: 'paladin', name: 'Paladin', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.34 }, // 2H; 1H = 1.24
  { id: 'dark-knight', name: 'Dark Knight', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.49 },
  { id: 'dawn-warrior', name: 'Dawn Warrior', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.34 }, // 2H; 1H = 1.24
  { id: 'mihile', name: 'Mihile', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.24 },
  { id: 'aran', name: 'Aran', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.49 },
  { id: 'blaster', name: 'Blaster', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.7 },
  { id: 'demon-slayer', name: 'Demon Slayer', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.2 },
  { id: 'demon-avenger', name: 'Demon Avenger', main: 'HP', secondary: ['STR'], attack: 'ATT', special: 'demon-avenger', weaponConst: 1.3 },
  { id: 'kaiser', name: 'Kaiser', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.34 },
  { id: 'zero', name: 'Zero', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.34 }, // Alpha 1.34, Beta 1.49
  { id: 'adele', name: 'Adele', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.3 },
  { id: 'hayato', name: 'Hayato', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.25 },
  { id: 'ren', name: 'Ren', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.3 },
  { id: 'erel-light', name: 'Erel Light', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.49 },

  // ---- Magicians (INT / LUK, Magic ATT) ----
  { id: 'fp-mage', name: 'Arch Mage (F/P)', main: 'INT', secondary: ['LUK'], attack: 'MATT', weaponConst: 1.2 },
  { id: 'il-mage', name: 'Arch Mage (I/L)', main: 'INT', secondary: ['LUK'], attack: 'MATT', weaponConst: 1.2 },
  { id: 'bishop', name: 'Bishop', main: 'INT', secondary: ['LUK'], attack: 'MATT', weaponConst: 1.2 },
  { id: 'blaze-wizard', name: 'Blaze Wizard', main: 'INT', secondary: ['LUK'], attack: 'MATT', weaponConst: 1.2 },
  { id: 'evan', name: 'Evan', main: 'INT', secondary: ['LUK'], attack: 'MATT', weaponConst: 1.2 },
  { id: 'luminous', name: 'Luminous', main: 'INT', secondary: ['LUK'], attack: 'MATT', weaponConst: 1.2 },
  { id: 'battle-mage', name: 'Battle Mage', main: 'INT', secondary: ['LUK'], attack: 'MATT', weaponConst: 1.2 },
  { id: 'kinesis', name: 'Kinesis', main: 'INT', secondary: ['LUK'], attack: 'MATT', weaponConst: 1.2 },
  { id: 'illium', name: 'Illium', main: 'INT', secondary: ['LUK'], attack: 'MATT', weaponConst: 1.2 },
  { id: 'lara', name: 'Lara', main: 'INT', secondary: ['LUK'], attack: 'MATT', weaponConst: 1.2 },
  { id: 'beast-tamer', name: 'Beast Tamer', main: 'INT', secondary: ['LUK'], attack: 'MATT', weaponConst: 1.2 },
  { id: 'sia-astelle', name: 'Sia Astelle', main: 'INT', secondary: ['LUK'], attack: 'MATT', weaponConst: 1.2 },
  { id: 'kanna', name: 'Kanna', main: 'INT', secondary: ['LUK'], attack: 'MATT', special: 'kanna', weaponConst: 1.35 },
  { id: 'lynn', name: 'Lynn', main: 'INT', secondary: ['LUK'], attack: 'MATT', weaponConst: 1.34 },

  // ---- Bowmen (DEX / STR) ----
  { id: 'bowmaster', name: 'Bowmaster', main: 'DEX', secondary: ['STR'], attack: 'ATT', weaponConst: 1.3 },
  { id: 'marksman', name: 'Marksman', main: 'DEX', secondary: ['STR'], attack: 'ATT', weaponConst: 1.35 },
  { id: 'pathfinder', name: 'Pathfinder', main: 'DEX', secondary: ['STR'], attack: 'ATT', weaponConst: 1.3 },
  { id: 'wind-archer', name: 'Wind Archer', main: 'DEX', secondary: ['STR'], attack: 'ATT', weaponConst: 1.3 },
  { id: 'mercedes', name: 'Mercedes', main: 'DEX', secondary: ['STR'], attack: 'ATT', weaponConst: 1.3 },
  { id: 'wild-hunter', name: 'Wild Hunter', main: 'DEX', secondary: ['STR'], attack: 'ATT', weaponConst: 1.35 },
  { id: 'kain', name: 'Kain', main: 'DEX', secondary: ['STR'], attack: 'ATT', weaponConst: 1.3 },

  // ---- Thieves (LUK) ----
  { id: 'night-lord', name: 'Night Lord', main: 'LUK', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.75 },
  { id: 'shadower', name: 'Shadower', main: 'LUK', secondary: ['STR', 'DEX'], attack: 'ATT', weaponConst: 1.3 },
  { id: 'dual-blade', name: 'Dual Blade', main: 'LUK', secondary: ['STR', 'DEX'], attack: 'ATT', weaponConst: 1.3 },
  { id: 'night-walker', name: 'Night Walker', main: 'LUK', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.75 },
  { id: 'phantom', name: 'Phantom', main: 'LUK', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.3 },
  { id: 'cadena', name: 'Cadena', main: 'LUK', secondary: ['STR', 'DEX'], attack: 'ATT', weaponConst: 1.3 },
  { id: 'khali', name: 'Khali', main: 'LUK', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.3 },
  { id: 'hoyoung', name: 'Hoyoung', main: 'LUK', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.3 },
  // Xenon: main is listed as LUK only so generic code has a "main"; the damage module uses STR+DEX+LUK.
  { id: 'xenon', name: 'Xenon', main: 'LUK', secondary: [], attack: 'ATT', special: 'xenon', weaponConst: 1.3125 },

  // ---- Pirates ----
  { id: 'buccaneer', name: 'Buccaneer', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.7 },
  { id: 'corsair', name: 'Corsair', main: 'DEX', secondary: ['STR'], attack: 'ATT', weaponConst: 1.5 },
  { id: 'cannoneer', name: 'Cannoneer', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.5 },
  { id: 'thunder-breaker', name: 'Thunder Breaker', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.7 },
  { id: 'shade', name: 'Shade', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.7 },
  { id: 'mechanic', name: 'Mechanic', main: 'DEX', secondary: ['STR'], attack: 'ATT', weaponConst: 1.5 },
  { id: 'angelic-buster', name: 'Angelic Buster', main: 'DEX', secondary: ['STR'], attack: 'ATT', weaponConst: 1.7 },
  { id: 'ark', name: 'Ark', main: 'STR', secondary: ['DEX'], attack: 'ATT', weaponConst: 1.7 },
  { id: 'mo-xuan', name: 'Mo Xuan', main: 'DEX', secondary: ['STR'], attack: 'ATT', weaponConst: 1.75 },
];

export const CLASS_BY_ID: Record<string, ClassDef> = Object.fromEntries(CLASSES.map((c) => [c.id, c]));
