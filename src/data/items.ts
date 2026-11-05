// End-game item list (Heroic/Reboot, full CRA and up). Icons come from maplestory.io (GMS v250, newer items
// v270) and are bundled in public/icons/<iconId>.png by scripts/fetch-icons.sh. Armor sets and weapons carry
// one icon per class (src/data/class-art.ts).
//
// Notes for the modules:
// - `set` matching /pitched|brilliant/i puts an item in the "Pitched + Brilliant" starforce
//   mode group (starforce module, modeGroup()).
// - Flame advantage uses the flame module's heuristic unless `flameAdvantaged` is set here.
// - Weapons: base ATT varies by weapon type, so it's editable per equip (Equip.baseAtt).
//   The value here is only a default.

import type { EquipSlot, ItemDef, StatBundle } from '../core/types';
import { byBranch, byWeapon } from './class-art';

export type Item = ItemDef & {
  flameAdvantaged?: boolean; sfGroup?: 'pitched' | 'other'; fixedStars?: number;
  /** false: no potential, so never cubed (badges). */
  cubeable?: boolean;
  /** Class-specific art (armor by job branch, weapons by weapon type, secondaries): class id -> icon id. */
  iconByClass?: Record<string, number | string>;
};

const maxStarsFor = (level: number) => (level >= 138 ? 30 : level >= 128 ? 20 : level >= 108 ? 15 : 10);

interface Opt { flame?: boolean; sf?: boolean; base?: StatBundle; superior?: boolean; fa?: boolean; maxStars?: number; minStars?: number; fixedStars?: number; boomCost?: number; cubeable?: boolean; iconByClass?: Record<string, number | string> }
function it(id: string, name: string, set: string, slot: EquipSlot | EquipSlot[], level: number, iconId: number | string | undefined, o: Opt = {}): Item {
  const sf = o.sf ?? true;
  return {
    id, name, set, slot, level, iconId,
    base: o.base ?? {},
    maxStars: sf ? (o.maxStars ?? (o.superior ? 15 : maxStarsFor(level))) : 0,
    superior: o.superior,
    flameable: o.flame ?? true,
    starforceable: sf,
    ...(o.fa !== undefined ? { flameAdvantaged: o.fa } : {}),
    ...(o.fixedStars !== undefined ? { fixedStars: o.fixedStars } : {}),
    ...(o.minStars !== undefined ? { minStars: o.minStars } : {}),
    ...(o.boomCost !== undefined ? { boomCost: o.boomCost } : {}),
    ...(o.cubeable !== undefined ? { cubeable: o.cubeable } : {}),
    ...(o.iconByClass ? { iconByClass: o.iconByClass } : {}),
  };
}

const RINGS: EquipSlot[] = ['ring1', 'ring2', 'ring3', 'ring4'];
const PENDANTS: EquipSlot[] = ['pendant1', 'pendant2'];
// Flame rules (MapleStory Wiki, Bonus Stats): rings, shoulders, secondaries, emblems, badges and
// hearts can't take flames.
const NOFLAME = { flame: false };
const FA = { fa: true };
const NON_FA = { fa: false };

