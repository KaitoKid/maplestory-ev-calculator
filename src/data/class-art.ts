// Class-specific item art. Armor sets come in five job-branch versions and weapons in one version per
// weapon type, so each item carries one icon per class. Item ids are maplestory.io (GMS v250, newer
// items v270); scripts/fetch-icons.sh downloads them into public/icons/<id>.png.
//
// Sources
//  - maplestory.io item search (GMS v250 / v270), read 2026-11-05: per-branch armor ids and weapon ids.
//  - MapleStory Wiki class pages (infobox primaryWeapon) for which weapon each class uses. Where a class
//    can use two types we picked the common end-game one (noted below).

import { CLASSES } from '../modules/damage.data';

export type Branch = 'warrior' | 'magician' | 'bowman' | 'thief' | 'pirate';
/** Branch of every class id (the five armor versions). */
export const BRANCH_OF: Record<string, Branch> = {
  hero: 'warrior', paladin: 'warrior', 'dark-knight': 'warrior', 'dawn-warrior': 'warrior', mihile: 'warrior', aran: 'warrior',
  blaster: 'warrior', 'demon-slayer': 'warrior', 'demon-avenger': 'warrior', kaiser: 'warrior', zero: 'warrior', adele: 'warrior',
  hayato: 'warrior', ren: 'warrior', 'erel-light': 'warrior',
  'fp-mage': 'magician', 'il-mage': 'magician', bishop: 'magician', 'blaze-wizard': 'magician', evan: 'magician', luminous: 'magician',
  'battle-mage': 'magician', kinesis: 'magician', illium: 'magician', lara: 'magician', 'beast-tamer': 'magician', 'sia-astelle': 'magician',
  kanna: 'magician', lynn: 'magician',
  bowmaster: 'bowman', marksman: 'bowman', pathfinder: 'bowman', 'wind-archer': 'bowman', mercedes: 'bowman', 'wild-hunter': 'bowman', kain: 'bowman',
  'night-lord': 'thief', shadower: 'thief', 'dual-blade': 'thief', 'night-walker': 'thief', phantom: 'thief', cadena: 'thief', khali: 'thief',
  hoyoung: 'thief', xenon: 'thief',
  buccaneer: 'pirate', corsair: 'pirate', cannoneer: 'pirate', 'thunder-breaker': 'pirate', shade: 'pirate', mechanic: 'pirate',
  'angelic-buster': 'pirate', ark: 'pirate', 'mo-xuan': 'pirate',
};

/** Weapon type of every class id (names as maplestory.io lists them). */
export const WEAPON_OF: Record<string, string> = {
  hero: 'Two-Handed Sword', paladin: 'Two-Handed Blunt', 'dark-knight': 'Spear', 'dawn-warrior': 'Two-Handed Sword', mihile: 'One-Handed Sword',
  aran: 'Pole Arm', blaster: 'Arm Cannon', 'demon-slayer': 'One-Handed Blunt Weapon', 'demon-avenger': 'Desperado', kaiser: 'Two-Handed Sword',
  zero: 'Lapis', adele: 'Bladecaster', hayato: 'Katana', ren: 'Sword', 'erel-light': 'Gram',
  'fp-mage': 'Staff', 'il-mage': 'Staff', bishop: 'Staff', 'blaze-wizard': 'Staff', evan: 'Staff', luminous: 'Shining Rod', 'battle-mage': 'Staff',
  kinesis: 'Psy-limiter', illium: 'Gauntlet', lara: 'Wand', 'beast-tamer': 'Scepter', 'sia-astelle': 'Celestial Light', kanna: 'Fan', lynn: 'Scepter',
  bowmaster: 'Bow', marksman: 'Crossbow', pathfinder: 'Ancient Bow', 'wind-archer': 'Bow', mercedes: 'Dual Bowgun', 'wild-hunter': 'Crossbow',
  kain: 'Breath Shooter',
  'night-lord': 'Claw', shadower: 'Dagger', 'dual-blade': 'Dagger', 'night-walker': 'Claw', phantom: 'Cane', cadena: 'Chain', khali: 'Chakram',
  hoyoung: 'Ritual Fan', xenon: 'Whip Blade',
  buccaneer: 'Knuckle', corsair: 'Gun', cannoneer: 'Hand Cannon', 'thunder-breaker': 'Knuckle', shade: 'Knuckle', mechanic: 'Gun',
  'angelic-buster': 'Soul Shooter', ark: 'Knuckle', 'mo-xuan': 'Martial Brace',
};

