import test from 'node:test';
import assert from 'node:assert/strict';
import {monthlyDueDate,reportingPeriods,reportingWindows,compareMeasurements} from '../src/lib/report-schedule.ts';
test('monthly anniversary uses calendar months and clamps 31st',()=>{
 assert.equal(monthlyDueDate('2026-01-31',1),'2026-02-28');
 assert.equal(monthlyDueDate('2026-01-31',2),'2026-03-31');
 assert.equal(monthlyDueDate('2028-01-31',1),'2028-02-29');
});
test('only past due reports are pending; first request after one month',()=>{
 assert.deepEqual(reportingPeriods('2026-11-13','2026-12-12'),[]);
 assert.deepEqual(reportingPeriods('2026-11-13','2026-12-13'),[
  {dueOn:'2026-12-13',periodStart:'2026-11-13'}]);
});
test('comparison uses initial and latest only; missing metrics do not imply zero',()=>{
 assert.deepEqual(compareMeasurements({weightKg:98,waistCm:105,muscleMassKg:null},
  {weightKg:95,waistCm:99,muscleMassKg:38},['weightKg','waistCm','muscleMassKg']),
 {weightKg:-3,waistCm:-6,muscleMassKg:null});
});

test('late report belongs to its own monthly cycle, never two cycles',()=>{
 const december=reportingWindows('2026-11-13','2026-12-18');
 assert.equal(december[0].dueOn,'2026-12-13');
 assert.equal(december[0].reportStartInclusive,'2026-11-28');
 assert.equal(december[0].reportEndExclusive,'2026-12-28');
 const two=reportingWindows('2026-11-13','2027-01-14');
 assert.equal(two[1].reportStartInclusive,december[0].reportEndExclusive);
 assert.equal(two[1].dueOn,'2027-01-13');
});