/** Astra secondary art per class (MapleStory Wiki, Astra Secondary Weapon). Hero/Paladin/Dawn Warrior use the two-handed variant. */
const ASTRA: Record<string, string> = {
  hero: 'Eqp_Astra_Medallion', paladin: 'Eqp_Astra_Rosary', 'dark-knight': 'Eqp_Astra_Chain', 'dawn-warrior': 'Eqp_Astra_Topaz',
  mihile: 'Eqp_Astra_Soul_Shield', aran: 'Eqp_Astra_White_Tiger_Pendulum', blaster: 'Eqp_Astra_Charges', 'demon-slayer': 'Eqp_Astra_Force_Shield',
  'demon-avenger': 'Eqp_Astra_Force_Shield', kaiser: 'Eqp_Astra_Nova_Essence', zero: 'Eqp_Astra_Hourglass', adele: 'Eqp_Astra_Bladebinder',
  hayato: 'Eqp_Astra_Kodachi', ren: 'Eqp_Astra_Imugi_Gem', 'erel-light': 'Eqp_Astra_Keir',
  'fp-mage': 'Eqp_Astra_Arcane_Shield', 'il-mage': 'Eqp_Astra_Arcane_Shield', bishop: 'Eqp_Astra_Arcane_Shield', 'blaze-wizard': 'Eqp_Astra_Ruby_Shield',
  evan: 'Eqp_Astra_Honor_Shield', luminous: 'Eqp_Astra_Orb', 'battle-mage': 'Eqp_Astra_Umbral_Shield', kinesis: 'Eqp_Astra_King_Chess_Piece',
  illium: 'Eqp_Astra_Lucent_Wings', lara: 'Eqp_Astra_Four-Jade_Ornament', 'sia-astelle': 'Eqp_Astra_Compass', kanna: 'Eqp_Astra_Talisman', lynn: 'Eqp_Astra_Leaf_Shield',
  bowmaster: 'Eqp_Astra_Feather', marksman: 'Eqp_Astra_Bullseye', pathfinder: 'Eqp_Astra_Relic', 'wind-archer': 'Eqp_Astra_Emerald',
  mercedes: 'Eqp_Astra_Magic_Arrows', 'wild-hunter': 'Eqp_Astra_Wild_Tusk', kain: 'Eqp_Astra_Weapon_Belt',
  'night-lord': 'Eqp_Astra_Charm', shadower: 'Eqp_Astra_Bane_Shield', 'dual-blade': 'Eqp_Astra_Katara', 'night-walker': 'Eqp_Astra_Obsidian',
  phantom: 'Eqp_Astra_Carte', cadena: 'Eqp_Astra_Transmitter', khali: 'Eqp_Astra_Hex_Seeker', hoyoung: 'Eqp_Astra_Diamond_Fan_Tassel', xenon: 'Eqp_Astra_Deca_Core_Controller',
  buccaneer: 'Eqp_Astra_Wrist_Band', corsair: 'Eqp_Astra_Raven_Eye', cannoneer: 'Eqp_Astra_Incendiary', 'thunder-breaker': 'Eqp_Astra_Sapphire',
  shade: 'Eqp_Astra_Fox_Marble', mechanic: 'Eqp_Astra_Magnum', 'angelic-buster': 'Eqp_Astra_Soul_Ring', ark: 'Eqp_Astra_Path', 'mo-xuan': 'Eqp_Astra_Brace_Band',
};

