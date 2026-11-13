import test from 'node:test';
import assert from 'node:assert/strict';
import {isAdult} from './age.js';
import {saveIntake,submitIntake} from './intake.js';
test('minimum age uses the eighteenth birthday in Chicago, including midnight and leap dates',()=>{
 const at='2026-11-12T04:00:00Z';
 assert.equal(isAdult('2008-11-11',at),true);assert.equal(isAdult('2008-11-12',at),false);
 assert.equal(isAdult('2008-11-12','2026-11-12T06:00:00Z'),true);
 assert.equal(isAdult('2008-02-29','2026-02-28T18:00:00Z'),false);
 assert.equal(isAdult('2008-02-29','2026-03-01T18:00:00Z'),true);
 for(const invalid of ['2008-02-30','2027-01-01','','invalid','2008-1-1'])assert.equal(isAdult(invalid,at),false);
});
test('underage draft can be saved but server refuses submission',()=>{
 const now='2026-11-11T18:00:00Z',draft=saveIntake('test',null,0,{firstName:'Test',lastName:'Applicant',birthDate:'2010-01-01'},'test-office',false,now);
 assert.equal(draft.state,'draft');assert.throws(()=>submitIntake('test',draft,draft.revision,{name:'Test Applicant',electronicConsent:true,documentRead:true},now),/minimum_age_required/);
});
