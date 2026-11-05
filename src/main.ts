import './style.css';
import type { Candidate, ClassDef, Equip, EquipSlot, EquivKey, NumericStatKey, PotLine, PotTier, RankedCandidate, StatBundle } from './core/types';
import { CLASSES, CLASS_BY_ID } from './modules/damage.data';
import { defaultAmount, rowLabel, rowsForClass, OPTIONAL_ROW } from './modules/damage';
import type { ModeLevel, ModeProfile } from './modules/starforce';
import { HEROIC_CUBE_PRICE } from './modules/cube';
import { BONUS_CUBE_NX, BONUS_CUBE_PRICE, bonusSlotFor } from './modules/bpot';
import { ITEM_BY_ID, SLOTS, itemsForSlot, DEFAULT_REPLACEMENT, type Item } from './data/items';
import { planSteps, type RankOutput } from './engine/rank';
import { toStep } from './engine/steps';
import { describeBundle } from './core/bundle';
import { defaultSetup, emptyEquip, load, save, type AppSetup } from './state';
import { fmtMeso, h, iconUrl, num, select } from './ui/dom';
import sampleSetup from './data/sample.json';

let state: AppSetup = load();
const view = { bestOnly: true, kinds: { starforce: true, cube: true, 'bpot-cube': true, flame: true } as Record<string, boolean>, page: 0, open: null as number | null, slot: 'weapon' as EquipSlot, calculated: false, stale: false, showErrors: false };

const interactive = () => (state.market.server ?? 'heroic') === 'interactive';
const cls = (): ClassDef => CLASS_BY_ID[state.equivalences.classId] ?? CLASSES[0];

// ---------------------------------------------------------------------------------------------
// Recompute (debounced) — inputs mutate `state` directly, then call changed().
// ---------------------------------------------------------------------------------------------
let timer = 0;
let last: RankOutput | null = null;
let busy = false;
let reqId = 0;
const worker = new Worker(new URL('./engine/worker.ts', import.meta.url), { type: 'module' });
worker.onmessage = (e: MessageEvent<{ id: number; result?: RankOutput; error?: string }>) => {
  if (e.data.id !== reqId) return; // a newer request is in flight
  busy = false;
  last = e.data.result ?? { candidates: [], unvalued: [], weights: {}, warnings: [`Error: ${e.data.error}`], ms: 0 };
  renderResults();
};
/** Snapshot of the setup the current plan was calculated from, so only real changes mark it stale. */
let calcKey = '';
function changed(rerenderEquips = false) {
  save(state);
  if (view.calculated) view.stale = JSON.stringify(state) !== calcKey;
  document.querySelectorAll('.err').forEach((e) => e.classList.remove('err'));
  if (rerenderEquips) renderEquips();
  clearTimeout(timer);
  timer = window.setTimeout(recompute, 80);
}
function recompute() {
  busy = true;
  document.getElementById('results')?.classList.add('busy');
  worker.postMessage({ id: ++reqId, setup: JSON.parse(JSON.stringify(state)) });
}

// ---------------------------------------------------------------------------------------------
// Character + FD rows
// ---------------------------------------------------------------------------------------------
function renderCharacter() {
  const root = document.getElementById('character')!;
  const c = cls();
  const eq = state.equivalences;
  const rows = rowsForClass(c).map((key: EquivKey) => {
    const row = eq.rows[key];
    const amount = row?.amount ?? defaultAmount(key, c);
    const setRow = (patch: Partial<{ amount: number; fdPct: number }>) => {
      const cur = eq.rows[key] ?? { amount: defaultAmount(key, c), fdPct: NaN };
      eq.rows[key] = { ...cur, ...patch };
      changed();
    };
    const isPct = key.endsWith('p') || key === 'IED';
    const optional = key === OPTIONAL_ROW;
    return h('div', { class: optional ? 'fdrow opt' : 'fdrow' },
      num(amount, (v) => setRow({ amount: v ?? defaultAmount(key, c) }), { class: 'w-amt', min: 0, 'aria-label': `${rowLabel(key, c)} amount${isPct ? ' (%)' : ''}` }),
      h('span', { class: 'lab' }, rowLabel(key, c), optional ? tip('Optional. How much % FD one second of skill cooldown reduction is worth to you. Leave it blank and cooldown lines count for nothing.') : null),
      num(Number.isFinite(row?.fdPct) ? row!.fdPct : undefined, (v) => setRow({ fdPct: v ?? NaN }), { class: 'w-fd', placeholder: optional ? 'opt.' : '0.00', 'aria-label': `${rowLabel(key, c)} FD %` }),
      h('span', { class: 'u' }, '% FD'),
    );
  });
  root.replaceChildren(
    h('div', { class: 'form' },
      field('Class', select([...CLASSES].sort((a, b) => a.name.localeCompare(b.name)).map((x) => ({ value: x.id, label: x.name })), c.id, (v) => {
        state.equivalences.classId = v; state.equivalences.rows = {}; renderCharacter(); changed(true);
      })),
      field('Level', num(eq.level, (v) => { eq.level = v ?? 260; changed(); }, { class: 'w-lv', min: 200, max: 300 })),
      field('Server', select([
        { value: 'heroic', label: 'Heroic / Reboot' }, { value: 'interactive', label: 'Interactive' },
      ], state.market.server ?? 'heroic', (v) => { state.market.server = v as 'heroic' | 'interactive'; renderSettings(); changed(true); })),
    ),
    h('h3', {}, 'FD per unit ', tip('How much % Final Damage each stat gives you, e.g. from MapleScouter. You can change the amount on the left; a bigger amount is more precise.')),
    h('div', { class: 'fd' }, h('div', { class: 'fdrow head', 'aria-hidden': true }, h('span', {}, 'Amount'), h('span', {}, 'Stat'), h('span', {}, 'FD'), h('span', {})), rows),
  );
}

