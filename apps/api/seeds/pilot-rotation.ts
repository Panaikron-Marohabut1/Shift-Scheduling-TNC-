export const SHIFT_ROTATION = ['M', 'M', 'O', 'O', 'N', 'N', 'O', 'O'] as const;
export const PILOT_ROSTER_START = '2026-08-01';

// August 1 continues the previous day's night shift for B and morning for D.
// A and C take over August 2–3, then B and D return on August 4–5.
const teamOffsets = new Map([['A', 7], ['B', 5], ['C', 3], ['D', 1]]);
const dayMs = 86_400_000;
const anchor = Date.parse(PILOT_ROSTER_START);

export function pilotShiftCode(teamCode: string, workDate: string) {
  const offset = teamOffsets.get(teamCode);
  const day = (Date.parse(workDate) - anchor) / dayMs;
  if (offset === undefined || !Number.isInteger(day)) throw new Error('Expected a pilot team and calendar date.');
  const length = SHIFT_ROTATION.length;
  return SHIFT_ROTATION[((day + offset) % length + length) % length];
}
