type RosterDay = { workDate: string; shiftCode: string };
type WorkingShiftCode = 'M' | 'N';
type WorkingDay = { workDate: string; shiftCode: WorkingShiftCode };

const dayMs = 86_400_000;
const overtimeCode = { M: 'MT', N: 'NT' } as const;

function calendarDay(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
    ? timestamp / dayMs
    : NaN;
}

function holidayOvertime({ workDate, shiftCode }: WorkingDay) {
  return { workDate, baseShiftCode: shiftCode, overtimeShiftCode: overtimeCode[shiftCode] };
}

function findWorkDay(holidayDate: string, roster: readonly RosterDay[], reserved?: ReadonlySet<string>) {
  const month = holidayDate.slice(0, 7);
  let next: WorkingDay | undefined;
  let previous: WorkingDay | undefined;
  for (const { workDate, shiftCode } of roster) {
    if (shiftCode !== 'M' && shiftCode !== 'N') continue;
    if (workDate.slice(0, 7) !== month || reserved?.has(workDate) || !Number.isFinite(calendarDay(workDate))) continue;
    if (workDate > holidayDate && (!next || workDate < next.workDate)) next = { workDate, shiftCode };
    if (workDate < holidayDate && (!previous || workDate > previous.workDate)) previous = { workDate, shiftCode };
  }
  return next ?? previous;
}

export function resolveHolidayOvertime(holidayDate: string, roster: readonly RosterDay[]) {
  if (!Number.isFinite(calendarDay(holidayDate))) return null;
  const holidayCode = roster.find(day => day.workDate === holidayDate)?.shiftCode;
  if (holidayCode === 'M' || holidayCode === 'N') {
    return holidayOvertime({ workDate: holidayDate, shiftCode: holidayCode });
  }
  if (holidayCode !== 'O' && holidayCode !== '-') return null;
  const workDay = findWorkDay(holidayDate, roster);
  return workDay ? holidayOvertime(workDay) : null;
}

// Allocate the full holiday calendar before using entitlement status to filter results.
export function allocateHolidayOvertime(holidayDates: readonly string[], roster: readonly RosterDay[], reservedWorkDates: readonly string[] = []) {
  const dates = [...new Set(holidayDates)].filter(date => Number.isFinite(calendarDay(date))).sort();
  const reserved = new Set(reservedWorkDates);
  const allocations = new Map<string, WorkingDay>();
  const offDates: string[] = [];

  for (const holidayDate of dates) {
    const holidayCode = roster.find(day => day.workDate === holidayDate)?.shiftCode;
    if (holidayCode === 'M' || holidayCode === 'N') {
      if (reserved.has(holidayDate)) continue;
      reserved.add(holidayDate);
      allocations.set(holidayDate, { workDate: holidayDate, shiftCode: holidayCode });
    } else if (holidayCode === 'O' || holidayCode === '-') {
      offDates.push(holidayDate);
    }
  }

  for (const holidayDate of offDates) {
    const workDay = findWorkDay(holidayDate, roster, reserved);
    if (!workDay) continue;
    reserved.add(workDay.workDate);
    allocations.set(holidayDate, workDay);
  }

  return dates.flatMap(holidayDate => {
    const workDay = allocations.get(holidayDate);
    return workDay ? [{ holidayDate, ...holidayOvertime(workDay) }] : [];
  });
}

export function isHolidayReplacementDate(holidayDate: string, replacementDate: string) {
  const daysApart = Math.abs(calendarDay(replacementDate) - calendarDay(holidayDate));
  return holidayDate.slice(0, 7) === replacementDate.slice(0, 7) && daysApart >= 1 && daysApart <= 7;
}