/** One labelled form row: label on the left, control on the right. */
function field(label: string, ...controls: (HTMLElement | string)[]): HTMLElement {
  return h('label', { class: 'f' }, h('span', { class: 'fl' }, label), h('span', { class: 'fc' }, ...controls));
}

// ---------------------------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------------------------
function lineKeys(c: ClassDef): { value: string; label: string }[] {
  const mains = c.special === 'xenon' ? ['STR', 'DEX', 'LUK'] : [c.main];
  const a = c.attack;
  const aName = a === 'MATT' ? 'Magic ATT' : 'ATT';
  const out: { value: string; label: string }[] = [{ value: '', label: '—' }];
  for (const s of mains) out.push({ value: `${s}p`, label: `${s} %` });
  if (c.special !== 'demon-avenger') out.push({ value: 'ALLp', label: 'All Stat %' });
  out.push({ value: `${a}p`, label: `${aName} %` }, { value: 'BOSSp', label: 'Boss %' }, { value: 'IED', label: 'IED %' },
    { value: 'DMGp', label: 'Damage %' }, { value: 'CRITDMGp', label: 'Crit Dmg %' });
  for (const s of mains) if (s !== 'HP') out.push({ value: `${s}_PER_LV`, label: `${s} per 9 Lv` });
  for (const s of mains) out.push({ value: s, label: `${s} (flat)` });
  out.push({ value: a, label: `${aName} (flat)` });
  for (const s of c.secondary) out.push({ value: `${s}p`, label: `${s} %` });
  out.push({ value: 'CDR', label: 'Cooldown −s' });
  return out;
}

function flameKeys(c: ClassDef, isWeapon: boolean): { key: keyof StatBundle; label: string }[] {
  const mains = c.special === 'xenon' ? ['STR', 'DEX', 'LUK'] : [c.main];
  const keys: { key: keyof StatBundle; label: string }[] = mains.map((s) => ({ key: s as keyof StatBundle, label: s }));
  for (const s of c.secondary) keys.push({ key: s as keyof StatBundle, label: s });
  keys.push({ key: c.attack, label: c.attack === 'MATT' ? 'MATT' : 'ATT' }); // every flameable item can roll flat ATT/MATT (wiki Bonus Stats tables: non-weapons, all levels)
  if (c.special !== 'demon-avenger') keys.push({ key: 'ALLp', label: 'All Stat %' });
  if (isWeapon) keys.push({ key: 'BOSSp', label: 'Boss %' }, { key: 'DMGp', label: 'Damage %' });
  return keys;
}

/** Where each slot sits in the in-game Equipment window (GMS v.271): [column, row] on a 7x6 grid. */
const CELLS: Record<EquipSlot, [number, number]> = {
  ring1: [0, 0], ring2: [0, 1], ring3: [0, 2], ring4: [0, 3], belt: [0, 4], pocket: [0, 5],
  face: [1, 0], eye: [1, 1], earring: [1, 2], pendant1: [1, 3], pendant2: [1, 4],
  weapon: [2, 4], secondary: [3, 4], emblem: [4, 4],
  hat: [5, 0], top: [5, 1], overall: [5, 1], bottom: [5, 2], shoulder: [5, 3],
  cape: [6, 0], gloves: [6, 1], shoes: [6, 2], heart: [6, 4], badge: [6, 5],
};
/** Reading order for the ← → buttons (an overall lives in the Top cell). */
const GRID_ORDER: EquipSlot[] = ['ring1', 'face', 'hat', 'cape', 'ring2', 'eye', 'top', 'gloves', 'ring3', 'earring', 'bottom', 'shoes',
  'ring4', 'pendant1', 'shoulder', 'belt', 'pendant2', 'weapon', 'secondary', 'emblem', 'heart', 'pocket', 'badge'];
/** public/equip-window.png is a 322x277 crop of the window: 42px cells on a 45px pitch, 5px margin. */
const WIN = { w: 322, h: 277, o: 5, p: 45, c: 42 };
const SLOT_LABEL: Record<string, string> = Object.fromEntries(SLOTS.map((s) => [s.slot, s.label]));
SLOT_LABEL.top = 'Top / Overall';

/** Icon for an item, class-specific where the art differs per class (secondaries). */
const artOf = (item: Item | undefined) => item ? item.iconByClass?.[cls().id] ?? item.iconId : undefined;

function pickSlot(slot: EquipSlot) {
  view.slot = slot;
  renderEquips();
  document.querySelector<HTMLElement>('.editor')?.focus?.();
}