/** Lv 140 Princess No secondary art per class (MapleStory Wiki, Captivating Fragment). Zero has no secondary. */
const PRINCESS_NO: Record<string, string> = {
  hero: 'Eqp_PrincessNo_Medal', paladin: 'Eqp_PrincessNo_Rosary', 'dark-knight': 'Eqp_PrincessNo_Flower_Chain', 'fp-mage': 'Eqp_PrincessNo_Flaming_Book', 'il-mage': 'Eqp_PrincessNo_Damp_Book', bishop: 'Eqp_PrincessNo_Golden_Book', bowmaster: 'Eqp_PrincessNo_Feather', marksman: 'Eqp_PrincessNo_Wreath', pathfinder: 'Eqp_PrincessNo_Immortal_Relic', 'night-lord': 'Eqp_PrincessNo_Charm', shadower: 'Eqp_PrincessNo_Purple_Shadow', 'dual-blade': 'Eqp_PrincessNo_Poisoned_Sword', buccaneer: 'Eqp_PrincessNo_Skull_Armor', corsair: 'Eqp_PrincessNo_Falcon_Eye', cannoneer: 'Eqp_PrincessNo_Fire_Bomb', 'dawn-warrior': 'Eqp_PrincessNo_Floral_Jewel', 'blaze-wizard': 'Eqp_PrincessNo_Floral_Jewel', 'wind-archer': 'Eqp_PrincessNo_Floral_Jewel', 'night-walker': 'Eqp_PrincessNo_Floral_Jewel', 'thunder-breaker': 'Eqp_PrincessNo_Floral_Jewel', aran: 'Eqp_PrincessNo_Flower_Ballast', evan: 'Eqp_PrincessNo_Dragon_Legacy', mercedes: 'Eqp_PrincessNo_Accursed_Arrow', phantom: 'Eqp_PrincessNo_Carte', shade: 'Eqp_PrincessNo_Fox_Marble', luminous: 'Eqp_PrincessNo_Soul_Orb', 'demon-slayer': 'Eqp_PrincessNo_Accursed_Shield', 'demon-avenger': 'Eqp_PrincessNo_Accursed_Shield', 'battle-mage': 'Eqp_PrincessNo_Accursed_Marble', 'wild-hunter': 'Eqp_PrincessNo_Arrowhead', mechanic: 'Eqp_PrincessNo_Magnum', xenon: 'Eqp_PrincessNo_Controller', blaster: 'Eqp_PrincessNo_Megaton_Charges', hayato: 'Eqp_PrincessNo_Wakizashi', kanna: 'Eqp_PrincessNo_Talisman', kaiser: 'Eqp_PrincessNo_Dragon_Essence', kain: 'Eqp_PrincessNo_Immortal_Weapon_Belt', cadena: 'Eqp_PrincessNo_Transmitter', 'angelic-buster': 'Eqp_PrincessNo_Soul_Ring', kinesis: 'Eqp_PrincessNo_Oriental_King_Chess_Piece', adele: 'Eqp_PrincessNo_Immortal_Bladebinder', illium: 'Eqp_PrincessNo_Lucent_Wings', khali: 'Eqp_PrincessNo_Immortal_Hex_Seeker', ark: 'Eqp_PrincessNo_Path', ren: 'Eqp_PrincessNo_Imugi_Gem', lara: 'Eqp_PrincessNo_Immortal_Four-Jade_Ornament', hoyoung: 'Eqp_PrincessNo_Fan_Tassel', lynn: 'Eqp_PrincessNo_Leaf', 'mo-xuan': 'Eqp_PrincessNo_Brace_Band', 'erel-light': 'Eqp_PrincessNo_Keir', 'sia-astelle': 'Eqp_PrincessNo_Compass', mihile: 'Eqp_Soul_Shield_of_Justice',
};

