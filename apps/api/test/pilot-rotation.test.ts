import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PILOT_ROSTER_START, pilotShiftCode } from '../seeds/pilot-rotation';

test('pilot follows the August reference and repeats across month boundaries', () => {
  const teams = ['A', 'B', 'C', 'D'];
  const codesFor = (date: string) => teams.map(team => pilotShiftCode(team, date)).join('');
  const august = ['ONOM', 'MONO', 'MONO', 'OMON', 'OMON', 'NOMO', 'NOMO', 'ONOM'];
  assert.equal(PILOT_ROSTER_START, '2026-08-01');
  const start = Date.parse(PILOT_ROSTER_START);
  const end = Date.parse('2026-12-01');
  for (let index = 0; start + index * 86_400_000 < end; index++) {
    const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
    assert.equal(codesFor(date), august[index % august.length], date);
  }
  assert.equal(codesFor('2026-07-31'), 'ONOM');
  assert.equal(codesFor('2026-11-15'), 'MONO');
  assert.equal(codesFor('2026-11-20'), 'ONOM');
});