/** The real Equipment window as the slot grid: hover darkens a slot, click edits it. */
function equipGrid(): HTMLElement {
  const c = cls();
  const pos = (col: number, row: number, cols = 1, rows = 1) => ({
    left: `${((WIN.o + col * WIN.p) / WIN.w) * 100}%`, top: `${((WIN.o + row * WIN.p) / WIN.h) * 100}%`,
    width: `${(((cols - 1) * WIN.p + WIN.c) / WIN.w) * 100}%`, height: `${(((rows - 1) * WIN.p + WIN.c) / WIN.h) * 100}%`,
  });
  const style = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${k}:${v}`).join(';');
  const cells: HTMLElement[] = [];
  const hasOverall = !!state.equips.overall?.itemId;
  for (const slot of GRID_ORDER) {
    const [col, row] = CELLS[slot];
    const eff: EquipSlot = slot === 'top' && hasOverall ? 'overall' : slot;
    const eq = state.equips[eff];
    const item = eq?.itemId ? ITEM_BY_ID[eq.itemId] : undefined;
    const on = view.slot === slot;
    const off = slot === 'bottom' && hasOverall;
    cells.push(h('button', {
      type: 'button', class: `cell${item ? ' filled' : ''}${on ? ' on' : ''}${off ? ' off' : ''}`, style: style(pos(col, row)),
      'aria-pressed': on, disabled: off, 'aria-label': `${SLOT_LABEL[slot]}: ${off ? 'covered by the overall' : item?.name ?? 'empty'}`, title: off ? 'An overall covers this slot' : item?.name,
      onclick: () => pickSlot(slot),
    },
      artOf(item) ? h('img', { src: iconUrl(artOf(item)), alt: '', width: 32, height: 32, loading: 'lazy' }) : item ? h('span', { class: 'noart' }, '✓') : null,
      eq && item && eq.stars > 0 ? h('span', { class: 'cs' }, `${eq.stars}★`) : null,
    ));
  }
  const n = Object.values(state.equips).filter((e) => e?.itemId).length;
  const me = h('div', { class: 'me', style: style(pos(2, 0, 3, 4)) }, h('b', {}, c.name), h('span', {}, `Lv. ${state.equivalences.level}`), h('span', {}, `${n} / ${SLOTS.length - 1} slots`));
  return h('div', { class: 'egrid', role: 'group', 'aria-label': 'Equipment slots' },
    h('img', { class: 'ewin', src: `${import.meta.env.BASE_URL}equip-window.png`, width: WIN.w, height: WIN.h, alt: '' }), me, ...cells);
}

/** Editor for the selected slot: item picker, then stars, potential and flame. */
function equipEditor(slot: EquipSlot): HTMLElement {
  const c = cls();
  const label = SLOT_LABEL[slot];
  const hasOverall = !!state.equips.overall?.itemId;
  // The Top cell holds either a top or an overall (as in the game); an overall also covers Bottom.
  const eff: EquipSlot = slot === 'top' && hasOverall ? 'overall' : slot;
  const eq: Equip | undefined = state.equips[eff];
  const item = eq?.itemId ? ITEM_BY_ID[eq.itemId] : undefined;
  const choices = (slot === 'top' ? [...itemsForSlot('top'), ...itemsForSlot('overall')] : [...itemsForSlot(slot)]).sort((a, b) => b.level - a.level);
  const setItem = (v: string) => {
    if (!v) { delete state.equips[slot]; if (slot === 'top') delete state.equips.overall; }
    else {
      const it = ITEM_BY_ID[v];
      const itSlot = Array.isArray(it.slot) ? it.slot[0] : it.slot;
      const target: EquipSlot = slot === 'top' && itSlot === 'overall' ? 'overall' : slot;
      if (slot === 'top') { if (target === 'overall') { delete state.equips.top; delete state.equips.bottom; } else delete state.equips.overall; }
      // A different item starts clean: stars, potential and flame belong to the old item, not the slot.
      const prev = state.equips[target];
      const e = prev && prev.itemId === v ? prev : emptyEquip(target);
      e.itemId = v;
      e.stars = it.fixedStars ?? Math.max(it.minStars ?? 0, Math.min(e.stars, it.maxStars));
      if (!it.flameable) e.flame = {};
      state.equips[target] = e;
    }
    changed(true);
  };
  const head = h('div', { class: 'eh' }, h('h3', {}, label));
  const pick = (id: string, name: string, lvl?: number, iconId?: number | string) => {
    const on = (eq?.itemId ?? '') === id;
    return h('button', { type: 'button', class: `pick${on ? ' on' : ''}`, role: 'option', 'aria-selected': on, onclick: () => setItem(id) },
      iconId ? h('img', { src: iconUrl(iconId), alt: '', width: 32, height: 32, loading: 'lazy' }) : h('span', { class: 'noicon' }),
      h('span', { class: 'pn' }, lvl !== undefined ? h('small', {}, `Lv. ${lvl}`) : null, name));
  };
  const picker = h('div', { class: 'picker', role: 'listbox', 'aria-label': `${label} item` },
    pick('', 'Nothing equipped'), ...choices.map((x) => pick(x.id, x.name, x.level, artOf(x))));
  if (slot === 'bottom' && hasOverall) return h('div', { class: 'editor', tabindex: -1 }, head, h('p', { class: 'muted' }, 'Your overall covers this slot. Change it from the Top cell.'));
  if (!eq || !item) return h('div', { class: 'editor', tabindex: -1 }, head, picker);

  const stars = item.starforceable
    ? h('label', { class: 'stars' }, '★', num(eq.stars, (v) => { eq.stars = Math.max(item.minStars ?? 0, Math.min(item.maxStars, Math.round(v ?? 0))); changed(); }, { class: 'w-star', min: item.minStars ?? 0, max: item.maxStars, 'aria-label': `${label} stars` }), h('span', { class: 'max' }, `/ ${item.maxStars}`))
    : h('span', { class: 'stars fixed' }, item.fixedStars ? `★ ${item.fixedStars} fixed` : 'No Star Force');
  const weaponAtt = eff === 'weapon'
    ? h('label', { class: 'baseatt' }, h('span', {}, `Clean ${c.attack} `, tip(`The weapon's own ${c.attack} before Star Force, flame and scrolls: the first (white) number in the in-game tooltip. Star Force ${c.attack} is added on top by the calculator, so do not include it.`)), num(eq.baseAtt ?? item.base[c.attack], (v) => { eq.baseAtt = v; changed(); }, { class: 'w-att', title: `Clean ${c.attack}: before Star Force, flame and scrolls` }))
    : null;

  const keys = lineKeys(c);
  const potEditor = (which: 'pot' | 'bpot', title: string) => {
    const lines = [0, 1, 2].map((i) => {
      const line: PotLine | undefined = eq[which][i];
      const setLine = (patch: Partial<PotLine>) => {
        const cur: PotLine = eq[which][i] ?? { key: '' as NumericStatKey, value: 0 };
        eq[which][i] = { ...cur, ...patch } as PotLine;
        eq[which] = eq[which].map((l) => l ?? ({ key: '', value: 0 } as unknown as PotLine));
        changed();
      };
      return [
        select(keys, (line?.key as string) ?? '', (v) => setLine({ key: v as NumericStatKey }), { 'aria-label': `${label} ${title} line ${i + 1} stat` }),
        num(line?.value || undefined, (v) => setLine({ value: v ?? 0 }), { class: 'w-pv', placeholder: '0', 'aria-label': `${label} ${title} line ${i + 1} value` }),
      ];
    });
    return h('div', { class: `block ${which}` },
      h('span', { class: 'bl' }, which === 'bpot' ? 'Bonus potential' : 'Potential'),
      h('div', { class: 'plines' }, lines.flat()));
  };
  eq.bpot ??= [];
  const bpotBlock = interactive() && bonusSlotFor(eff) ? potEditor('bpot', 'bonus potential') : null;
  const flameBlock = item.flameable
    ? h('div', { class: 'block' }, h('span', { class: 'bl' }, 'Flame'),
      h('div', { class: 'fgrid' }, flameKeys(c, eff === 'weapon').map(({ key, label: l }) => h('label', { class: 'fcell' }, h('span', {}, l),
        num((eq.flame as Record<string, number>)[key as string], (v) => {
          if (v === undefined || v === 0) delete (eq.flame as Record<string, number>)[key as string];
          else (eq.flame as Record<string, number>)[key as string] = v;
          changed();
        }, { class: 'w-fl', placeholder: '0', 'aria-label': `${label} flame ${l}` })))))
    : null;

  const cubeable = item.cubeable !== false;
  return h('div', { class: 'editor', tabindex: -1 }, head, picker,
    h('div', { class: 'eq-meta' }, stars, weaponAtt), cubeable ? potEditor('pot', 'potential') : null, cubeable ? bpotBlock : null, flameBlock);
}

