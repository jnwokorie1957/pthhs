import { createHmac, randomBytes } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { DocumentCipher } from '../workforce/documentEncryption.js';
import { WorkforceError } from '../workforce/policy.js';
import { identityValid, type Identity, type Member } from './domain.js';
import type { EncryptedIdentity } from './store.js';

// Provider-specific scope. A future multi-provider service must give each provider
// a separate key/scope; this index must never become a global patient directory.
const CONTEXT='medicaid:matching-key:pthhs:v1';
export interface IdentityGroup {version:1; revision:number; members:Array<{key:string;office:string}>; canonicalKey:string|null}
export interface IdentityLink {fingerprint:string; identityRevision:number}
export type IdentityHold='identity_unindexed'|'duplicate_identity'|'duplicate_link';
export interface IdentityMatch {hold:IdentityHold|null; duplicate:boolean; revision:number|null; canonicalKey:string|null}

export async function identityFingerprint(db:Firestore,cipher:DocumentCipher,identity:Identity|null):Promise<string|null>{
  const valid=!!identity&&identityValid(identity);
  const ref=db.collection('medicaidControl').doc('matchingKey-v1');
  let stored=(await ref.get()).data() as {encrypted:EncryptedIdentity}|undefined;
  if(!stored){
    const key=randomBytes(32);let candidate:EncryptedIdentity;
    try{const encrypted=await cipher.encrypt(key,CONTEXT);candidate={ciphertext:encrypted.bytes.toString('base64'),envelope:encrypted.envelope};}
    finally{key.fill(0);}
    stored=await db.runTransaction(async tx=>{const current=(await tx.get(ref)).data() as typeof stored;
      if(current)return current;
      if((await tx.get(db.collection('medicaidIdentityLinks').limit(1))).size)throw new WorkforceError(503,'eligibility_matching_key_missing');
      const value={encrypted:candidate};tx.create(ref,value);return value;});
  }
  if(!valid||!identity)return null;
  const key=await cipher.decrypt(Buffer.from(stored.encrypted.ciphertext,'base64'),stored.encrypted.envelope,CONTEXT);
  try{if(key.length!==32)throw new WorkforceError(503,'eligibility_matching_key_invalid');
    return createHmac('sha256',key).update('pthhs:medicaid-id:v1\0').update(identity.medicaidId).digest('hex');
  }finally{key.fill(0);}
}

// Prepare every read before the caller performs any write in its transaction.
export async function registerIdentity(tx:Transaction,db:Firestore,member:Member,fingerprint:string|null,actor:string):Promise<()=>void>{
  const linkRef=db.collection('medicaidIdentityLinks').doc(member.key),old=(await tx.get(linkRef)).data() as IdentityLink|undefined;
  const ids=[...new Set([old?.fingerprint,fingerprint].filter((id):id is string=>!!id))];
  const groups=await Promise.all(ids.map(async id=>({id,ref:db.collection('medicaidIdentityGroups').doc(id),
    group:(await tx.get(db.collection('medicaidIdentityGroups').doc(id))).data() as IdentityGroup|undefined})));
  const updates=groups.map(({id,ref,group})=>{
    const before=group?.members??[],members=before.filter(m=>m.key!==member.key);
    if(id===fingerprint)members.push({key:member.key,office:member.office});
    members.sort((a,b)=>a.key.localeCompare(b.key));
    if(members.length>100)throw new WorkforceError(409,'eligibility_identity_group_limit');
    const changed=JSON.stringify([...before].sort((a,b)=>a.key.localeCompare(b.key)))!==JSON.stringify(members)||old?.identityRevision!==member.identityRevision;
    const next:IdentityGroup={version:1,members,revision:(group?.revision??0)+(changed?1:0),canonicalKey:changed?null:group?.canonicalKey??null};
    return {ref,next,changed};
  });
  return ()=>{for(const {ref,next,changed}of updates){tx.set(ref,next);
      if(changed)for(const linked of next.members)tx.create(db.collection('medicaidAudit').doc(),{actor,action:next.members.length>1?'duplicate_identity_detected':'identity_link_registered',
        office:linked.office,memberKey:linked.key,groupRevision:next.revision,at:new Date().toISOString()});}
    tx.set(linkRef,{fingerprint,identityRevision:member.identityRevision});};
}

export function matchState(member:Member,link:IdentityLink|undefined,group:IdentityGroup|undefined):IdentityMatch{
  if(!member.identityReady||!link?.fingerprint||link.identityRevision!==member.identityRevision||group?.version!==1||
    !group.members.some(m=>m.key===member.key&&m.office===member.office))return {hold:'identity_unindexed',duplicate:false,revision:null,canonicalKey:null};
  const duplicate=group.members.length>1,canonicalKey=group.canonicalKey;
  const hold=duplicate?(canonicalKey===member.key?null:canonicalKey?'duplicate_link':'duplicate_identity'):null;
  return {hold,duplicate,revision:group.revision,canonicalKey};
}
