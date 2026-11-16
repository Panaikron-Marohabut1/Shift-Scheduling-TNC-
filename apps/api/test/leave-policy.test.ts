import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leaveApprovalPlan, leaveCoverCode, leaveReason, leaveShiftStart } from '../src/requests/leave-policy';
import { pendingRequestClosure, requestApprovalDeadline } from '../src/requests/request-time';

test('employee leave routes to the supervisors of the affected teams', () => {
  assert.deepEqual(leaveApprovalPlan('EMPLOYEE', 1), [{ role: 'SUPERVISOR', teamId: 1 }]);
  assert.deepEqual(leaveApprovalPlan('EMPLOYEE', 1, 2), [
    { role: 'SUPERVISOR', teamId: 1 }, { role: 'SUPERVISOR', teamId: 2 },
  ]);
});

test('supervisor leave routes to a single Manager with or without cover', () => {
  assert.deepEqual(leaveApprovalPlan('SUPERVISOR', 1), [{ role: 'MANAGER' }]);
  assert.deepEqual(leaveApprovalPlan('SUPERVISOR', 1, 2), [{ role: 'MANAGER' }]);
});

test('cover takes the requested morning or night shift as OT and must be off', () => {
  const applicant = { role: 'EMPLOYEE', teamId: 1, shiftCode: 'M' } as const;
  const cover = { role: 'EMPLOYEE', teamId: 2, shiftCode: 'O' } as const;
  assert.equal(leaveCoverCode(applicant, cover), 'MT');
  assert.equal(leaveCoverCode({ ...applicant, shiftCode: 'N' }, cover), 'NT');
  assert.equal(leaveCoverCode(applicant, { ...cover, teamId: 1 }), null);
  assert.equal(leaveCoverCode(applicant, { ...cover, role: 'SUPERVISOR' }), null);
  assert.equal(leaveCoverCode(applicant, { ...cover, shiftCode: 'N' }), null);
});

test('all leave requests require a reason with visible text', () => {
  assert.equal(leaveReason('  ลากิจส่วนตัว  '), 'ลากิจส่วนตัว');
  assert.equal(leaveReason(' \t\n '), null);
  assert.equal(leaveReason(undefined), null);
});

test('leave and swap share the same cutoff at 24 elapsed hours or Bangkok month end', () => {
  const submitted = new Date('2026-11-19T18:00:00+07:00');
  const morning = leaveShiftStart('2026-11-20','07:30:00')!;
  assert.equal(pendingRequestClosure('2026-11',submitted,morning,'leave'),null);
  const deadline = requestApprovalDeadline('2026-11',submitted);
  assert.equal(deadline.toISOString(),'2026-11-20T11:00:00.000Z');
  for(const kind of ['swap','leave'] as const) {
    assert.equal(pendingRequestClosure('2026-11',submitted,new Date(deadline.getTime()-1),kind),null);
    assert.equal(pendingRequestClosure('2026-11',submitted,deadline,kind)?.status,'EXPIRED');
    const lastDay=new Date('2026-11-30T18:00:00+07:00');
    const monthEnd=requestApprovalDeadline('2026-11',lastDay);
    assert.equal(monthEnd.toISOString(),'2026-11-30T17:00:00.000Z');
    assert.equal(pendingRequestClosure('2026-11',lastDay,monthEnd,kind)?.status,'MONTH_CLOSED');
  }
});
