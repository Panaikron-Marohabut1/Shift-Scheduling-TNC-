import { ConflictException } from '@nestjs/common';

const HOUR_MS = 3_600_000;
const LIFETIME_MS = 24 * HOUR_MS;
const bangkokDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', dateStyle: 'short' });
export const bangkokWorkDate = (date: Date) => bangkokDate.format(date);

export function requireOpenSubmission(workDate: string, submittedAt: Date) {
  const today = bangkokWorkDate(submittedAt);
  if (workDate < today) {
    throw new ConflictException({ code: 'SWAP_SUBMISSION_LATE', message: 'ไม่สามารถยื่นคำขอสลับกะย้อนหลังได้' });
  }
  if (workDate.slice(0, 7) !== today.slice(0, 7)) {
    throw new ConflictException({ code: 'SWAP_OUTSIDE_MONTH', message: 'ยื่นคำขอสลับกะได้เฉพาะตารางของเดือนนี้' });
  }
}

export function pendingSwapClosure(month: string, submittedAt: Date, checkedAt: Date) {
  const [year, monthNumber] = month.split('-').map(Number);
  // Date.UTC uses zero-based months. Passing monthNumber yields the first of
  // the next month, then UTC+07:00 converts Thai midnight to its UTC instant.
  const monthEnd = Date.UTC(year, monthNumber, 1) - 7 * HOUR_MS;
  const expiry = submittedAt.getTime() + LIFETIME_MS;
  if (checkedAt.getTime() < Math.min(monthEnd, expiry)) return null;
  return monthEnd <= expiry
    ? { status: 'MONTH_CLOSED', code: 'SWAP_MONTH_CLOSED', message: 'ตารางเดือนนี้ปิดแล้ว' }
    : { status: 'EXPIRED', code: 'REQUEST_EXPIRED', message: 'คำขอหมดอายุหลังครบ 24 ชั่วโมง' };
}

export function requireOpenSwap(month: string | null, submittedAt: Date, checkedAt: Date) {
  if (!month) return;
  const closure = pendingSwapClosure(month, submittedAt, checkedAt);
  if (closure) throw new ConflictException({ code: closure.code, message: closure.message });
}
