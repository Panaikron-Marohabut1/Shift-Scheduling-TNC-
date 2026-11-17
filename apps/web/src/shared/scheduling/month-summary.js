const emptyBucket = () => ({ minutes: 0, shifts: 0, unquantifiedShifts: 0 });
const dayMinutes = 24 * 60;
const microsPerMinute = 60_000_000;
const microsPerDay = dayMinutes * microsPerMinute;

function shiftCodePair(code) {
  const parts = String(code ?? '').split('/');
  // A swap stores the effective shift first. A multi-step adjustment is chronological.
  return parts.length > 2 ? [parts.at(-1), parts.at(-2)] : parts;
}

function clockMicros(value) {
  const clock = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?$/.exec(value);
  if (!clock) return null;
  const [, rawHour, rawMinute, rawSecond = '0', fraction = ''] = clock;
  const hour = Number(rawHour), minute = Number(rawMinute), second = Number(rawSecond);
  const microseconds = Number(fraction.padEnd(6, '0'));
  if (minute >= 60 || second >= 60 || hour > 24 || (hour === 24 && (minute || second || microseconds))) return null;
  return (hour * 3600 + minute * 60 + second) * 1_000_000 + microseconds;
}

function duration(start, end) {
  const from = clockMicros(start);
  const to = clockMicros(end);
  if (from === null || to === null) return null;
  const difference = (to - from + microsPerDay) % microsPerDay;
  return difference && difference % microsPerMinute === 0 ? difference / microsPerMinute : null;
}

function definedDuration(definition) {
  // Take only the planned work window; descriptions can include handover and pay rates.
  const hours = /^(\d{2}:\d{2})–(\d{2}:\d{2})(?=\s|$)/.exec(definition?.time);
  return hours ? duration(hours[1], hours[2]) : null;
}

function record(bucket, minutes, shifts = 1) {
  bucket.shifts += shifts;
  if (minutes === null) bucket.unquantifiedShifts += shifts;
  else bucket.minutes += minutes;
}

/** Summarize slots of one month by shift start date. Leave and absence do not add to work. */
export function summarizeMonth(days, shiftDefs) {
  const result = {
    regular: emptyBucket(),
    overtime: emptyBucket(),
    holidayOvertime: emptyBucket(),
    leave: emptyBucket(),
    absence: emptyBucket(),
    total: emptyBucket(),
    unclassifiedShifts: 0,
  };
  for (const day of days) {
    const [code, priorCode] = shiftCodePair(day.code);
    if (code === 'O' || code === '-') continue;

    const definition = Object.hasOwn(shiftDefs, code) ? shiftDefs[code] : null;
    if (!definition || definition.family === 'swap') {
      result.unclassifiedShifts += 1;
      continue;
    }
    if (definition.family === 'O') continue;
    if (definition.leave) {
      const fraction = definition.half ? 0.5 : 1;
      if (day.leaveMinutes != null) {
        const valid = Number.isInteger(day.leaveMinutes) && day.leaveMinutes > 0 && day.leaveMinutes < dayMinutes;
        record(result.leave, valid ? day.leaveMinutes : null, fraction);
        continue;
      }
      const [baseCode] = shiftCodePair(day.baseCode ?? priorCode);
      const baseMinutes = day.baseStartTime == null && day.baseEndTime == null
        ? definedDuration(shiftDefs[baseCode])
        : duration(day.baseStartTime, day.baseEndTime);
      record(result.leave, baseMinutes === null ? null : baseMinutes * fraction, fraction);
      continue;
    }

    const { startTime, endTime } = day;
    const minutes = startTime == null && endTime == null
      ? definedDuration(definition)
      : duration(startTime, endTime);
    if (day.absence) {
      record(result.absence, minutes);
      continue;
    }

    const category = day.holidayOvertime ? 'holidayOvertime' : definition.ot ? 'overtime' : 'regular';
    record(result[category], minutes);
    record(result.total, minutes);
  }
  return result;
}
