// Item data checks against the MapleStory Wiki item pages (levels, slots, star caps, flame rules).
import { test } from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { ITEMS, ITEM_BY_ID, itemsForSlot } from '../src/data/items';
import { isFlameAdvantaged } from '../src/modules/flame';
import { rank } from '../src/engine/rank';
import { CLASS_BY_ID, CLASSES } from '../src/modules/damage.data';
import { damageModule } from '../src/modules/damage';
import { starforceModule } from '../src/modules/starforce';
import { cubeModule } from '../src/modules/cube';
import { flameModule } from '../src/modules/flame';
import { emptyEquip } from '../src/state';
import { sampleNightLord } from './fixtures';

test('Superior Gollux and Dawn boss sets: level, slot, 30★ cap, flames', () => {
  const want: [string, number, string, boolean, boolean | null][] = [
    // id, level, slot, flameable, flame advantaged
    ['gollux-ring', 150, 'ring1', false, null],
    ['gollux-earring', 150, 'earring', true, false],
    ['gollux-pendant', 150, 'pendant1', true, false],
    ['gollux-belt', 150, 'belt', true, false],
    ['twilight-mark', 140, 'face', true, true],
    ['estella-earrings', 160, 'earring', true, true],
    ['daybreak-pendant', 140, 'pendant2', true, true],
    ['dawn-guardian-ring', 160, 'ring4', false, null],
  ];
  for (const [id, level, slot, flame, fa] of want) {
    const it = ITEM_BY_ID[id];
    assert.ok(it, id);
    assert.equal(it.level, level, id);
    assert.ok(itemsForSlot(slot as never).includes(it), `${id} in ${slot}`);
    assert.equal(it.maxStars, 30, id);
    assert.equal(it.flameable, flame, id);
    if (fa !== null) assert.equal(isFlameAdvantaged(it), fa, id);
  }
});

test('rings, shoulders, badges, emblems, secondaries and hearts take no flames', () => {
  for (const it of ITEMS) {
    const slots = Array.isArray(it.slot) ? it.slot : [it.slot];
    if (slots.some((s) => /^(ring\d|shoulder|badge|emblem|secondary|heart)$/.test(s))) assert.equal(it.flameable, false, it.id);
  }
});

test('Gollux and Dawn items get Star Force, cube and flame steps', () => {
  const s = sampleNightLord();
  s.equips.belt = { ...emptyEquip('belt', 'gollux-belt'), stars: 17, pot: [{ key: 'LUKp', value: 9 }] };
  s.equips.face = { ...emptyEquip('face', 'twilight-mark'), stars: 17, pot: [{ key: 'LUKp', value: 9 }] };
  const r = rank(s, CLASS_BY_ID['night-lord'], { damage: damageModule, starforce: starforceModule, cube: cubeModule, flame: flameModule });
  for (const slot of ['belt', 'face'] as const) {
    for (const kind of ['starforce', 'cube', 'flame']) assert.ok(r.candidates.some((c) => c.slot === slot && c.kind === kind), `${slot} ${kind}`);
  }
});

test('every item icon, including the per-class art, is bundled in public/icons', () => {
  const missing: string[] = [];
  for (const it of ITEMS) {
    const ids = new Set<string | number>();
    if (it.iconId) ids.add(it.iconId);
    for (const v of Object.values(it.iconByClass ?? {})) ids.add(v);
    for (const id of ids) if (!fs.existsSync(`public/icons/${id}.png`)) missing.push(`${it.id}: ${id}`);
  }
  assert.deepEqual(missing, []);
});

test('armor sets and weapons carry art for every class', () => {
  // Secondaries are the exception: Zero has none and Beast Tamer's Astra secondary doesn't exist.
  const perClass = ITEMS.filter((it) => it.iconByClass && it.slot !== 'secondary');
  assert.ok(perClass.length >= 30);
  for (const it of perClass) for (const c of CLASSES) assert.ok(it.iconByClass![c.id], `${it.id} has no art for ${c.id}`);
});

test('Destiny weapons: stage 1 fixed at 22★, stage 2 stars 22→25 with a 10B replacement on boom in every world', () => {
  const s1 = ITEM_BY_ID['destiny-weapon-1'], s2 = ITEM_BY_ID['destiny-weapon-2'];
  assert.equal(s1.level, 250); assert.equal(s1.starforceable, false); assert.equal(s1.fixedStars, 22); assert.equal(isFlameAdvantaged(s1), true);
  assert.equal(s2.level, 250); assert.equal(s2.minStars, 22); assert.equal(s2.maxStars, 25); assert.equal(s2.boomCost, 10e9);
  assert.deepEqual(starforceModule.targets(s2, 22), [23, 24, 25]);
  const heroic = { ...sampleNightLord().market, server: 'heroic' as const, replacementCost: {} };
  const c = starforceModule.costDetailed!(s2, 22, 23, heroic);
  assert.ok(c.expectedBooms! > 0.1, 'a 22→23 attempt booms sometimes');
  // Mean includes 10B per expected boom on top of attempt mesos, and a boom lands back at 22★ (no re-climb below it).
  assert.ok(c.mean > c.meanAttemptMesos! + 0.9 * 10e9 * c.expectedBooms!, `${c.mean} vs ${c.meanAttemptMesos} + 10B × ${c.expectedBooms}`);
  assert.equal(c.policy.length, 1);
  // Weapon list order: Destiny 2, Destiny 1, Genesis Liberated, Genesis Sealed, Arcane, AbsoLab.
  assert.deepEqual(itemsForSlot('weapon').map((x) => x.id), ['destiny-weapon-2', 'destiny-weapon-1', 'genesis-weapon', 'genesis-weapon-sealed', 'arcane-weapon', 'abso-weapon']);
});