function renderEquips() {
  const root = document.getElementById('equips')!;
  root.replaceChildren(equipGrid(), equipEditor(view.slot));
}

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------
function profilePicker(group: 'pitched' | 'other', label: string) {
  const m = state.market;
  const prof = (m.sfModeProfiles?.[group] ?? (group === 'pitched' ? [4, 4, 4, 4] : [1, 1, 4, 4])) as ModeProfile;
  const disabled = m.sfEnhanceMode !== 'profile';
  return h('div', { class: 'profile' }, h('span', { class: 'fl' }, label),
    h('div', { class: 'ps' }, [18, 19, 20, 21].map((star, i) => h('label', {}, h('span', {}, `${star}★`),
      select([1, 2, 3, 4].map((x) => ({ value: x, label: `L${x}` })), prof[i], (v) => {
        const next = [...prof] as ModeLevel[];
        next[i] = Number(v) as ModeLevel;
        m.sfModeProfiles = { ...m.sfModeProfiles, [group]: next as unknown as ModeProfile };
        changed();
      }, { disabled })))));
}

function renderSettings() {
  const root = document.getElementById('settings')!;
  const m = state.market;
  const bool = (label: string, get: () => boolean, set: (v: boolean) => void, title?: string) =>
    h('label', { class: 'chk', title }, h('input', { type: 'checkbox', checked: get(), onchange: (e: Event) => { set((e.target as HTMLInputElement).checked); changed(); } }), ' ', label);
  const mesoInput = (label: string, val: number | undefined, set: (v: number | undefined) => void, unit = 1e6, unitLabel = 'M') =>
    field(label, num(val === undefined ? undefined : val / unit, (v) => { set(v === undefined ? undefined : v * unit); changed(); }, { class: 'w-meso' }), h('span', { class: 'u' }, unitLabel));

  const inter = interactive();
  const setCube = (k: string, v: number | undefined) => { if (v === undefined) delete m.cubeCostOverride[k]; else m.cubeCostOverride[k] = v; };

  root.replaceChildren(...[
    h('h3', {}, 'Star Force'),
    h('div', { class: 'form' },
      field('MVP discount', select([0, 3, 5, 10].map((x) => ({ value: x, label: `${x}%` })), m.mvpDiscount, (v) => { m.mvpDiscount = Number(v); changed(); })),
      field('Safeguard 15–17★', select([{ value: 'always', label: 'Always' }, { value: 'auto', label: 'When cheaper' }, { value: 'never', label: 'Never' }], m.safeguard, (v) => { m.safeguard = v as typeof m.safeguard; changed(); }), tip('Safeguard costs extra (three times a normal attempt before discounts) but stops booms at 15 to 17★. On Heroic a boom costs no replacement item, so "When cheaper" lets the maths decide.')),
      field('Enhancement Mode', select([
        { value: 'profile', label: 'Default' }, { value: 'auto', label: 'Optimise' }, { value: 'off', label: 'Off' },
      ], String(m.sfEnhanceMode ?? 'profile'), (v) => { m.sfEnhanceMode = v as 'profile'; renderSettings(); changed(); }), tip('Enhancement Mode levels L1 to L4 for 18 to 21★: higher levels cost more per attempt but raise the success rate. Default assumes L4 everywhere on Pitched and Brilliant items, and L1 at 18–19★ then L4 at 20–21★ on everything else.')),
    ),
    (m.sfEnhanceMode ?? 'profile') === 'profile'
      ? h('details', { class: 'sub' }, h('summary', {}, 'Customise Enhancement Mode levels'), profilePicker('pitched', 'Pitched + Brilliant'), profilePicker('other', 'All other items'))
      : null,
    h('div', { class: 'checks' },
      bool('30% off (Shining Star Force)', () => m.sf30Off, (v) => { m.sf30Off = v; }),
      bool('1+1 event (≤10★)', () => !!m.sf1plus1, (v) => { m.sf1plus1 = v; }),
    ),
    (m.server ?? 'heroic') === 'interactive' ? h('h3', {}, 'Boom replacement cost (per set)') : null,
    (m.server ?? 'heroic') === 'interactive'
      ? h('div', { class: 'form' }, Object.keys(DEFAULT_REPLACEMENT).map((set) =>
        mesoInput(set, m.replacementCost[set], (v) => { m.replacementCost[set] = v ?? 0; }, 1e9, 'B')))
      : null,
    h('h3', {}, 'Cubes & flames ', tip('Heroic / Reboot: booms cost no replacement item, so only attempt mesos count. Cube sale takes 25% off every cube price.')),
    h('div', { class: 'form' },
      mesoInput(inter ? 'Glowing Cube (1,200 NX)' : 'Glowing Cube', m.cubeCostOverride.glowing ?? HEROIC_CUBE_PRICE.glowing, (v) => setCube('glowing', v)),
      mesoInput(inter ? 'Bright Cube (2,200 NX)' : 'Bright Cube', m.cubeCostOverride.bright ?? HEROIC_CUBE_PRICE.bright, (v) => setCube('bright', v)),
      inter ? mesoInput(`Bonus Glowing (${BONUS_CUBE_NX.bonusGlowing.toLocaleString()} NX)`, m.cubeCostOverride.bonusGlowing ?? BONUS_CUBE_PRICE.bonusGlowing, (v) => setCube('bonusGlowing', v)) : null,
      inter ? mesoInput(`Bonus Bright (${BONUS_CUBE_NX.bonusBright.toLocaleString()} NX)`, m.cubeCostOverride.bonusBright ?? BONUS_CUBE_PRICE.bonusBright, (v) => setCube('bonusBright', v)) : null,
      mesoInput('Meso per flame', m.mesoPerFlame, (v) => { m.mesoPerFlame = v ?? 3e6; }),
    ),
    h('div', { class: 'checks' }, bool('Cube sale (25% off)', () => !!m.cubeSale, (v) => { m.cubeSale = v; }, inter ? '25% off every cube price' : '25% off Glowing and Bright cube prices')),
    inter ? h('p', { class: 'muted small' }, 'Cube prices in mesos; defaults assume 10,000 mesos per NX. Bonus potential is ranked too.') : null,
    h('h3', {}, 'Plan'),
    h('details', { class: 'sub' }, h('summary', {}, 'Filters'), h('div', { class: 'checks' },
      bool('Chain steps per item', () => view.bestOnly, (v) => { view.bestOnly = v; renderResults(); }, 'On: cheapest target per item first, then its higher rungs as later steps priced at their extra cost. Off: every target as its own row.'),
      ...Object.keys(view.kinds).map((k) => bool(`Show ${KIND_LABEL[k]}`, () => view.kinds[k], (v) => { view.kinds[k] = v; renderResults(); })),
    )),
  ].filter((x) => !!x) as HTMLElement[]);
}

