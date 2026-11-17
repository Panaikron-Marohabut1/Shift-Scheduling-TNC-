import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allocateHolidayOvertime, isHolidayReplacementDate, resolveHolidayOvertime } from '../src/shared/holiday-roster-rules';

test('a scheduled morning or night shift earns overtime on the holiday itself', () => {
  const roster = [
    { workDate: '2026-12-30', shiftCode: 'N' },
    { workDate: '2026-12-31', shiftCode: 'M' },
  ];
  assert.deepEqual(resolveHolidayOvertime('2026-12-31', roster), {
    workDate: '2026-12-31', baseShiftCode: 'M', overtimeShiftCode: 'MT',
  });
  assert.deepEqual(resolveHolidayOvertime('2026-12-30', roster), {
    workDate: '2026-12-30', baseShiftCode: 'N', overtimeShiftCode: 'NT',
  });
});

test('an off day holiday chooses the first work day afterwards even when the roster is unsorted', () => {
  const roster = Object.freeze([
    { workDate: '2026-12-22', shiftCode: 'M' },
    { workDate: '2026-12-12', shiftCode: 'N' },
    { workDate: '2026-12-09', shiftCode: 'M' },
    { workDate: '2026-12-10', shiftCode: 'O' },
    { workDate: '2026-12-11', shiftCode: 'O' },
  ]);
  assert.deepEqual(resolveHolidayOvertime('2026-12-10', roster), {
    workDate: '2026-12-12', baseShiftCode: 'N', overtimeShiftCode: 'NT',
  });
});

test('an off day holiday with no upcoming work in its month uses the latest earlier shift', () => {
  const roster = [
    { workDate: '2027-01-01', shiftCode: 'M' },
    { workDate: '2026-12-29', shiftCode: 'M' },
    { workDate: '2026-12-28', shiftCode: 'N' },
    { workDate: '2026-12-31', shiftCode: 'O' },
    { workDate: '2026-12-30', shiftCode: 'O' },
  ];
  assert.deepEqual(resolveHolidayOvertime('2026-12-31', roster), {
    workDate: '2026-12-29', baseShiftCode: 'M', overtimeShiftCode: 'MT',
  });
});

test('an off day holiday at the start of the month does not pick a shift from the prior month', () => {
  const roster = [
    { workDate: '2026-11-30', shiftCode: 'N' },
    { workDate: '2026-12-01', shiftCode: 'O' },
    { workDate: '2026-12-02', shiftCode: 'M' },
  ];
  assert.deepEqual(resolveHolidayOvertime('2026-12-01', roster), {
    workDate: '2026-12-02', baseShiftCode: 'M', overtimeShiftCode: 'MT',
  });
  assert.equal(resolveHolidayOvertime('2026-12-01', roster.slice(0, 2)), null);
});

test('absent or unsupported holiday shifts and invalid dates do not generate overtime', () => {
  const roster = [
    { workDate: '2026-11-03', shiftCode: 'MT' },
    { workDate: '2026-11-04', shiftCode: 'M' },
    { workDate: '2026-11-31', shiftCode: 'M' },
  ];
  assert.equal(resolveHolidayOvertime('2026-11-02', roster), null);
  assert.equal(resolveHolidayOvertime('2026-11-03', roster), null);
  assert.equal(resolveHolidayOvertime('2026-11-31', roster), null);
});

test('a replacement day is a different valid date within seven calendar days of the holiday and in the same month', () => {
  assert.equal(isHolidayReplacementDate('2026-12-10', '2026-12-03'), true);
  assert.equal(isHolidayReplacementDate('2026-12-10', '2026-12-17'), true);
  assert.equal(isHolidayReplacementDate('2026-12-10', '2026-12-02'), false);
  assert.equal(isHolidayReplacementDate('2026-12-10', '2026-12-18'), false);
  assert.equal(isHolidayReplacementDate('2026-12-10', '2026-12-10'), false);
  assert.equal(isHolidayReplacementDate('2026-12-31', '2027-01-01'), false);
  assert.equal(isHolidayReplacementDate('2026-12-01', '2026-11-30'), false);
  assert.equal(isHolidayReplacementDate('2024-02-22', '2024-02-29'), true);
  assert.equal(isHolidayReplacementDate('2026-02-22', '2026-02-29'), false);
  assert.equal(isHolidayReplacementDate('2026-12-10', '2026-12-17T00:00:00Z'), false);
});

test('consecutive off day holidays allocate separate upcoming work days in calendar order', () => {
  const roster = [
    { workDate: '2026-04-16', shiftCode: 'M' },
    { workDate: '2026-04-15', shiftCode: 'M' },
    { workDate: '2026-04-14', shiftCode: 'O' },
    { workDate: '2026-04-13', shiftCode: 'O' },
  ];
  assert.deepEqual(allocateHolidayOvertime(['2026-04-14', '2026-04-13'], roster), [
    { holidayDate: '2026-04-13', workDate: '2026-04-15', baseShiftCode: 'M', overtimeShiftCode: 'MT' },
    { holidayDate: '2026-04-14', workDate: '2026-04-16', baseShiftCode: 'M', overtimeShiftCode: 'MT' },
  ]);
});

test('working holidays reserve their own dates before off day holidays allocate available shifts', () => {
  const roster = [
    { workDate: '2026-12-28', shiftCode: 'M' },
    { workDate: '2026-12-29', shiftCode: 'O' },
    { workDate: '2026-12-30', shiftCode: 'N' },
    { workDate: '2026-12-31', shiftCode: 'O' },
    { workDate: '2027-01-01', shiftCode: 'N' },
  ];
  assert.deepEqual(allocateHolidayOvertime(['2026-12-29', '2026-12-30', '2026-12-31'], roster), [
    { holidayDate: '2026-12-29', workDate: '2026-12-28', baseShiftCode: 'M', overtimeShiftCode: 'MT' },
    { holidayDate: '2026-12-30', workDate: '2026-12-30', baseShiftCode: 'N', overtimeShiftCode: 'NT' },
  ]);
});

test('month-end fallback allocates the distinct nearest unreserved shifts before the holidays', () => {
  const roster = [
    { workDate: '2026-12-28', shiftCode: 'M' },
    { workDate: '2026-12-29', shiftCode: 'N' },
    { workDate: '2026-12-30', shiftCode: 'O' },
    { workDate: '2026-12-31', shiftCode: 'O' },
  ];
  assert.deepEqual(allocateHolidayOvertime(['2026-12-31', '2026-12-30', '2026-12-31'], roster), [
    { holidayDate: '2026-12-30', workDate: '2026-12-29', baseShiftCode: 'N', overtimeShiftCode: 'NT' },
    { holidayDate: '2026-12-31', workDate: '2026-12-28', baseShiftCode: 'M', overtimeShiftCode: 'MT' },
  ]);
});
