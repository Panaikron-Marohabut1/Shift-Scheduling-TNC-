import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PoolClient } from 'pg';
import type { Actor, Assignment } from '../src/shared/types';
import { ValidationService } from '../src/validation/validation.service';

const validation = new ValidationService();
const actor = { employeeId: 1 } as Actor;

function assignment(id: number, employeeId: number, date: string, code: 'M' | 'N' | 'O'): Assignment {
  const start = { M: '07:30:00', N: '19:30:00', O: null };
  const end = { M: '19:30:00', N: '07:30:00', O: null };
  return {
    assignment_id: id, employee_id: employeeId, team_id: employeeId,
    team_code: employeeId === 1 ? 'A' : 'B', name: `Employee ${employeeId}`,
    work_date: date, shift_code: code, shift_name: code, shift_type_id: { M: 1, N: 2, O: 3 }[code],
    position: 'FIELD_OPERATOR', status: 'ACTIVE', start_time: start[code],
    end_time: end[code], is_working: code !== 'O', schedule_id: 1, version: 1,
  };
}

function roster(...assignments: Assignment[]) {
  return {
    query: async (_sql: string, [employeeId]: [number]) => ({
      rows: assignments.filter(slot => slot.employee_id === employeeId),
    }),
  } as PoolClient;
}

test('swap preview and approval reject back-to-back shifts for either participant across month end', async () => {
  const overnight = assignment(1, 2, '2026-11-30', 'N');
  const morning = assignment(2, 1, '2026-12-01', 'M');
  const off = assignment(3, 2, '2026-12-01', 'O');

  for (const submission of [true, false]) {
    const result = await validation.check(roster(overnight, morning, off), actor, morning, off, submission);
    assert.equal(result.valid, false);
    assert.equal(result.checks.some(check => check.rule.startsWith('NO_OVERLAP_')), false);
    const rest = result.checks.find(check => check.rule === 'MIN_SHIFT_REST_2');
    assert.equal(rest?.status, 'FAIL');
    assert.equal(rest?.participant, 'partner');
    assert.match(rest?.message ?? '', /0 ชั่วโมง/);
  }

  const reverse = await validation.check(roster(overnight, morning, off), { ...actor, employeeId: 2 }, off, morning);
  assert.equal(reverse.valid, false);
  assert.equal(reverse.checks.find(check => check.rule === 'MIN_SHIFT_REST_2')?.participant, 'requester');
});

test('overlapping shifts fail under the same rest rule', async () => {
  const overnight = assignment(1, 2, '2026-11-30', 'N');
  const morning = { ...assignment(2, 1, '2026-12-01', 'M'), start_time: '07:00:00' };
  const off = assignment(3, 2, '2026-12-01', 'O');

  const result = await validation.check(roster(overnight, morning, off), actor, morning, off);
  assert.equal(result.valid, false);
  const failures = result.checks.filter(check => check.status === 'FAIL');
  assert.deepEqual(failures.map(check => check.rule), ['MIN_SHIFT_REST_2']);
  assert.match(failures[0].message, /ช่วงเวลาทำงานซ้อนกัน.*07:30.*07:00/);
});

test('the shared roster check accepts exactly one full shift of rest and rejects one minute less', async () => {
  const overnight = assignment(1, 1, '2026-11-30', 'N');
  const off = assignment(2, 1, '2026-12-01', 'O');
  const night = assignment(2, 1, off.work_date, 'N');
  const client = roster(overnight, off);

  assert.equal(await validation.rosterConflict(client, [night]), null);
  assert.match(await validation.rosterConflict(client, [{ ...night, start_time: '19:29:00' }]) ?? '', /11 ชั่วโมง 59 นาที/);
  assert.match(await validation.rosterConflict(client, [{ ...night, start_time: '07:29:00', end_time: '19:29:00' }]) ?? '', /ช่วงเวลาทำงานซ้อนกัน/);
});

test('a replacement does not turn an unrelated existing short rest into a new request violation', async () => {
  const overnight = assignment(1, 1, '2026-11-28', 'N');
  const morning = assignment(2, 1, '2026-11-29', 'M');
  const off = assignment(3, 1, '2026-12-01', 'O');
  const replacement = assignment(3, 1, off.work_date, 'M');

  assert.equal(await validation.rosterConflict(roster(overnight, morning, off), [replacement]), null);
});

test('swap shows the before and after run for both employees and counts work on either side of the changed day', async () => {
  const workBefore = ['2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30']
    .map((date, index) => assignment(index + 1, 1, date, 'M'));
  const requester = assignment(5, 1, '2026-12-01', 'O');
  const partner = assignment(6, 2, '2026-12-01', 'M');
  const next = assignment(7, 1, '2026-12-02', 'M');
  const rows = [...workBefore, requester, partner, next];

  const pass = await validation.check(roster(...rows), actor, requester, partner);
  assert.equal(pass.valid, true);
  const run = pass.checks.find(check => check.rule === 'MAX_SIX_DAYS_1');
  assert.match(run?.message ?? '', /ก่อนสลับ 4\/6 วัน.*27.*30.*หลังสลับ 6\/6 วัน.*27.*2 ธ\.ค\..*3 ธ\.ค\..*ต้องหยุด/);
  assert.match(pass.checks.find(check => check.rule === 'MAX_SIX_DAYS_2')?.message ?? '', /ก่อนสลับ 1\/6 วัน.*หลังสลับ 0\/6 วัน/);

  const fail = await validation.check(roster(...rows, assignment(8, 1, '2026-12-03', 'M')), actor, requester, partner);
  assert.equal(fail.valid, false);
  const failure = fail.checks.find(check => check.rule === 'MAX_SIX_DAYS_1');
  assert.equal(failure?.status, 'FAIL');
  assert.match(failure?.message ?? '', /หลังสลับ 7\/6 วัน.*เกิน 6 วันติด/);
});
