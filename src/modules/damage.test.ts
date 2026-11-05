// Run: npx tsx --test modules/damage.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StatEquivalences } from '../core/types';
import { damageModule, defaultAmount, fdGain, missingRows, rowLabel, rowsForClass, statWeights } from './damage';
import { CLASS_BY_ID, CLASSES } from './damage.data';

const close = (a: number, b: number, tol = 1e-9, msg = '') =>
  assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg} expected ${b}, got ${a}`);

const NL = CLASS_BY_ID['night-lord'];
// A plausible end-game Night Lord, read off a stat-equivalence tool.
const nlEq: StatEquivalences = {
  classId: 'night-lord', level: 275,
  rows: {
    STAT: { amount: 100, fdPct: 0.93 }, STATp: { amount: 10, fdPct: 13.8 },
    SUBSTAT: { amount: 100, fdPct: 0.09 }, SUBSTATp: { amount: 10, fdPct: 1.2 },
    ATT: { amount: 30, fdPct: 1.66 }, ATTp: { amount: 10, fdPct: 4.76 },
    BOSSp: { amount: 40, fdPct: 6.78 }, DMGp: { amount: 40, fdPct: 6.78 },
    IED: { amount: 40, fdPct: 10.6 }, CRITDMGp: { amount: 8, fdPct: 3.1 },
  },
};

test('each row reproduces itself exactly', () => {
  close(fdGain(nlEq, NL, {}, { LUK: 100 }), 0.93);
  close(fdGain(nlEq, NL, {}, { LUKp: 10 }), 13.8);
  close(fdGain(nlEq, NL, {}, { DEX: 100 }), 0.09);
  close(fdGain(nlEq, NL, {}, { DEXp: 10 }), 1.2);
  close(fdGain(nlEq, NL, {}, { ATT: 30 }), 1.66);
  close(fdGain(nlEq, NL, {}, { ATTp: 10 }), 4.76);
  close(fdGain(nlEq, NL, {}, { BOSSp: 40 }), 6.78);
  close(fdGain(nlEq, NL, {}, { DMGp: 40 }), 6.78);
});

test('no-op swap is 0; FD source is exact; All Stat % = STAT% + SUBSTAT%', () => {
  const x = { LUKp: 12, ATT: 10, BOSSp: 40 };
  close(fdGain(nlEq, NL, x, x), 0);
  close(fdGain(nlEq, NL, {}, { FD: [10] }), 10);
  close(fdGain(nlEq, NL, {}, { ALLp: 10 }), 13.8 + 1.2);
});

test('rows are linear per unit, any amount works', () => {
  close(fdGain(nlEq, NL, {}, { BOSSp: 20 }), 6.78 / 2);
  const bigger = { ...nlEq, rows: { ...nlEq.rows, STAT: { amount: 1000, fdPct: 9.3 } } };
  close(fdGain(bigger, NL, {}, { LUK: 100 }), 0.93);
});

test('flat ATT and ATT% combine with their cross term', () => {
  const a = 1.66 / 100 / 30, p = 4.76 / 100 / 10;
  close(fdGain(nlEq, NL, {}, { ATT: 30, ATTp: 10 }), (1 + a * 30 + p * 10 + a * p * 300 - 1) * 100);
});

test('IED and crit damage rows reproduce themselves; IED stacks multiplicatively', () => {
  close(fdGain(nlEq, NL, {}, { IED: [40] }), 10.6);
  close(fdGain(nlEq, NL, {}, { CRITDMGp: 8 }), 3.1);
  close(fdGain(nlEq, NL, {}, { CRITDMGp: 4 }), 3.1 / 2);
  // Two 40% lines are worth less than twice one line, and removing a line undoes it exactly.
  assert.ok(fdGain(nlEq, NL, {}, { IED: [40, 40] }) < 2 * 10.6);
  close(fdGain(nlEq, NL, { IED: [40] }, { IED: [40] }), 0);
  const noIed = { ...nlEq, rows: { ...nlEq.rows, IED: undefined, CRITDMGp: undefined } };
  close(fdGain(noIed, NL, {}, { IED: [40], CRITDMGp: 8 }), 0);
});

test('missingRows lists rows still to fill', () => {
  assert.deepEqual(missingRows(nlEq, NL), []);
  const partial: StatEquivalences = { classId: 'night-lord', level: 275, rows: { ATT: { amount: 30, fdPct: 1.6 } } };
  assert.deepEqual(missingRows(partial, NL), ['STAT', 'STATp', 'SUBSTAT', 'SUBSTATp', 'ATTp', 'BOSSp', 'IED', 'CRITDMGp']);
  assert.deepEqual(rowsForClass(CLASS_BY_ID['xenon']), ['STAT', 'STATp', 'ATT', 'ATTp', 'BOSSp', 'IED', 'CRITDMGp', 'CDR']);
});

test('statWeights: main = 1', () => {
  const w = statWeights(nlEq, NL) as Record<string, number>;
  close(w.LUK, 1);
  close(w.ATT, (1.66 / 30) / (0.93 / 100), 1e-6);
  for (const k of ['ATT', 'ATTp', 'BOSSp', 'DMGp', 'LUKp', 'DEX', 'DEXp', 'ALLp', 'ALL', 'IED', 'CRITDMGp']) assert.ok(w[k] > 0, k);
  assert.equal(damageModule.fdGain, fdGain);
});

test('form helpers cover every class', () => {
  assert.ok(CLASSES.length >= 50);
  for (const c of CLASSES) for (const k of rowsForClass(c)) {
    assert.ok(defaultAmount(k, c) > 0, `${c.id} ${k}`);
    assert.ok(rowLabel(k, c).length > 0);
  }
  assert.equal(rowLabel('SUBSTAT', CLASS_BY_ID['shadower']), 'STR or DEX');
  assert.equal(rowLabel('ATTp', CLASS_BY_ID['bishop']), 'Magic ATT %');
});

test('cooldown reduction is worth nothing until its optional row is filled', () => {
  close(fdGain(nlEq, NL, {}, { CDR: 2 }), 0);
  assert.ok(!missingRows(nlEq, NL).includes('CDR'));
  const withCdr = { ...nlEq, rows: { ...nlEq.rows, CDR: { amount: 1, fdPct: 1.5 } } };
  close(fdGain(withCdr, NL, {}, { CDR: 2 }), 3);
});
