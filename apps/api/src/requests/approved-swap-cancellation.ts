import { Assignment } from '../shared/types';

type SwapSlot = Pick<Assignment, 'assignment_id' | 'employee_id' | 'team_id' | 'schedule_id' | 'shift_type_id' |
  'work_date' | 'version' | 'position' | 'status' | 'is_working' | 'start_time' | 'end_time'> & { assigned_by: number };
type SwapEvidence = { source: SwapSlot; target: SwapSlot; secondSwap?: { source: SwapSlot; target: SwapSlot } };
export type AppliedSwapEvidence = { before: SwapEvidence; after: SwapEvidence & { quota?: { month: string } } };

const evidenceMissing = { code: 'SWAP_CANCELLATION_EVIDENCE_MISSING', message: 'ไม่พบข้อมูลกะก่อนและหลังอนุมัติครบ จึงคืนกะอัตโนมัติไม่ได้' };
export const cancellationConflict = { code: 'SWAP_CANCELLATION_CONFLICT', message: 'ตารางหรือข้อมูลผู้เกี่ยวข้องเปลี่ยนหลังอนุมัติ จึงคืนกะอัตโนมัติไม่ได้' };

function slots(value: SwapEvidence | undefined) {
  return value ? [value.source, value.target, ...(value.secondSwap ? [value.secondSwap.source, value.secondSwap.target] : [])] : [];
}

function isComplete(slot: SwapSlot | undefined) {
  return Boolean(slot && [slot.assignment_id, slot.employee_id, slot.schedule_id, slot.team_id, slot.shift_type_id,
    slot.version, slot.assigned_by].every(id => Number.isSafeInteger(id) && id > 0)
    && slot.status === 'ACTIVE' && typeof slot.work_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(slot.work_date)
    && typeof slot.is_working === 'boolean');
}

function sameAssignment(a: SwapSlot, b: SwapSlot) {
  return a.assignment_id === b.assignment_id && a.employee_id === b.employee_id && a.team_id === b.team_id
    && a.schedule_id === b.schedule_id && a.work_date === b.work_date && a.status === b.status && a.position === b.position;
}

export function cancellationPlan(evidence: AppliedSwapEvidence | null, quotaMonth: string, requesterId: number,
  assignmentIds: number[]) {
  const before = slots(evidence?.before);
  const after = slots(evidence?.after);
  if (evidence?.after?.quota?.month !== quotaMonth || (before.length !== 2 && before.length !== 4)
    || before.length !== after.length || before.length !== assignmentIds.length
    || new Set(assignmentIds).size !== before.length || !before.every(isComplete) || !after.every(isComplete)
    || before[0].employee_id !== requesterId) return { issue: evidenceMissing } as const;
  const changes = before.map((slot, index) => ({ before: slot, after: after[index] }));
  if (changes.some(({ before, after }, index) => {
    const partner = changes[index % 2 === 0 ? index + 1 : index - 1];
    return before.assignment_id !== assignmentIds[index] || !sameAssignment(before, after)
      || before.version + 1 !== after.version || before.shift_type_id !== partner.after.shift_type_id;
  })) return { issue: evidenceMissing } as const;

  const starts = [...before, ...after].filter(slot => slot.is_working).map(slot =>
    slot.start_time ? Date.parse(`${slot.work_date}T${slot.start_time}+07:00`) : NaN);
  if (!starts.length || starts.some(time => !Number.isFinite(time))) return { issue: evidenceMissing } as const;
  return { changes, deadline: Math.min(...starts) } as const;
}

export function cancellationDeadlineIssue(deadline: number, checkedAt: Date) {
  return checkedAt.getTime() >= deadline ? {
    code: 'SWAP_CANCELLATION_STARTED', message: 'กะแรกที่คำขอนี้กระทบเริ่มแล้ว จึงยกเลิกคำขอไม่ได้',
  } : null;
}

export function cancellationSlotsMatch(changes: readonly { before: SwapSlot; after: SwapSlot }[], current: SwapSlot[]) {
  return changes.length === current.length && changes.every(({ after }) => current.some(slot => sameAssignment(slot, after)
    && slot.version === after.version && slot.shift_type_id === after.shift_type_id && slot.assigned_by === after.assigned_by
    && slot.is_working === after.is_working && slot.start_time === after.start_time && slot.end_time === after.end_time));
}