export const ITEMS: Item[] = [
  // ---- Armor ----
  it('cra-hat', 'Royal Hat (CRA)', 'Chaos Root Abyss', 'hat', 150, 1003797, { iconByClass: byBranch([1003797, 1003798, 1003799, 1003800, 1003801]) }),
  it('cra-top', 'Eagle Eye Top (CRA)', 'Chaos Root Abyss', 'top', 150, 1042254, { iconByClass: byBranch([1042254, 1042255, 1042256, 1042257, 1042258]) }),
  it('cra-bottom', 'Trixter Pants (CRA)', 'Chaos Root Abyss', 'bottom', 150, 1062165, { iconByClass: byBranch([1062165, 1062166, 1062167, 1062168, 1062169]) }),
  it('abso-hat', 'AbsoLab Hat', 'AbsoLab', 'hat', 160, 1004422, { iconByClass: byBranch([1004422, 1004423, 1004424, 1004425, 1004426]) }),
  it('abso-overall', 'AbsoLab Suit', 'AbsoLab', 'overall', 160, 1052882, { iconByClass: byBranch([1052882, 1052887, 1052888, 1052889, 1052890]) }),
  it('abso-shoes', 'AbsoLab Shoes', 'AbsoLab', 'shoes', 160, 1073030, { iconByClass: byBranch([1073030, 1073032, 1073033, 1073034, 1073035]) }),
  it('abso-gloves', 'AbsoLab Gloves', 'AbsoLab', 'gloves', 160, 1082636, { iconByClass: byBranch([1082636, 1082637, 1082638, 1082639, 1082640]) }),
  it('abso-cape', 'AbsoLab Cape', 'AbsoLab', 'cape', 160, 1102775, { iconByClass: byBranch([1102775, 1102794, 1102795, 1102796, 1102797]) }),
  it('abso-shoulder', 'AbsoLab Shoulder', 'AbsoLab', 'shoulder', 160, 1152174, { ...NOFLAME, iconByClass: byBranch([1152174, 1152176, 1152177, 1152178, 1152179]) }),
  it('arcane-hat', 'Arcane Umbra Hat', 'Arcane Umbra', 'hat', 200, 1004808, { iconByClass: byBranch([1004808, 1004809, 1004810, 1004811, 1004812]) }),
  it('arcane-overall', 'Arcane Umbra Suit', 'Arcane Umbra', 'overall', 200, 1053063, { iconByClass: byBranch([1053063, 1053064, 1053065, 1053066, 1053067]) }),
  it('arcane-shoes', 'Arcane Umbra Shoes', 'Arcane Umbra', 'shoes', 200, 1073158, { iconByClass: byBranch([1073158, 1073159, 1073160, 1073161, 1073162]) }),
  it('arcane-gloves', 'Arcane Umbra Gloves', 'Arcane Umbra', 'gloves', 200, 1082695, { iconByClass: byBranch([1082695, 1082696, 1082697, 1082698, 1082699]) }),
  it('arcane-cape', 'Arcane Umbra Cape', 'Arcane Umbra', 'cape', 200, 1102940, { iconByClass: byBranch([1102940, 1102941, 1102942, 1102943, 1102944]) }),
  it('arcane-shoulder', 'Arcane Umbra Shoulder', 'Arcane Umbra', 'shoulder', 200, 1152196, { ...NOFLAME, iconByClass: byBranch([1152196, 1152197, 1152198, 1152199, 1152200]) }),
  it('eternal-hat', 'Eternal Hat', 'Eternal', 'hat', 250, 1005980, { iconByClass: byBranch([1005980, 1005981, 1005982, 1005983, 1005984]) }),
  it('eternal-top', 'Eternal Top', 'Eternal', 'top', 250, 1042433, { iconByClass: byBranch([1042433, 1042434, 1042435, 1042436, 1042437]) }),
  it('eternal-bottom', 'Eternal Bottom', 'Eternal', 'bottom', 250, 1062285, { iconByClass: byBranch([1062285, 1062286, 1062287, 1062288, 1062289]) }),
  it('eternal-shoulder', 'Eternal Shoulder', 'Eternal', 'shoulder', 250, 1152212, { ...NOFLAME, iconByClass: byBranch([1152212, 1152213, 1152214, 1152215, 1152216]) }),
  // Eternal cape / gloves / shoes (Limbo, Baldrix, Jupiter): lv 250, 30★, flame advantaged (wiki item pages).
  it('eternal-shoes', 'Eternal Shoes', 'Eternal', 'shoes', 250, 1073629, { ...FA, iconByClass: byBranch([1073629, 1073630, 1073631, 1073632, 1073633]) }),
  it('eternal-gloves', 'Eternal Gloves', 'Eternal', 'gloves', 250, 1082760, { ...FA, iconByClass: byBranch([1082760, 1082761, 1082762, 1082763, 1082764]) }),
  it('eternal-cape', 'Eternal Cape', 'Eternal', 'cape', 250, 1103433, { ...FA, iconByClass: byBranch([1103433, 1103434, 1103435, 1103436, 1103437]) }),
  it('tyrant-shoes', 'Tyrant Boots', 'Tyrant', 'shoes', 150, 1072743, { superior: true, iconByClass: byBranch([1072743, 1072744, 1072745, 1072746, 1072747]) }),
  it('tyrant-cape', 'Tyrant Cloak', 'Tyrant', 'cape', 150, 1102481, { superior: true, iconByClass: byBranch([1102481, 1102482, 1102483, 1102484, 1102485]) }),
  it('tyrant-gloves', 'Tyrant Gloves', 'Tyrant', 'gloves', 150, 1082543, { superior: true, iconByClass: byBranch([1082543, 1082544, 1082545, 1082546, 1082547]) }),
  it('tyrant-belt', 'Tyrant Belt', 'Tyrant', 'belt', 150, 1132174, { superior: true, iconByClass: byBranch([1132174, 1132175, 1132176, 1132177, 1132178]) }),

  // ---- Weapons (base ATT is a default for a two-handed sword / staff; edit per weapon type). Listed best first. ----
  // Destiny (MapleStory Wiki, Destiny Weapon): Lv 250, flame advantaged, upgraded from a liberated Genesis weapon.
  // Stage 1 is fixed at 22★. Stage 2 can be starred 22★ → 25★; a boom is replaced by the Ark of Determination's
  // 10B box (a fresh stage-2 weapon at 22★), in every world.
  it('destiny-weapon-2', 'Destiny Weapon (Stage 2)', 'Destiny', 'weapon', 250, 1402295, { ...FA, minStars: 22, maxStars: 25, boomCost: 10e9, base: { ATT: 373, MATT: 445 }, iconByClass: byWeapon('destiny2') }),
  it('destiny-weapon-1', 'Destiny Weapon (Stage 1)', 'Destiny', 'weapon', 250, 1402290, { ...FA, sf: false, fixedStars: 22, base: { ATT: 373, MATT: 445 }, iconByClass: byWeapon('destiny1') }),
  // Genesis: the sealed weapon has the same base stats but no Star Force until liberation, which fixes it at 22★.
  it('genesis-weapon', 'Genesis Weapon (Liberated)', 'Genesis', 'weapon', 200, 1402268, { sf: false, fixedStars: 22, base: { ATT: 340, MATT: 418 }, iconByClass: byWeapon('genesis') }),
  it('genesis-weapon-sealed', 'Genesis Weapon (Sealed)', 'Genesis', 'weapon', 200, 1402268, { sf: false, base: { ATT: 340, MATT: 418 }, iconByClass: byWeapon('genesis') }),
  it('arcane-weapon', 'Arcane Umbra Weapon', 'Arcane Umbra', 'weapon', 200, 1402259, { base: { ATT: 283, MATT: 347 }, iconByClass: byWeapon('arcane') }),
  it('abso-weapon', 'AbsoLab Weapon', 'AbsoLab', 'weapon', 160, 1302333, { base: { ATT: 197, MATT: 241 }, iconByClass: byWeapon('abso') }),

  // ---- Pitched boss set ----
  it('berserked', 'Berserked', 'Pitched Boss', 'face', 160, 1012632),
  it('magic-eyepatch', 'Magic Eyepatch', 'Pitched Boss', 'eye', 160, 1022278),
  it('source-of-suffering', 'Source of Suffering', 'Pitched Boss', PENDANTS, 160, 1122430),
  it('dreamy-belt', 'Dreamy Belt', 'Pitched Boss', 'belt', 200, 1132308),
  it('cursed-spellbook', 'Cursed Spellbook', 'Pitched Boss', 'pocket', 160, 1162080, { sf: false, cubeable: false }),
  it('endless-terror', 'Endless Terror', 'Pitched Boss', RINGS, 200, 1113306, NOFLAME),
  it('genesis-badge', 'Genesis Badge', 'Pitched Boss', 'badge', 200, 1182285, { flame: false, sf: false, cubeable: false }),
  it('commanding-force', 'Commanding Force Earring', 'Pitched Boss', 'earring', 200, 1032316),
  it('mitras-rage', "Mitra's Rage", 'Pitched Boss', 'emblem', 200, 1190555, { flame: false, sf: false, iconByClass: byBranch([1190555, 1190557, 1190556, 1190558, 1190559]) }),
  it('total-control', 'Total Control', 'Pitched Boss', 'heart', 200, 'Eqp_Total_Control', { flame: false }), // 30★ per the wiki page
  it('plasma-heart', 'Plasma Heart', 'Heart', 'heart', 130, 1672099, { flame: false, maxStars: 20 }), // 20★ per the wiki page (Heart Upgrade Module: Plasma, Easy Kaling+)

  // ---- Brilliant boss set (lv 250, 30★; MapleStory Wiki item pages). Rings take no flames; the rest are flame advantaged. ----
  it('whisper-of-the-source', 'Whisper of the Source', 'Brilliant Boss', RINGS, 250, 'Eqp_Whisper_of_the_Source', NOFLAME),
  it('blissful-nightmare', 'Blissful Nightmare', 'Brilliant Boss', RINGS, 250, 'Eqp_Blissful_Nightmare', NOFLAME),
  it('oath-of-death', 'Oath of Death', 'Brilliant Boss', PENDANTS, 250, 'Eqp_Oath_of_Death', FA),
  it('original-sin-of-pride', 'Original Sin of Pride', 'Brilliant Boss', 'face', 250, 'Eqp_Original_Sin_of_Pride', FA),
  it('sanguinary-spirit', 'Sanguinary Spirit', 'Brilliant Boss', 'eye', 250, 'Eqp_Sanguinary_Spirit', FA),

  // ---- Superior Gollux (lv 150, up to 30★). Earrings / pendant / belt take flames but are NOT
  // flame advantaged (MapleStory Wiki, Bonus Stats: Gollux is an exception); rings take no flames. ----
  it('gollux-ring', 'Superior Gollux Ring', 'Superior Gollux', RINGS, 150, 1113075, NOFLAME),
  it('gollux-earring', 'Superior Gollux Earrings', 'Superior Gollux', 'earring', 150, 1032223, NON_FA),
  it('gollux-pendant', 'Superior Engraved Gollux Pendant', 'Superior Gollux', PENDANTS, 150, 1122267, NON_FA),
  it('gollux-belt', 'Superior Engraved Gollux Belt', 'Superior Gollux', 'belt', 150, 1132246, NON_FA),

  // ---- Dawn boss set (up to 30★). Face / earrings / pendant are flame advantaged (wiki item pages);
  // the ring takes no flames. ----
  it('twilight-mark', 'Twilight Mark', 'Dawn Boss', 'face', 140, 1012757, FA),
  it('estella-earrings', 'Estella Earrings', 'Dawn Boss', 'earring', 160, 1032330, FA),
  it('daybreak-pendant', 'Daybreak Pendant', 'Dawn Boss', PENDANTS, 140, 1122443, FA),
  it('dawn-guardian-ring', 'Dawn Guardian Angel Ring', 'Dawn Boss', RINGS, 160, 1113316, NOFLAME),

  // ---- Boss accessory set ----
  it('condensed-power-crystal', 'Condensed Power Crystal', 'Boss Accessory', 'face', 110, 1012478),
  it('aquatic-letter-eye', 'Aquatic Letter Eye', 'Boss Accessory', 'eye', 100, 1022231),
  it('black-bean-mark', 'Black Bean Mark', 'Boss Accessory', 'eye', 135, 1022232),
  it('papulatus-mark', 'Papulatus Mark', 'Boss Accessory', 'eye', 145, 1022277),
  it('dominator-pendant', 'Dominator Pendant', 'Boss Accessory', PENDANTS, 140, 1122150),
  it('horntail-necklace', 'Chaos Horntail Necklace', 'Boss Accessory', PENDANTS, 120, 1122076),
  it('golden-clover-belt', 'Golden Clover Belt', 'Boss Accessory', 'belt', 140, 1132272),
  it('kannas-treasure', "Kanna's Treasure", 'Boss Accessory', RINGS, 140, 1113155, NOFLAME),
  it('pink-holy-cup', 'Pink Holy Cup', 'Boss Accessory', 'pocket', 140, 1162025, { sf: false, cubeable: false }),
  it('crystal-ventus-badge', 'Crystal Ventus Badge', 'Boss Accessory', 'badge', 130, 1182087, { flame: false, sf: false, cubeable: false }),
  it('royal-black-metal-shoulder', 'Royal Black Metal Shoulder', 'Boss Accessory', 'shoulder', 120, 1152170, NOFLAME),

  // ---- Meister ----
  it('meister-earring', 'Meister Earring', 'Meister', 'earring', 140, 1032200),
  it('meister-ring', 'Meister Ring', 'Meister', RINGS, 140, 1113055, NOFLAME),
  it('meister-shoulder', 'Meister Shoulder', 'Meister', 'shoulder', 140, 1152144, NOFLAME),

  // ---- Misc ----
  it('gold-maple-emblem', 'Gold Maple Leaf Emblem', 'Emblem', 'emblem', 100, 1190301, { flame: false, sf: false }),
  // Astra secondary (v.270 Ride the Lightning): lv 200, up to 30★ after the third quest, Unique potential, no flames.
  // Astra secondaries unlock Star Force in phases; pick the phase you have so the plan only stars as far as it can go.
  it('astra-secondary', 'Astra Secondary (30★ phase)', 'Astra', 'secondary', 200, undefined, { flame: false, maxStars: 30, iconByClass: ASTRA }),
  it('astra-secondary-20', 'Astra Secondary (20★ phase)', 'Astra', 'secondary', 200, undefined, { flame: false, maxStars: 20, iconByClass: ASTRA }),
  it('astra-secondary-15', 'Astra Secondary (15★ phase)', 'Astra', 'secondary', 200, undefined, { flame: false, maxStars: 15, iconByClass: ASTRA }),
  it('secondary', 'Class Secondary (Lv 140)', 'Secondary', 'secondary', 140, undefined, { flame: false, sf: false, iconByClass: PRINCESS_NO }),
  it('black-heart', 'Black Heart', 'Heart', 'heart', 120, 1672076, { flame: false, sf: false, cubeable: false }), // fixed stats: nothing to upgrade
  it('restraint-ring', 'Ring of Restraint / skill ring', 'Special Ring', RINGS, 110, 1113098, { flame: false, sf: false }),
];

