import { randomUUID } from 'node:crypto';
import { FieldPath, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { identityFingerprint, registerIdentity, matchState, type IdentityGroup, type IdentityLink } from './matching.js';
import { assertRosterFence, rosterReady, ROSTER_LEASE_MS, type RosterFence, type RosterState } from './roster.js';
import { WorkforceError, validId, type Actor } from '../workforce/policy.js';
import type { DocumentCipher, DocumentEnvelope } from '../workforce/documentEncryption.js';
import { access, applyResult, chicagoDate, dateOnly, identityValid, jobId, opaqueId, retryDelay,
  type Identity, type Job, type Member, type Result, type Trigger } from './domain.js';

export interface EncryptedIdentity { ciphertext: string; envelope: DocumentEnvelope }
export class EligibilityStore {
  constructor(readonly db: Firestore = getFirestore(), private auth:()=>Pick<Auth,'getUsers'>=getAuth,private clock:()=>number=Date.now) {}
  async reviewers(office:string) {
    const snapshot=await this.db.collection('workforceStaff').where('offices','array-contains',office).limit(201).get();
    const ids=snapshot.docs.slice(0,200).filter(doc=>{try{access({uid:doc.id,grant:doc.data() as Actor['grant']},'review',office);return true;}catch{return false;}}).map(doc=>doc.id);
    const items:Array<{uid:string;name:string}>=[];
    for(let offset=0;offset<ids.length;offset+=100){const result=await this.auth().getUsers(ids.slice(offset,offset+100).map(uid=>({uid})));
      for(const user of result.users)if(!user.disabled&&user.emailVerified)items.push({uid:user.uid,name:user.displayName||user.email||'Office staff'});
    }
    return {items:items.sort((a,b)=>a.name.localeCompare(b.name)),complete:snapshot.size<=200};
  }
  member(key: string) { if (!/^[a-f0-9]{64}$/.test(key)) throw new WorkforceError(400, 'invalid_member_reference'); return this.db.collection('medicaidMembers').doc(key); }
  async read(key: string): Promise<Member> { const data = (await this.member(key).get()).data(); if (!data) throw new WorkforceError(404,'eligibility_member_not_found'); return data as Member; }
  async audit(actor: string, action: string, office: string, memberKey: string | null = null) {
    // Private audit only. No names, Medicaid identifiers, raw payloads or tokens.
    await this.db.collection('medicaidAudit').add({actor,action,office,memberKey,at:new Date().toISOString()});
  }
  async list(office: string, after = '', limit = 100): Promise<{items: Member[]; next: string | null}> {
    if (!validId(office) || after && !/^[a-f0-9]{64}$/.test(after)) throw new WorkforceError(400,'invalid_request');
    let query = this.db.collection('medicaidMembers').where('office','==',office).orderBy(FieldPath.documentId()).limit(limit+1);
    if (after) query = query.startAfter(after);
    const docs = (await query.get()).docs, items = docs.slice(0,limit).map(d=>d.data() as Member);
    return {items,next:docs.length>limit?items.at(-1)!.key:null};
  }
  async syncMember(snapshot: Pick<Member,'office'|'hhaPatientId'|'memberId'|'displayName'|'active'|'sourceFetchedAt'|'authorizations'|'authorizationsFetchedAt'>,
    identity: Identity | null, cipher: DocumentCipher, actor: string, fence?:RosterFence) {
    if(!validId(snapshot.office)||!/^\d{1,10}$/.test(snapshot.hhaPatientId)||!Number.isFinite(Date.parse(snapshot.sourceFetchedAt)))throw new WorkforceError(400,'eligibility_source_invalid');
    const key = opaqueId('hhaexchange',snapshot.office,snapshot.hhaPatientId), ref = this.member(key);
    const observed = (await ref.get()).data() as Member | undefined;
    const oldIdentity = observed ? await this.identity(observed,cipher) : null;
    const identityChanged = JSON.stringify(oldIdentity)!==JSON.stringify(identity&&identityValid(identity)?identity:null);
    const fingerprint=await identityFingerprint(this.db,cipher,identity);
    let encrypted: EncryptedIdentity | null = null;
    if (identity && identityValid(identity)) {
      const encoded = Buffer.from(JSON.stringify(identity));
      try { const value = await cipher.encrypt(encoded,`medicaid:${snapshot.office}:${key}`);
        encrypted = {ciphertext:value.bytes.toString('base64'),envelope:value.envelope}; }
      finally { encoded.fill(0); }
    }
    return this.db.runTransaction(async tx=>{
      const previous = (await tx.get(ref)).data() as Member | undefined;
      if(previous?.revision!==observed?.revision)throw new WorkforceError(409,'revision_conflict');
      if(previous&&previous.sourceFetchedAt>snapshot.sourceFetchedAt)throw new WorkforceError(409,'eligibility_source_stale');
      const rosterRef=this.db.collection('medicaidRoster').doc(snapshot.office);
      if(fence)assertRosterFence((await tx.get(rosterRef)).data() as RosterState|undefined,{...fence,now:this.clock()});
      // Identity changes replace the encrypted version but retain the stable HHA link.
      const next: Member = {...snapshot,key,department:previous?.department??'unassigned',assignee:previous?.assignee??null,
        sourceState:snapshot.active?'present':'inactive',...(fence?{rosterGeneration:fence.generation}:previous?.rosterGeneration?{rosterGeneration:previous.rosterGeneration}:{}),
        admissionPending:snapshot.active&&(!previous?.active||identityChanged)?'source_'+((previous?.revision??0)+1):previous?.admissionPending??null,
        identityReady:encrypted!==null,identityRevision:(previous?.identityRevision??0)+(identityChanged||!previous?1:0),
        latest:identityChanged?null:previous?.latest??null,lastSuccessful:identityChanged?null:previous?.lastSuccessful??null,
        review:previous&&(identityChanged||previous.active!==snapshot.active||previous.sourceState==='missing')?'pending':previous?.review??'none',changedAt:previous?.changedAt??null,revision:(previous?.revision??0)+1};
      const register=await registerIdentity(tx,this.db,next,fingerprint,actor);
      register();
      tx.set(ref,next); tx.set(this.db.collection('medicaidIdentities').doc(key),{office:snapshot.office,encrypted});
      if(fence)tx.update(rosterRef,{offset:fence.offset+1,leaseUntil:this.clock()+ROSTER_LEASE_MS});
      tx.create(this.db.collection('medicaidAudit').doc(),{actor,action:'member_synchronized',memberKey:key,office:snapshot.office,at:new Date().toISOString()});
      return {member:next,admitted:next.active&&!previous?.active};
    });
  }
  async reconciliation(member:Member,now=Date.now()) {
    const link=(await this.db.collection('medicaidIdentityLinks').doc(member.key).get()).data() as IdentityLink|undefined;
    const group=link?.fingerprint?(await this.db.collection('medicaidIdentityGroups').doc(link.fingerprint).get()).data() as IdentityGroup|undefined:undefined;
    const roster=(await this.db.collection('medicaidRoster').doc(member.office).get()).data() as RosterState|undefined;
    const match=matchState(member,link,group);
    const hold=!member.active?'source_inactive':member.sourceState==='missing'?'source_missing':
      member.sourceState!=='present'?'source_unreconciled':!rosterReady(roster,now)?'roster_incomplete':match.hold;
    return {...match,hold,rosterReady:rosterReady(roster,now)};
  }
  async reconciliations(members:Member[],now=Date.now()){
    const results=new Map<string,Awaited<ReturnType<EligibilityStore['reconciliation']>>>();
    const load=async<T>(collection:string,ids:string[])=>{const data=new Map<string,T>();
      for(let offset=0;offset<ids.length;offset+=100){const docs=await this.db.getAll(...ids.slice(offset,offset+100).map(id=>this.db.collection(collection).doc(id)));
        for(const doc of docs)if(doc.exists)data.set(doc.id,doc.data() as T);}return data;};
    const links=await load<IdentityLink>('medicaidIdentityLinks',members.map(m=>m.key));
    const groups=await load<IdentityGroup>('medicaidIdentityGroups',[...new Set([...links.values()].map(l=>l.fingerprint).filter(Boolean))]);
    const rosters=await load<RosterState>('medicaidRoster',[...new Set(members.map(m=>m.office))]);
    for(const member of members){const link=links.get(member.key),match=matchState(member,link,link?groups.get(link.fingerprint):undefined),ready=rosterReady(rosters.get(member.office),now);
      const hold=!member.active?'source_inactive':member.sourceState==='missing'?'source_missing':member.sourceState!=='present'?'source_unreconciled':!ready?'roster_incomplete':match.hold;
      results.set(member.key,{...match,hold,rosterReady:ready});}
    return results;
  }
  async enqueueAdmissionsPage(office:string,now=new Date()){
    const ref=this.db.collection('medicaidControl').doc('admissions_'+office),cursor=(await ref.get()).data()?.after??'';
    const page=await this.list(office,cursor,5);
    for(const member of page.items)if(member.active&&member.admissionPending&&!(await this.reconciliation(member,now.getTime())).hold){
      await this.enqueue(member.key,chicagoDate(now),'admission',member.admissionPending,'eligibility_admission',now);
      await this.db.runTransaction(async tx=>{const current=(await tx.get(this.member(member.key))).data() as Member;
        if(current.admissionPending===member.admissionPending)tx.update(this.member(member.key),{admissionPending:null});});
    }
    await ref.set({after:page.next??''});
  }
  async reconciliationDetail(actor:Actor,key:string){
    const member=await this.read(key);access(actor,'review',member.office);
    const link=(await this.db.collection('medicaidIdentityLinks').doc(key).get()).data() as IdentityLink|undefined;
    const group=link?.fingerprint?(await this.db.collection('medicaidIdentityGroups').doc(link.fingerprint).get()).data() as IdentityGroup|undefined:undefined;
    const allOffices=group?.members.every(m=>{try{access(actor,'review',m.office);return true;}catch{return false;}})??false;
    const items=[];
    for(const entry of group?.members??[]){
      // Do not reveal names, keys, office identifiers or group size in foreign scopes.
      try{access(actor,'review',entry.office);}catch{continue;}
      const linked=await this.read(entry.key);items.push({key:linked.key,displayName:linked.displayName,memberId:linked.memberId,office:linked.office,active:linked.active,sourceState:linked.sourceState??'unreconciled'});
    }
    const state=await this.reconciliation(member);
    return {state:{...state,canonicalKey:items.some(m=>m.key===state.canonicalKey)?state.canonicalKey:null},members:items,canResolve:allOffices,revision:group?.revision??null};
  }
  async selectCanonical(actor:Actor,key:string,revision:number,canonicalKey:string,note:string){
    if(!Number.isSafeInteger(revision)||typeof note!=='string'||!note.trim()||note.length>2000)throw new WorkforceError(400,'invalid_reconciliation');
    this.member(canonicalKey);const memberRef=this.member(key),linkRef=this.db.collection('medicaidIdentityLinks').doc(key);
    await this.db.runTransaction(async tx=>{
      const member=(await tx.get(memberRef)).data() as Member|undefined;if(!member)throw new WorkforceError(404,'eligibility_member_not_found');access(actor,'review',member.office);
      const grant=(await tx.get(this.db.collection('workforceStaff').doc(actor.uid))).data() as Actor['grant']|undefined;
      if(!grant)throw new WorkforceError(403,'workforce_forbidden');const current={uid:actor.uid,grant};
      const link=(await tx.get(linkRef)).data() as IdentityLink|undefined;if(!link?.fingerprint)throw new WorkforceError(409,'eligibility_identity_unindexed');
      const ref=this.db.collection('medicaidIdentityGroups').doc(link.fingerprint),group=(await tx.get(ref)).data() as IdentityGroup|undefined;
      if(!group||group.revision!==revision||!group.members.some(m=>m.key===canonicalKey)||group.members.length<2)throw new WorkforceError(409,'revision_conflict');
      for(const entry of group.members)access(current,'review',entry.office);
      const members=await tx.getAll(...group.members.map(m=>this.member(m.key)));
      const rosters=await tx.getAll(...[...new Set(group.members.map(m=>m.office))].map(office=>this.db.collection('medicaidRoster').doc(office)));
      if(rosters.some(r=>!rosterReady(r.data())))throw new WorkforceError(409,'eligibility_roster_incomplete');
      const selected=members.find(m=>m.id===canonicalKey)?.data() as Member|undefined;
      if(!selected?.active||selected.sourceState!=='present'||!selected.identityReady)throw new WorkforceError(409,'eligibility_canonical_invalid');
      const at=new Date().toISOString();tx.update(ref,{canonicalKey,revision:revision+1});
      for(const snapshot of members){const linked=snapshot.data() as Member;
        tx.update(snapshot.ref,{review:'pending',revision:linked.revision+1});
        tx.create(this.db.collection('medicaidNotes').doc(),{memberKey:linked.key,office:linked.office,actor:actor.uid,note:note.trim(),action:'canonical_selected',at});
        tx.create(this.db.collection('medicaidAudit').doc(),{memberKey:linked.key,office:linked.office,actor:actor.uid,action:'identity_canonical_selected',canonicalKey,groupRevision:revision+1,at});
      }
    });return {saved:true};
  }
  async markSourceMissing(observed:Member,fence:RosterFence){
    const ref=this.member(observed.key),rosterRef=this.db.collection('medicaidRoster').doc(observed.office);
    return this.db.runTransaction(async tx=>{
      const [snapshot,rosterSnapshot]=await tx.getAll(ref,rosterRef),roster=rosterSnapshot!.data() as RosterState|undefined;
      assertRosterFence(roster,{...fence,now:this.clock()},'reconcile');const member=snapshot!.data() as Member|undefined;
      if(!member||member.rosterGeneration===fence.generation||member.sourceFetchedAt>=roster!.startedAt||member.sourceState==='missing')return false;
      // Absence is not evidence of Medicaid inactivity or discharge. Keep the
      // record/history and active flag; hold verification pending source review.
      tx.update(ref,{sourceState:'missing',review:'pending',revision:member.revision+1});
      tx.update(rosterRef,{missingCount:roster!.missingCount+1});
      const id=opaqueId('source_missing',fence.generation,member.key),at=new Date(fence.now).toISOString();
      tx.set(this.db.collection('medicaidExceptions').doc(id),{memberKey:member.key,office:member.office,department:member.department,assignee:member.assignee,
        reason:'source_missing',status:'pending',lastSuccessful:member.lastSuccessful,createdAt:at});
      tx.set(this.db.collection('medicaidNotifications').doc(id),{memberKey:member.key,office:member.office,department:member.department,exceptionId:id,state:'unread',createdAt:at});
      tx.create(this.db.collection('medicaidAudit').doc(),{memberKey:member.key,office:member.office,actor:'eligibility_roster',action:'source_missing',generation:fence.generation,at});return true;
    });
  }
  async identity(member: Member, cipher: DocumentCipher): Promise<Identity | null> {
    const document = (await this.db.collection('medicaidIdentities').doc(member.key).get()).data();
    if (!document || document.office !== member.office || !document.encrypted) return null;
    const value = document.encrypted as EncryptedIdentity;
    const bytes = await cipher.decrypt(Buffer.from(value.ciphertext,'base64'),value.envelope,`medicaid:${member.office}:${member.key}`);
    try { const identity = JSON.parse(bytes.toString('utf8')) as Identity; return identityValid(identity)?identity:null; }
    finally { bytes.fill(0); }
  }
  async enqueue(memberKey: string, asOf: string, trigger: Trigger, key: string, requestedBy: string, now = new Date()): Promise<Job> {
    dateOnly(asOf); if (!/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw new WorkforceError(400,'invalid_idempotency_key');
    const id = jobId(memberKey,asOf,trigger,key), ref = this.db.collection('medicaidJobs').doc(id), memberRef = this.member(memberKey);
    const lockRef = this.db.collection('medicaidRequestLocks').doc(opaqueId(memberKey,asOf));
    return this.db.runTransaction(async tx=>{
      const [existing,snapshot,lock] = await tx.getAll(ref,memberRef,lockRef);
      if (existing!.exists) return existing!.data() as Job;
      const member = snapshot!.data() as Member | undefined;
      if (!member?.active) throw new WorkforceError(409,'eligibility_member_inactive');
      const roster=(await tx.get(this.db.collection('medicaidRoster').doc(member.office))).data() as RosterState|undefined;
      const link=(await tx.get(this.db.collection('medicaidIdentityLinks').doc(member.key))).data() as IdentityLink|undefined;
      const group=link?.fingerprint?(await tx.get(this.db.collection('medicaidIdentityGroups').doc(link.fingerprint))).data() as IdentityGroup|undefined:undefined;
      if(member.sourceState!=='present'||!rosterReady(roster,now.getTime())||matchState(member,link,group).hold)throw new WorkforceError(409,'eligibility_reconciliation_required');
      const lockData = lock!.data();
      if (lockData?.jobId) {
        const pending = (await tx.get(this.db.collection('medicaidJobs').doc(lockData.jobId))).data() as Job | undefined;
        if (pending && ['queued','leased'].includes(pending.state)) return pending;
      }
      if (trigger==='manual' && Number(lockData?.createdAt)>now.getTime()-60000) throw new WorkforceError(429,'eligibility_request_throttled');
      const job: Job = {id,memberKey,office:member.office,identityRevision:member.identityRevision,asOf,trigger,requestedBy,state:'queued',attempts:0,
        nextAttemptAt:now.getTime(),leaseUntil:0,leaseToken:null,createdAt:now.toISOString(),finishedAt:null,error:null};
      tx.create(ref,job); tx.set(lockRef,{jobId:id,createdAt:now.getTime()});
      tx.create(this.db.collection('medicaidAudit').doc(),{actor:requestedBy,action:'verification_queued',office:member.office,memberKey,jobId:id,at:now.toISOString()});
      return job;
    });
  }
  async due(now = Date.now()): Promise<string[]> {
    const rows = await this.db.collection('medicaidJobs').where('state','==','queued').where('nextAttemptAt','<=',now).orderBy('nextAttemptAt').limit(20).get();
    return rows.docs.map(d=>d.id);
  }
  async claim(id: string, minimumIntervalMs: number, now = Date.now()): Promise<Job | null> {
    const ref = this.db.collection('medicaidJobs').doc(id), rate = this.db.collection('medicaidControl').doc('rate');
    return this.db.runTransaction(async tx=>{
      const [snapshot,budget] = await tx.getAll(ref,rate), job = snapshot!.data() as Job | undefined;
      if (!job || job.state!=='queued' || job.nextAttemptAt>now || Number(budget!.data()?.nextAt)>now) return null;
      const leased: Job = {...job,state:'leased',attempts:job.attempts+1,leaseUntil:now+120000,leaseToken:randomUUID()};
      tx.update(ref,leased); tx.set(rate,{nextAt:now+minimumIntervalMs}); return leased;
    });
  }
  async finish(job: Job, result: Result, now = new Date()): Promise<void> {
    const ref = this.db.collection('medicaidJobs').doc(job.id), memberRef = this.member(job.memberKey);
    await this.db.runTransaction(async tx=>{
      const [snapshot,memberSnapshot] = await tx.getAll(ref,memberRef), current = snapshot!.data() as Job | undefined;
      if (!current || current.state!=='leased' || current.leaseToken!==job.leaseToken) return;
      const member = memberSnapshot!.data() as Member | undefined; if (!member) throw new WorkforceError(404,'eligibility_member_not_found');
      const link=(await tx.get(this.db.collection('medicaidIdentityLinks').doc(member.key))).data() as IdentityLink|undefined;
      const group=link?.fingerprint?(await tx.get(this.db.collection('medicaidIdentityGroups').doc(link.fingerprint))).data() as IdentityGroup|undefined:undefined;
      const roster=(await tx.get(this.db.collection('medicaidRoster').doc(member.office))).data() as RosterState|undefined;
      let recorded=result;
      if(recorded.status!=='unable_to_verify'&&(member.identityRevision!==job.identityRevision||member.sourceState!=='present'||!member.active||!rosterReady(roster,now.getTime())||matchState(member,link,group).hold))
        recorded={status:'unable_to_verify',source:'tmhp',asOf:job.asOf,checkedAt:now.toISOString(),coverage:null,mco:null,reason:'member_mismatch'};
      // Only explicit pre-submission/transient failures are retryable. Unknown delivery
      // and expired credentials require review; a 271 AAA never means inactive.
      const retry = recorded.reason==='network_failure' && job.attempts<4;
      const applied = applyResult(member,recorded);
      tx.set(memberRef,applied.member);
      tx.update(ref,{state:retry?'queued':recorded.status==='unable_to_verify'?'failed':'completed',error:recorded.reason,
        nextAttemptAt:retry?now.getTime()+retryDelay(job.attempts):0,leaseToken:null,leaseUntil:0,finishedAt:retry?null:now.toISOString()});
      tx.create(this.db.collection('medicaidResults').doc(job.id+'-'+job.attempts),{...recorded,memberKey:member.key,office:member.office,jobId:job.id});
      tx.create(this.db.collection('medicaidAudit').doc(),{actor:'eligibility_worker',action:'verification_recorded',office:member.office,
        memberKey:member.key,jobId:job.id,at:now.toISOString(),status:recorded.status,reason:recorded.reason});
      if (applied.changed || recorded.status==='unable_to_verify') {
        tx.set(this.db.collection('medicaidExceptions').doc(job.id),{memberKey:member.key,office:member.office,department:member.department,
          assignee:member.assignee,reason:applied.alert?'active_to_inactive':applied.changed?'eligibility_changed':recorded.reason,
          status:'pending',lastSuccessful:applied.member.lastSuccessful,createdAt:now.toISOString()});
        // A private department inbox is the first notification channel. No PHI in email/SMS.
        tx.set(this.db.collection('medicaidNotifications').doc(job.id),{office:member.office,department:member.department,
          exceptionId:job.id,memberKey:member.key,state:'unread',createdAt:now.toISOString()});
      }
    });
  }
  async recoverExpired(now = new Date()) {
    const snapshots = await this.db.collection('medicaidJobs').where('state','==','leased').where('leaseUntil','<=',now.getTime()).limit(20).get();
    for (const row of snapshots.docs) {
      const job = row.data() as Job;
      await this.finish(job,{status:'unable_to_verify',source:'tmhp',asOf:job.asOf,checkedAt:now.toISOString(),coverage:null,mco:null,reason:'delivery_unknown'},now);
    }
  }
  async review(actor: Actor, key: string, revision: number, action: 'in_progress'|'resolved', note: string, department: string, assignee: string | null) {
    if (!Number.isSafeInteger(revision)||!['in_progress','resolved'].includes(action)||typeof note!=='string'||!note.trim()||note.length>2000||
      typeof department!=='string'||!department.trim()||department.length>100||/[\x00-\x1f\x7f]/.test(department)||assignee!==null&&!validId(assignee)) throw new WorkforceError(400,'invalid_eligibility_review');
    department=department.trim();
    const ref = this.member(key);
    await this.db.runTransaction(async tx=>{
      const member = (await tx.get(ref)).data() as Member | undefined;
      if (!member) throw new WorkforceError(404,'eligibility_member_not_found'); access(actor,'review',member.office);
      if (member.revision!==revision) throw new WorkforceError(409,'revision_conflict');
      if (assignee) {
        const grant = (await tx.get(this.db.collection('workforceStaff').doc(assignee))).data();
        if(!grant)throw new WorkforceError(400,'invalid_assignee');access({uid:assignee,grant:grant as Actor['grant']},'review',member.office);
      }
      const exceptions = await tx.get(this.db.collection('medicaidExceptions').where('memberKey','==',key).where('status','in',['pending','in_progress']).limit(100));
      if (exceptions.size===100) throw new WorkforceError(409,'exception_history_requires_paged_review');
      tx.update(ref,{review:action,department,assignee,revision:revision+1});
      for (const exception of exceptions.docs) {
        tx.update(exception.ref,{status:action,department,assignee});
        tx.set(this.db.collection('medicaidNotifications').doc(exception.id),{state:action==='resolved'?'reviewed':'acknowledged',department},{merge:true});
      }
      tx.create(this.db.collection('medicaidNotes').doc(),{memberKey:key,office:member.office,actor:actor.uid,note:note.trim(),action,at:new Date().toISOString()});
      tx.create(this.db.collection('medicaidAudit').doc(),{memberKey:key,office:member.office,actor:actor.uid,action:'review_'+action,at:new Date().toISOString()});
    });
  }
  async history(key: string) {
    const [results,notes] = await Promise.all([
      this.db.collection('medicaidResults').where('memberKey','==',key).orderBy('checkedAt','desc').limit(50).get(),
      this.db.collection('medicaidNotes').where('memberKey','==',key).orderBy('at','desc').limit(50).get(),
    ]);
    return {results:results.docs.map(d=>d.data()),notes:notes.docs.map(d=>d.data()),limitedTo:50};
  }
  async enqueueMonthly(office: string, now = new Date()) {
    const asOf = chicagoDate(now); let after = ''; let count = 0;
    do { const page = await this.list(office,after,100);
      for (const member of page.items) if (member.active) {
        try{await this.enqueue(member.key,asOf,'monthly','monthly_'+asOf,'eligibility_scheduler',now);count++;}
        catch(error){if(!(error instanceof WorkforceError)||!['eligibility_reconciliation_required','eligibility_member_inactive'].includes(error.code))throw error;}
      }
      after = page.next??'';
    } while (after);
    return count;
  }
}
