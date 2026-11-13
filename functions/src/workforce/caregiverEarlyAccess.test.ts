import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedEarlyAccess} from './caregiverEarlyAccess.js';
const now=Date.parse('2026-11-12T18:00:00Z'),user={uid:'owner-uid',email:'owner@example.invalid',emailVerified:true,disabled:false};
const grant={uid:user.uid,email:user.email,enabled:true,expiresAt:'2027-01-01T06:00:00Z',phoneNumber:'+15555550123'};
test('personal exception requires the exact verified enabled UID and email and expires at launch',()=>{
 assert.deepEqual(approvedEarlyAccess(user.uid,user,grant,now),{phoneNumber:grant.phoneNumber});
 for(const u of [{...user,uid:'other'},{...user,email:'other@example.invalid'},{...user,emailVerified:false},{...user,disabled:true}])assert.equal(approvedEarlyAccess(user.uid,u,grant,now),null);
 for(const g of [undefined,{...grant,enabled:false},{...grant,uid:'other'},{...grant,expiresAt:'invalid'},{...grant,email:undefined}])assert.equal(approvedEarlyAccess(user.uid,user,g as any,now),null);
 assert.equal(approvedEarlyAccess(user.uid,user,grant,Date.parse(grant.expiresAt)),null);
});
test('a matching phone number alone does not authorize a separate account',()=>{
 assert.equal(approvedEarlyAccess('phone-only',{...user,uid:'phone-only',email:undefined} as any,grant,now),null);
});