// ---------------------------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------------------------
const KIND_LABEL: Record<string, string> = { starforce: 'Star Force', cube: 'Cube', 'bpot-cube': 'Bonus cube', flame: 'Flame' };
const fmtB = (x: number) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
const fmtPct = (x: number) => `${x >= 10 ? x.toFixed(1) : x.toFixed(2)}%`;
const SVG = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, ...children: (SVGElement | string)[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of children) el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return el;
}

/** "(?)" tooltip: hover or focus shows the text; screen readers read it as the label. */
function tip(text: string): HTMLElement {
  return h('span', { class: 'tip', tabindex: 0, role: 'note', 'aria-label': text, 'data-tip': text }, '?');
}

/** Cost spread: median, expected and 75th percentile on one track. */
function costChart(x: RankedCandidate): SVGElement | null {
  const pts = [['median', x.p50Cost], ['expected', x.expectedCost], ['75th %', x.p75Cost]].filter((p): p is [string, number] => Number.isFinite(p[1] as number) && (p[1] as number) > 0);
  if (pts.length < 2) return null;
  const max = Math.max(...pts.map((p) => p[1])) * 1.08;
  const W = 240, H = 46, L = 8, R = 8, y = 16;
  const X = (v: number) => L + (v / max) * (W - L - R);
  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart cost', role: 'img', 'aria-label': pts.map((p) => `${p[0]} ${fmtMeso(p[1])}`).join(', ') });
  g.append(svg('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'track' }));
  const lo = Math.min(...pts.map((p) => p[1])), hi = Math.max(...pts.map((p) => p[1]));
  g.append(svg('line', { x1: X(lo), x2: X(hi), y1: y, y2: y, class: 'range' }));
  for (const p of pts) g.append(svg('circle', { cx: X(p[1]), cy: y, r: p[0] === 'expected' ? 6 : 4, class: p[0] === 'expected' ? 'dot main' : 'dot' }));
  // Labels sit in fixed slots (left, centre, right) so they never collide when the points are close together.
  const slots: Record<string, [number, string]> = { median: [L, 'start'], expected: [W / 2, 'middle'], '75th %': [W - R, 'end'] };
  for (const p of pts) g.append(svg('text', { x: slots[p[0]][0], y: H - 6, 'text-anchor': slots[p[0]][1], class: 'lbl' }, p[0]));
  return g;
}
function successChart(x: RankedCandidate, unitLabel: string): SVGElement | null {
  const p = x.pPerAttempt;
  if (!p || p <= 0 || p >= 1) return null;
  const n90 = Math.ceil(Math.log(0.1) / Math.log(1 - p));
  const N = Math.max(5, Math.min(5000, n90));
  const W = 320, H = 96, L = 30, R = 10, T = 8, B = 22;
  const X = (n: number) => L + (n / N) * (W - L - R);
  const Y = (q: number) => T + (1 - q) * (H - T - B);
  const steps = Math.min(N, 120);
  const path = Array.from({ length: steps + 1 }, (_, i) => { const n = (i / steps) * N; return `${i ? 'L' : 'M'}${X(n).toFixed(1)},${Y(1 - Math.pow(1 - p, n)).toFixed(1)}`; }).join(' ');
  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart succ', role: 'img', 'aria-label': `Chance of success by number of ${unitLabel}: 50% after ${Math.ceil(Math.log(0.5) / Math.log(1 - p))}, 90% after ${n90}` });
  for (const q of [0.5, 0.9]) {
    g.append(svg('line', { x1: L, x2: W - R, y1: Y(q), y2: Y(q), class: 'grid' }));
    g.append(svg('text', { x: L - 4, y: Y(q) + 4, 'text-anchor': 'end', class: 'lbl' }, `${q * 100}%`));
  }
  g.append(svg('path', { d: path, class: 'line' }));
  for (const q of [0.5, 0.9]) {
    const n = Math.ceil(Math.log(1 - q) / Math.log(1 - p));
    g.append(svg('circle', { cx: X(n), cy: Y(q), r: 4, class: 'dot main' }));
    g.append(svg('text', { x: Math.min(X(n), W - R - 30), y: H - 8, 'text-anchor': 'middle', class: 'lbl' }, `${n} ${unitLabel}`));
  }
  g.append(svg('text', { x: L, y: H - 8, 'text-anchor': 'start', class: 'lbl dim' }, '0'));
  return g;
}

/** What is still missing before a plan can be calculated. */
function missing(): { fd: boolean; equips: boolean } {
  return {
    fd: !Object.values(state.equivalences.rows).some((r) => Number.isFinite(r?.fdPct)),
    equips: !Object.values(state.equips).some((e) => e?.itemId),
  };
}
function showTab(name: string) {
  for (const t of document.querySelectorAll<HTMLButtonElement>('.tab')) {
    const on = t.dataset.tab === name;
    t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on));
    document.getElementById(t.dataset.tab!)!.hidden = !on;
  }
}
/** Steps per page of the "Then, in order" panel; the panel keeps a fixed height and the user pages through. */
const PAGE = 5;

