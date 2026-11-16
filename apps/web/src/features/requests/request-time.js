const bangkokDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', dateStyle: 'short' });
const lifetime = 24 * 60 * 60 * 1000;

export function canSubmitRequestDate(workDate, now = Date.now()) {
  const today = bangkokDate.format(new Date(now));
  return workDate >= today && workDate.slice(0, 7) === today.slice(0, 7);
}

export function requestClosureStatus(submittedAt, now) {
  const [year, month] = bangkokDate.format(new Date(submittedAt)).split('-').map(Number);
  const monthEnd = Date.UTC(year, month, 1) - 7 * 60 * 60 * 1000;
  const expiry = submittedAt + lifetime;
  if (now < Math.min(monthEnd, expiry)) return '';
  return monthEnd <= expiry ? 'ตารางเดือนปิดแล้ว' : 'หมดอายุ';
}