export const ITEM_BY_ID: Record<string, Item> = Object.fromEntries(ITEMS.map((x) => [x.id, x]));

export const SLOTS: { slot: EquipSlot; label: string }[] = [
  { slot: 'weapon', label: 'Weapon' }, { slot: 'secondary', label: 'Secondary' }, { slot: 'emblem', label: 'Emblem' },
  { slot: 'hat', label: 'Hat' }, { slot: 'top', label: 'Top' }, { slot: 'bottom', label: 'Bottom' },
  { slot: 'overall', label: 'Overall' }, { slot: 'shoes', label: 'Shoes' }, { slot: 'gloves', label: 'Gloves' },
  { slot: 'cape', label: 'Cape' }, { slot: 'shoulder', label: 'Shoulder' }, { slot: 'belt', label: 'Belt' },
  { slot: 'face', label: 'Face' }, { slot: 'eye', label: 'Eye' }, { slot: 'earring', label: 'Earring' },
  { slot: 'pendant1', label: 'Pendant 1' }, { slot: 'pendant2', label: 'Pendant 2' },
  { slot: 'ring1', label: 'Ring 1' }, { slot: 'ring2', label: 'Ring 2' }, { slot: 'ring3', label: 'Ring 3' }, { slot: 'ring4', label: 'Ring 4' },
  { slot: 'pocket', label: 'Pocket' }, { slot: 'badge', label: 'Badge' }, { slot: 'heart', label: 'Heart' },
];

export function itemsForSlot(slot: EquipSlot): Item[] {
  return ITEMS.filter((x) => (Array.isArray(x.slot) ? x.slot.includes(slot) : x.slot === slot));
}

/** Rough default boom-replacement costs per set (mesos). User-editable in settings. */
export const DEFAULT_REPLACEMENT: Record<string, number> = {
  'Chaos Root Abyss': 1.5e9, AbsoLab: 1.5e9, 'Arcane Umbra': 4e9, Eternal: 15e9, Tyrant: 5e9,
  'Pitched Boss': 15e9, 'Brilliant Boss': 30e9, 'Superior Gollux': 2e9, 'Dawn Boss': 1e9,
  'Boss Accessory': 0.5e9, Meister: 1e9, Astra: 1e9, Destiny: 10e9,
};
