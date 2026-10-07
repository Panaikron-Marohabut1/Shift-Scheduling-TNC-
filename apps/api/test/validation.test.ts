import { test } from 'node:test';
import assert from 'node:assert/strict';
import { longestWorkingRun } from '../src/validation/validation.service';
test('consecutive working days cross month and year boundaries',()=>{
 const dates=['2026-12-26','2026-12-27','2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01'];
 assert.equal(longestWorkingRun(dates.map(work_date=>({work_date,is_working:true}))),7);
 assert.equal(longestWorkingRun(dates.map((work_date,i)=>({work_date,is_working:i!==3}))),3);
});
test('missing days do not fabricate a consecutive run',()=>{
 assert.equal(longestWorkingRun([{work_date:'2026-10-01',is_working:true},{work_date:'2026-10-03',is_working:true}]),1);
});
