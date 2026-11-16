import { ConflictException } from '@nestjs/common';

const HOUR_MS = 3_600_000;
const LIFETIME_MS = 24 * HOUR_MS;
const bangkokDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', dateStyle: 'short' });
export const bangkokWorkDate = (date: Date) => bangkokDate.format(date);

type RequestKind = 'swap' | 'leave' | 'ot';

export function requireOpenSubmission(workDate: string, submittedAt: Date, kind: RequestKind = 'swap') {
  const today = bangkokWorkDate(submittedAt);
  const label = kind === 'leave' ? 'ลา' : kind === 'ot' ? 'ทำงานล่วงเวลา' : 'สลับกะ';
  const prefix = kind.toUpperCase();
  if (workDate < today) {
    throw new ConflictException({ code: `${prefix}_SUBMISSION_LATE`, message: `ไม่สามารถยื่นคำขอ${label}ย้อนหลังได้` });
  }
  if (workDate.slice(0, 7) !== today.slice(0, 7)) {
    throw new ConflictException({ code: `${prefix}_OUTSIDE_MONTH`, message: `ยื่นคำขอ${label}ได้เฉพาะตารางของเดือนนี้` });
  }
}

function approvalWindow(month: string, submittedAt: Date) {
  const [year, monthNumber] = month.split('-').map(Number);
  // Date.UTC uses zero-based months. Passing monthNumber yields the first of
  // the next month, then UTC+07:00 converts Thai midnight to its UTC instant.
  const monthEnd = Date.UTC(year, monthNumber, 1) - 7 * HOUR_MS;
  return { monthEnd, expiry: submittedAt.getTime() + LIFETIME_MS };
}

export function requestApprovalDeadline(month: string, submittedAt: Date) {
  const { monthEnd, expiry } = approvalWindow(month, submittedAt);
  return new Date(Math.min(monthEnd, expiry));
}

export function pendingRequestClosure(month: string, submittedAt: Date, checkedAt: Date, kind: RequestKind = 'swap') {
  const { monthEnd, expiry } = approvalWindow(month, submittedAt);
  if (checkedAt.getTime() < Math.min(monthEnd, expiry)) return null;
  return monthEnd <= expiry
    ? { status: 'MONTH_CLOSED', code: `${kind.toUpperCase()}_MONTH_CLOSED`, message: 'ตารางเดือนนี้ปิดแล้ว' }
    : { status: 'EXPIRED', code: 'REQUEST_EXPIRED', message: 'คำขอหมดอายุหลังครบ 24 ชั่วโมง' };
}

export function requireOpenApproval(month: string | null, submittedAt: Date, checkedAt: Date, kind: RequestKind = 'swap') {
  if (!month) return;
  const closure = pendingRequestClosure(month, submittedAt, checkedAt, kind);
  if (closure) throw new ConflictException({ code: closure.code, message: closure.message });
}
