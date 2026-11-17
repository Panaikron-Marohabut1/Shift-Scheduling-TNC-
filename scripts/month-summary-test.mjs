import assert from 'node:assert/strict';
import { test } from 'node:test';
import { summarizeMonth } from '../apps/web/src/shared/scheduling/month-summary.js';

// Use the app's shift definitions so the calculation is tested against its normal inputs.
globalThis.location = new URL('https://shiftflow.test/?today=2026-11-17');
const { state: { shiftDefs } } = await import('../apps/web/src/app/state.js');
delete globalThis.location;

const summary = (...days) => summarizeMonth(days, shiftDefs);
const bucket = (minutes, shifts, unquantifiedShifts = 0) => ({ minutes, shifts, unquantifiedShifts });

test('four holiday OT shifts belong to an exclusive bucket in the December example', () => {
  const days = [
    ...Array.from({ length: 11 }, (_, index) => ({ code: index % 2 ? 'N' : 'M' })),
    { code: 'NT', holidayOvertime: { holidayDate: '2026-12-05' } },
    { code: 'MT', holidayOvertime: { holidayDate: '2026-12-07' } },
    { code: 'NT', holidayOvertime: { holidayDate: '2026-12-10' } },
    { code: 'NT', holidayOvertime: { holidayDate: '2026-12-31' } },
  ];
  const actual = summarizeMonth(days, shiftDefs);
  assert.deepEqual(actual.regular, bucket(7920, 11));
  assert.deepEqual(actual.holidayOvertime, bucket(2880, 4));
  assert.deepEqual(actual.overtime, bucket(0, 0));
  assert.deepEqual(actual.total, bucket(10800, 15));
});

test('the same roster code can be ordinary OT and holiday OT based on its origin', () => {
  const actual = summary({ code: 'NT' }, { code: 'NT', holidayOvertime: { holidayDate: '2026-12-07' } });
  assert.deepEqual(actual.overtime, bucket(720, 1));
  assert.deepEqual(actual.holidayOvertime, bucket(720, 1));
  assert.deepEqual(actual.total, bucket(1440, 2));
});

test('normal, daytime, and half-day OT use scheduled duration without handoff or multipliers', () => {
  const actual = summary({ code: 'M' }, { code: 'N' }, { code: 'D' }, { code: 'MTh' }, { code: 'NTh' });
  assert.deepEqual(actual.regular, bucket(1980, 3));
  assert.deepEqual(actual.overtime, bucket(720, 2));
  assert.deepEqual(actual.total, bucket(2700, 5));
});

test('authoritative overnight slot times count the full shift in the month of the input', () => {
  const december = summary({ code: 'OT', workDate: '2026-12-31', startTime: '19:30:00', endTime: '07:30:00' });
  const january = summary({ code: 'O', workDate: '2027-01-01' });
  assert.deepEqual(december.overtime, bucket(720, 1));
  assert.deepEqual(january.total, bucket(0, 0));
});

test('database clocks with second precision or midnight 24:00 preserve exact whole minutes', () => {
  const actual = summary(
    { code: 'N', startTime: '19:30:34.127001', endTime: '07:30:34.127001', absence: true },
    { code: 'M', startTime: '18:30:00', endTime: '24:00:00' },
    { code: 'M', startTime: '08:30:40', endTime: '17:30:41' },
  );
  assert.deepEqual(actual.absence, bucket(720, 1));
  assert.deepEqual(actual.total, bucket(330, 2, 1));
});

test('two-part swap codes use the effective first segment and do not count swaps to off', () => {
  const actual = summary({ code: 'N/O' }, { code: 'O/M' }, { code: 'MT/N' }, { code: '-' });
  assert.deepEqual(actual.regular, bucket(720, 1));
  assert.deepEqual(actual.overtime, bucket(720, 1));
  assert.deepEqual(actual.total, bucket(1440, 2));
  assert.equal(actual.unclassifiedShifts, 0);
});

test('legacy multi-step edits use their final shift and the immediately prior code for leave hours', () => {
  const actual = summary({ code: 'O/M/N' }, { code: 'O/M/S' });
  assert.deepEqual(actual.regular, bucket(720, 1));
  assert.deepEqual(actual.leave, bucket(720, 1));
});

test('leave hours come from the original duty, including approved holiday leave or legacy codes', () => {
  const actual = summary({ code: 'L', baseCode: 'D' }, { code: 'H', baseCode: 'N' }, { code: 'V/M' }, { code: 'VGh', baseCode: 'M' });
  assert.deepEqual(actual.leave, bucket(2340, 3.5));
  assert.deepEqual(actual.total, bucket(0, 0));
});

test('approved leave minutes override current schedules and already represent the applied portion', () => {
  assert.deepEqual(summary({ code: 'L', baseCode: 'N', leaveMinutes: 690 }).leave, bucket(690, 1));
  assert.deepEqual(summary({ code: 'VGh', baseCode: 'N', leaveMinutes: 300 }).leave, bucket(300, 0.5));
  assert.deepEqual(summary({ code: 'L', baseCode: 'M', leaveMinutes: -1 }).leave, bucket(0, 1, 1));
});

test('legacy leave uses the original slot clock and applies its leave portion once', () => {
  const before = { baseCode: 'M', baseStartTime: '08:30:00', baseEndTime: '17:00:00' };
  assert.deepEqual(summary({ ...before, code: 'L' }).leave, bucket(510, 1));
  assert.deepEqual(summary({ ...before, code: 'VGh' }).leave, bucket(255, 0.5));
});

test('an absence moves the entire scheduled shift out of its work bucket and removing it restores the same summary', () => {
  const holiday = { code: 'NT', holidayOvertime: { holidayDate: '2026-12-31' } };
  const halfDayOT = { code: 'NTh' };
  const before = summary(holiday, halfDayOT);
  const marked = summary({ ...holiday, absence: true }, { ...halfDayOT, absence: true });
  assert.deepEqual(marked.absence, bucket(1080, 2));
  assert.deepEqual(marked.holidayOvertime, bucket(0, 0));
  assert.deepEqual(marked.overtime, bucket(0, 0));
  assert.deepEqual(marked.total, bucket(0, 0));
  assert.deepEqual(summary({ ...holiday, absence: false }, halfDayOT), before);
});

test('recorded time count remains identifiable when a known work or leave code has no valid hours', () => {
  const actual = summary({ code: 'M' }, { code: 'OT' }, { code: 'L' }, { code: 'H', baseCode: 'O' });
  assert.deepEqual(actual.total, bucket(720, 2, 1));
  assert.deepEqual(actual.overtime, bucket(0, 1, 1));
  assert.deepEqual(actual.leave, bucket(0, 2, 2));
});

test('unknown and missing codes are distinguished from known off days', () => {
  const actual = summary({ code: 'O' }, { code: '-' }, { code: null }, { code: 'UNKNOWN' });
  assert.equal(actual.unclassifiedShifts, 2);
  assert.deepEqual(actual.total, bucket(0, 0));
  assert.deepEqual(actual.absence, bucket(0, 0));
});