function calculate() {
  const miss = missing();
  view.showErrors = true;
  view.page = 0; view.open = null;
  if (miss.fd || miss.equips) {
    if (miss.fd) { showTab('character'); document.querySelector('#character .fd')?.classList.add('err'); }
    if (miss.equips) document.querySelector('.egrid')?.classList.add('err');
    renderResults();
    return;
  }
  view.calculated = true; view.stale = false; calcKey = JSON.stringify(state);
  renderResults(); // never scroll the page: the plan column is already in view on wide screens
}
/** Shown until the user clicks Calculate: what is ready, what is still needed. */
function gate(): HTMLElement {
  const miss = missing();
  const req = (label: string, bad: boolean) => h('li', { class: bad ? (view.showErrors ? 'bad' : 'todo') : 'ok' }, bad ? (view.showErrors ? '✗ ' : '○ ') : '✓ ', label);
  return h('section', { class: 'gate' },
    h('span', { class: 'sup' }, 'Your prog plan'),
    h('ul', { class: 'reqs' }, req('FD values entered (Character tab)', miss.fd), req('At least one item equipped', miss.equips)),
    h('button', { type: 'button', class: 'btn filled big', onclick: calculate }, 'Calculate'),
  );
}

/** "4 hat options only add cooldown. Fill in the Cooldown −s FD row (Character tab) to rank them." */
function unvaluedNote(list: Candidate[]): string {
  const rows: string[] = [];
  const has = (k: string) => list.some((c) => { const v = (c.after as Record<string, unknown>)[k]; return Array.isArray(v) ? v.length > 0 : (v as number) > 0; });
  if (has('IED')) rows.push('IED');
  if (has('CRITDMGp')) rows.push('Crit Dmg %');
  if (has('CDR')) rows.push('Cooldown −s');
  const what = rows.map((r) => r === 'IED' ? 'IED' : r === 'Crit Dmg %' ? 'crit damage' : 'cooldown').join(' or ');
  const slots = new Set(list.map((c) => c.slot));
  const where = slots.size === 1 ? `${[...slots][0]} ` : '';
  return `${list.length} ${where}option${list.length === 1 ? '' : 's'} only add ${what}. Fill in the ${rows.join(' and ')} FD row${rows.length === 1 ? '' : 's'} (Character tab) to rank ${list.length === 1 ? 'it' : 'them'}.`;
}

