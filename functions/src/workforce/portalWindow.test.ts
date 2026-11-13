import test from 'node:test';
import assert from 'node:assert/strict';
import {caregiverWindow} from './portalWindow.js';
test('caregiver preview closes exactly at expiry and opens only at the launch boundary',()=>{
 const until='2026-11-12T04:00:00.000Z',launch='2027-01-01T06:00:00.000Z';
 assert.equal(caregiverWindow(until,launch,Date.parse(until)-1).open,true);
 assert.equal(caregiverWindow(until,launch,Date.parse(until)).open,false);
 assert.equal(caregiverWindow(until,launch,Date.parse(launch)-1).open,false);
 assert.equal(caregiverWindow(until,launch,Date.parse(launch)).open,true);
});
test('malformed or partially configured windows fail closed; absent windows retain release gates',()=>{
 for(const args of [['bad','2027-01-01'],['','2027-01-01'],['2027-02-01','2027-01-01']])assert.equal(caregiverWindow(args[0]!,args[1]!).open,false);
 assert.deepEqual(caregiverWindow('',''),{configured:false,open:true});
});