/** Weapon ids per set and weapon type. Hero / Paladin / Dawn Warrior / Evan / Lara pick the common end-game type. */
export const WEAPON_ART: Record<'abso' | 'arcane' | 'genesis', Record<string, number>> = {
  abso: {
    'Ancient Bow': 1592019, 'Arm Cannon': 1582017, Bladecaster: 1213017, Bow: 1452252, 'Breath Shooter': 1214017, Cane: 1362135,
    Chain: 1272016, Chakram: 1404017, Claw: 1472261, Crossbow: 1462239, Dagger: 1332274, Desperado: 1232109, 'Dual Bowgun': 1522138,
    Fan: 1552110, Gauntlet: 1282016, Gram: 1433021, Gun: 1492231, 'Hand Cannon': 1532144, Katana: 1542108, Knuckle: 1482216,
    Lapis: 1562010, 'Martial Brace': 1403017, 'One-Handed Axe': 1312199, 'One-Handed Blunt Weapon': 1322250, 'One-Handed Sword': 1302333,
    'Pole Arm': 1442268, 'Psy-limiter': 1262017, 'Ritual Fan': 1292017, Scepter: 1252093, 'Shining Rod': 1212115, 'Soul Shooter': 1222109,
    Spear: 1432214, Staff: 1382259, Sword: 1215021, 'Two-Handed Axe': 1412177, 'Two-Handed Blunt': 1422184, 'Two-Handed Sword': 1402251,
    Wand: 1372222, 'Whip Blade': 1242116, 'Celestial Light': 1253017,
  },
  arcane: {
    'Ancient Bow': 1592020, 'Arm Cannon': 1582023, Bladecaster: 1213018, Bow: 1452257, 'Breath Shooter': 1214018, Cane: 1362140,
    Chain: 1272017, Chakram: 1404018, Claw: 1472265, Crossbow: 1462243, Dagger: 1332279, Desperado: 1232113, 'Dual Bowgun': 1522143,
    Fan: 1552119, Gauntlet: 1282017, Gram: 1433022, Gun: 1492235, 'Hand Cannon': 1532150, Katana: 1542117, Knuckle: 1482221,
    Lapis: 1562010, 'Martial Brace': 1403018, 'One-Handed Axe': 1312203, 'One-Handed Blunt Weapon': 1322255, 'One-Handed Sword': 1302343,
    'Pole Arm': 1442274, 'Psy-limiter': 1262039, 'Ritual Fan': 1292018, Scepter: 1252098, 'Shining Rod': 1212120, 'Soul Shooter': 1222113,
    Spear: 1432218, Staff: 1382265, Sword: 1215022, 'Two-Handed Axe': 1412181, 'Two-Handed Blunt': 1422189, 'Two-Handed Sword': 1402259,
    Wand: 1372228, 'Whip Blade': 1242121, 'Celestial Light': 1253018,
  },
  genesis: {
    'Ancient Bow': 1592022, 'Arm Cannon': 1582044, Bladecaster: 1213022, Bow: 1452266, 'Breath Shooter': 1214022, Cane: 1362149,
    Chain: 1272040, Chakram: 1404022, Claw: 1472275, Crossbow: 1462252, Dagger: 1332289, Desperado: 1232122, 'Dual Bowgun': 1522152,
    Fan: 1552130, Gauntlet: 1282040, Gram: 1433024, Gun: 1492245, 'Hand Cannon': 1532157, Katana: 1542128, Knuckle: 1482232,
    Lapis: 1562010, 'Martial Brace': 1403022, 'One-Handed Axe': 1312213, 'One-Handed Blunt Weapon': 1322264, 'One-Handed Sword': 1302355,
    'Pole Arm': 1442285, 'Psy-limiter': 1262051, 'Ritual Fan': 1292022, Scepter: 1252106, 'Shining Rod': 1212129, 'Soul Shooter': 1222122,
    Spear: 1432227, Staff: 1382274, Sword: 1215024, 'Two-Handed Axe': 1412189, 'Two-Handed Blunt': 1422197, 'Two-Handed Sword': 1402268,
    Wand: 1372237, 'Whip Blade': 1242139, 'Celestial Light': 1253021,
  },
};

/** Expand [warrior, magician, bowman, thief, pirate] ids into a class id → icon id map. */
export function byBranch(ids: readonly [number, number, number, number, number]): Record<string, number> {
  const idx: Record<Branch, number> = { warrior: 0, magician: 1, bowman: 2, thief: 3, pirate: 4 };
  const out: Record<string, number> = {};
  for (const c of CLASSES) out[c.id] = ids[idx[BRANCH_OF[c.id] ?? 'warrior']];
  return out;
}

/** Class id → weapon icon id for a weapon set. Classes with no entry fall back to the item's default art. */
export function byWeapon(set: keyof typeof WEAPON_ART): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of CLASSES) {
    const id = WEAPON_ART[set][WEAPON_OF[c.id] ?? ''];
    if (id) out[c.id] = id;
  }
  return out;
}