function renderResults() {
  const root = document.getElementById('results')!;
  if (!view.calculated) { root.classList.remove('busy'); root.replaceChildren(gate()); return; }
  root.classList.toggle('busy', busy);
  if (!last) return;
  const c = cls();
  let list = last.candidates.filter((x) => view.kinds[x.kind]);
  if (view.bestOnly) list = planSteps(list);
  const rest = list.slice(1);
  const pages = Math.max(1, Math.ceil(rest.length / PAGE));
  view.page = Math.min(Math.max(0, view.page), pages - 1);
  const pageItems = rest.slice(view.page * PAGE, (view.page + 1) * PAGE);
  const slotLabel = (s: EquipSlot) => SLOTS.find((x) => x.slot === s)?.label ?? s;
  const m = state.market;
  const unitCost = (x: RankedCandidate): [number, string] | null => {
    if (x.kind === 'flame') return [m.mesoPerFlame, 'flames'];
    if (x.kind === 'cube' || x.kind === 'bpot-cube') {
      const cube = x.notes?.[0] ?? '';
      const key = /bright/i.test(cube) ? (x.kind === 'bpot-cube' ? 'bonusBright' : 'bright') : (x.kind === 'bpot-cube' ? 'bonusGlowing' : 'glowing');
      const base = (m.cubeCostOverride as Record<string, number>)[key] ?? (key === 'glowing' ? HEROIC_CUBE_PRICE.glowing : key === 'bright' ? HEROIC_CUBE_PRICE.bright : undefined);
      return base ? [base * (m.cubeSale ? 0.75 : 1), 'cubes'] : null;
    }
    return null;
  };

  const chip = (x: RankedCandidate) => h('span', { class: `chip k-${x.kind}` }, KIND_LABEL[x.kind]);
  const iconOf = (x: RankedCandidate, size: number) => {
    const item = ITEM_BY_ID[state.equips[x.slot]?.itemId ?? ''];
    return artOf(item) ? h('img', { src: iconUrl(artOf(item)), alt: '', width: size, height: size, loading: 'lazy' }) : h('span', { class: 'noicon' });
  };
  const nameOf = (x: RankedCandidate) => ITEM_BY_ID[state.equips[x.slot]?.itemId ?? '']?.name ?? slotLabel(x.slot);

  // --- Details shown when a step is expanded ---
  const detail = (x: RankedCandidate, st: ReturnType<typeof toStep>) => {
    const unit = unitCost(x);
    const attempts = unit ? Math.round(x.expectedCost / unit[0]) : undefined;
    // Only numbers the tiles do not already show: cost spread, how many tries, odds per try.
    const facts: [string, string][] = [];
    if (st.median) facts.push(['Median cost', fmtMeso(st.median)]);
    if (x.p75Cost) facts.push(['75th percentile', fmtMeso(x.p75Cost)]);
    if (attempts && unit) {
      const cubeType = unit[1] === 'cubes' ? (x.notes?.[0] ?? '').replace(/\s*cubes?\b/i, '').trim() : '';
      facts.push([`Expected ${unit[1]}`, cubeType ? `${attempts.toLocaleString()} ${cubeType}` : attempts.toLocaleString()]);
    }
    if (x.pPerAttempt) facts.push(['Chance per try', fmtPct(x.pPerAttempt * 100)]);
    const how = st.how?.replace(/^Use: [^·]+(?: · )?/, '').trim(); // the cube type is already in the facts
    const succ = unit ? successChart(x, unit[1]) : null;
    return h('div', { class: 'step-detail' },
      h('dl', { class: 'facts' }, facts.map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v)))),
      h('p', { class: 'stats' }, h('b', {}, 'Now: '), describeBundle(x.before), h('br'), h('b', {}, 'Target: '), st.short.replace(/^to /, ''),
        x.chainFrom ? ` (after the ${toStep({ ...x, label: x.chainFrom }, nameOf(x), last!.weights, c).short.replace(/^to /, '')} step)` : ''),
      how ? h('p', { class: how.includes('⚠') ? 'how warn' : 'how' }, how) : null,
      h('div', { class: 'charts' },
        h('figure', {}, h('figcaption', {}, 'Cost spread'), costChart(x) ?? h('span', { class: 'muted' }, '—')),
        succ ? h('figure', {}, h('figcaption', {}, `Chance you're done after n ${unit![1]}`), succ) : null),
    );
  };

  // --- "Do this next" ---
  const nextView = (x: RankedCandidate) => {
    const st = toStep(x, nameOf(x), last!.weights, c);
    return h('section', { class: `next${view.stale ? ' dim' : ''}` },
      h('span', { class: 'sup' }, 'Do this next'),
      h('div', { class: 'hero' }, h('span', { class: 'blob' }, iconOf(x, 52)),
        h('div', {}, h('div', { class: 'instr' }, `${st.verb} ${st.item}`, h('small', {}, chip(x), ' ', st.short)))),
      h('div', { class: 'kpis' },
        h('div', { class: 'kpi' }, h('span', { class: 'l' }, 'Expected cost'), h('span', { class: 'v' }, fmtMeso(st.cost))),
        h('div', { class: 'kpi' }, h('span', { class: 'l' }, 'FD gain'), h('span', { class: 'v' }, `+${fmtPct(st.fd)}`)),
        h('div', { class: 'kpi eff' }, h('span', { class: 'l' }, 'B meso per 1% FD'), h('span', { class: 'v' }, `${fmtB(st.bPerFd)}B`))),
      h('details', { class: 'more' }, h('summary', {}, 'Details'), detail(x, st)),
    );
  };

  // --- Ranked list: one expandable row per step ---
  const stepRow = (x: RankedCandidate, st: ReturnType<typeof toStep>, i: number) => [
    h('span', { class: 'n' }, String(i + 1)),
    h('span', { class: 'ic' }, iconOf(x, 32)),
    h('span', { class: 'txt' }, chip(x), ' ', h('b', {}, st.item), ' → ', st.short, (() => { const w = x.notes?.find((n) => n.startsWith('⚠')); return w ? h('span', { class: 'wb', title: w.slice(2) }, '⚠') : null; })()),
    h('span', { class: 'mk' },
      h('span', {}, h('i', {}, 'Expected cost'), h('b', {}, fmtMeso(st.cost))),
      h('span', {}, h('i', {}, 'FD gain'), h('b', {}, `+${fmtPct(st.fd)}`)),
      h('span', { class: 'eff' }, h('i', {}, 'B meso per 1% FD'), h('b', {}, `${fmtB(st.bPerFd)}B`))),
  ];
  // A row opens the step in place of the list (with a Back button) so the panel never grows past the page.
  const stepView = (x: RankedCandidate, i: number) => {
    const st = toStep(x, nameOf(x), last!.weights, c);
    return h('li', {}, h('button', { type: 'button', class: 'step', onclick: () => { view.open = i; renderResults(); } }, stepRow(x, st, i)));
  };
  const openView = (x: RankedCandidate, i: number) => {
    const st = toStep(x, nameOf(x), last!.weights, c);
    return h('div', { class: 'open' },
      h('button', { type: 'button', class: 'btn back', onclick: () => { view.open = null; renderResults(); } }, '‹ Back to the list'),
      h('div', { class: 'step still' }, stepRow(x, st, i)),
      detail(x, st));
  };

  const hasRows = Object.values(state.equivalences.rows).some((r) => Number.isFinite(r?.fdPct));
  const empty = !Object.keys(state.equips).length
    ? 'Add your equipment below to see your prog plan.'
    : !hasRows ? 'Enter your FD values to get your prog plan.' : 'No upgrades found.';

  root.replaceChildren(...[
    view.stale ? h('div', { class: 'stale' }, h('span', {}, 'Inputs changed since this plan was calculated.'), h('button', { type: 'button', class: 'btn tonal', onclick: calculate }, 'Recalculate')) : null,
    last.warnings.length && hasRows ? h('div', { class: 'warn' }, last.warnings.map((w) => h('div', {}, w))) : null,
    list.length ? nextView(list[0]) : h('section', { class: 'next empty' }, h('span', { class: 'sup' }, 'Do this next'), h('p', { class: 'muted' }, empty)),
    rest.length ? h('section', { class: `card plan${view.stale ? ' dim' : ''}` },
      h('h2', {}, 'Then, in order ', tip('Cheapest billion meso per 1% Final Damage first. Each row is the best target for that item and action; open a row for the numbers behind it.')),
      view.open !== null && list[view.open] ? openView(list[view.open], view.open) : h('ol', { class: 'steps' }, pageItems.map((x, i) => stepView(x, view.page * PAGE + i + 1))),
      view.open === null && pages > 1 ? h('nav', { class: 'pager', 'aria-label': 'Plan pages' },
        h('button', { type: 'button', class: 'btn', disabled: view.page === 0, onclick: () => { view.page--; renderResults(); } }, '‹ Previous'),
        h('span', { class: 'pg' }, `Steps ${view.page * PAGE + 2}–${view.page * PAGE + 1 + pageItems.length} of ${list.length}`, h('small', {}, `Page ${view.page + 1} of ${pages}`)),
        h('button', { type: 'button', class: 'btn', disabled: view.page >= pages - 1, onclick: () => { view.page++; renderResults(); } }, 'Next ›')) : null,
      last.unvalued.length ? h('p', { class: 'muted small' }, unvaluedNote(last.unvalued)) : null,
    ) : null,
  ].filter((x) => !!x) as HTMLElement[]);
}

