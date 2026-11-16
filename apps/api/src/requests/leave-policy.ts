type LeaveRole = 'EMPLOYEE' | 'SUPERVISOR';
type LeaveAssignment = { role: LeaveRole; teamId: number; shiftCode: string };
type LeaveApprover = { role: 'MANAGER' } | { role: 'SUPERVISOR'; teamId: number };

export function leaveShiftStart(workDate: string, startTime: string | null): Date | null {
  if (!startTime || !/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !/^\d{2}:\d{2}(?::\d{2})?$/.test(startTime)) return null;
  const start = new Date(`${workDate}T${startTime}+07:00`);
  return Number.isFinite(start.getTime()) ? start : null;
}

// The returned entries are required approvers. Their order is not a decision sequence.
export function leaveApprovalPlan(role: LeaveRole, teamId: number, coverTeamId?: number): LeaveApprover[] {
  if (role === 'SUPERVISOR') return [{ role: 'MANAGER' }];
  const teams = new Set(coverTeamId === undefined ? [teamId] : [teamId, coverTeamId]);
  return Array.from(teams, id => ({ role: 'SUPERVISOR', teamId: id }));
}

export function leaveCoverCode(applicant: LeaveAssignment, cover: LeaveAssignment): 'MT' | 'NT' | null {
  if (applicant.teamId === cover.teamId || applicant.role !== cover.role || cover.shiftCode !== 'O') return null;
  if (applicant.shiftCode === 'M') return 'MT';
  if (applicant.shiftCode === 'N') return 'NT';
  return null;
}

export function leaveReason(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null;
}
