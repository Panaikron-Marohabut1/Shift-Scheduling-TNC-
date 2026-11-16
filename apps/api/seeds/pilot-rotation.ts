import rotation from '../../web/src/shared/scheduling/rotation.json';

export const SHIFT_ROTATION = rotation.cycle;
export const PILOT_ROSTER_START = rotation.anchor;
const teamOffsets = new Map(Object.entries(rotation.offsets));
const dayMs = 86_400_000;
const anchor = Date.parse(PILOT_ROSTER_START);

export function pilotShiftCode(teamCode: string, workDate: string) {
  const offset = teamOffsets.get(teamCode);
  const day = (Date.parse(workDate) - anchor) / dayMs;
  if (offset === undefined || !Number.isInteger(day)) throw new Error('Expected a pilot team and calendar date.');
  const length = SHIFT_ROTATION.length;
  return SHIFT_ROTATION[((day + offset) % length + length) % length];
}