// ---------------------------------------------------------------------------------------------
// Header actions
// ---------------------------------------------------------------------------------------------
function wireHeader() {
  document.getElementById('export')!.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'maplestory-ev-setup.json' });
    a.click(); URL.revokeObjectURL(a.href);
  });
  const file = document.getElementById('import-file') as HTMLInputElement;
  document.getElementById('import')!.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      const s = JSON.parse(await f.text()) as AppSetup;
      if (s.version !== 1) throw new Error('Unknown file version');
      if (!confirm(`Import ${f.name}? This replaces everything you entered: class, FD values, equipment and settings.`)) { file.value = ''; return; }
      state = { ...defaultSetup(), ...s, market: { ...defaultSetup().market, ...s.market } };
      view.calculated = false; view.showErrors = false; renderAll(); changed();
    } catch (e) { alert(`Couldn't import: ${(e as Error).message}`); }
    file.value = '';
  });
  document.getElementById('reset')!.addEventListener('click', () => {
    if (!confirm('Clear your class, FD values and equipment?')) return;
    state = defaultSetup(); view.calculated = false; view.showErrors = false; renderAll(); changed();
  });
  document.getElementById('sample')!.addEventListener('click', () => {
    if (!confirm('Load the sample Ren? This replaces everything you entered: class, FD values, equipment and settings.')) return;
    const s = JSON.parse(JSON.stringify(sampleSetup)) as AppSetup;
    state = { ...defaultSetup(), ...s, market: { ...defaultSetup().market, ...s.market } };
    view.calculated = false; view.showErrors = false; renderAll(); changed();
  });
  // Sidebar tabs: Character / Settings
  for (const t of document.querySelectorAll<HTMLButtonElement>('.tab')) t.addEventListener('click', () => showTab(t.dataset.tab!));
}

function renderAll() { renderCharacter(); renderSettings(); renderEquips(); renderResults(); }

wireHeader();
renderAll();
recompute();
