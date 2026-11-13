import {createHash,randomUUID} from 'node:crypto';
import {getFirestore} from 'firebase-admin/firestore';
import type {OperationsWorkspace} from '../operations/workspace.js';
import {HhaProfileSource} from './hhaSource.js';
import {chicagoDate} from './dates.js';
export function caregiverSyncWindow(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now),get=(type:string)=>parts.find(p=>p.type===type)?.value||'';
 const hour=Number(get('hour')),minute=Number(get('minute'));
 return !['Sat','Sun'].includes(get('weekday'))&&(hour>=9&&hour<17||hour===17&&minute===0);
}
// Deliberately overlap two calendar days. The vendor's EST wall-time cursor is
// not treated as a UTC timestamp, and Monday includes changes made on weekends.
export function caregiverChangesSince(checkpoint?:string,now=new Date()){
 const base=checkpoint&&Number.isFinite(Date.parse(checkpoint))?Date.parse(checkpoint):now.getTime()-7*86400000;
 return new Date(base-2*86400000).toISOString().slice(0,10)+'T00:00:00';
}
export class CaregiverSync {
 constructor(private workspace:Pick<OperationsWorkspace,'settings'|'query'>,private db=getFirestore(),private now=()=>new Date()){}
 async run(){
  if(!caregiverSyncWindow(this.now()))return {skipped:true};
  const settings=await this.workspace.settings(),office=settings.settings.officeId;
  if(!settings.dataApproved||!office)throw Error('caregiver_sync_configuration_unavailable');
  const ref=this.db.collection('workforceCaregiverSync').doc(office),lease=randomUUID(),started=this.now();
  const prior=await this.db.runTransaction(async tx=>{const value=(await tx.get(ref)).data()||{};if(value.leaseUntil>started.getTime())return null;tx.set(ref,{...value,office,lease,leaseUntil:started.getTime()+10*60000,lastAttemptAt:started.toISOString(),state:'running'});return value;});
  if(!prior)return {skipped:true};
  let pending:string[]=Array.isArray(prior.pending)?prior.pending:[],cycleAt:string=prior.cycleAt||started.toISOString();
  const source=new HhaProfileSource(this.workspace,'system:caregiver-sync',office);
  try{
   if(!pending.length){
    cycleAt=started.toISOString();
    const changes=await this.workspace.query({operation:'GetCaregiverChangesV2',modifiedAfter:caregiverChangesSince(prior.lastCompletedAt,started)},'system:caregiver-sync','workforce_roster_import');
    if(changes.operation!=='GetCaregiverChangesV2'||changes.source!=='hhaexchange'||changes.truncated)throw Error('caregiver_changes_incomplete');
    pending=changes.records.filter(row=>row.OfficeID===office).map(row=>String(row.CaregiverID));
    if(pending.some(id=>!/^\d{1,10}$/.test(id)))throw Error('caregiver_changes_invalid');
    if(prior.discoveryDate!==chicagoDate(started)){
     const discovered=await source.discover(),cached=await this.db.collection('workforceHhaProfiles').where('office','==',office).select('id').get(),existing=new Set(cached.docs.map(doc=>doc.id));
     pending.push(...discovered.ids.filter(id=>!existing.has(id)));
     await ref.update({discoveryDate:chicagoDate(started),discoveredCount:discovered.ids.length});
    }
    pending=[...new Set(pending)];await ref.update({pending,cycleAt});
   }
   let processed=0;
   while(pending.length&&this.now().getTime()-started.getTime()<8*60000&&caregiverSyncWindow(this.now())){
    const id=pending[0]!;
    try{
     const profile=await source.profile(id);
     const email=profile.email.trim().toLowerCase(),emailKey=/^\S+@\S+\.\S+$/.test(email)?createHash('sha256').update(email).digest('hex'):'';
     await this.db.collection('workforceHhaProfiles').doc(id).set({...profile,emailKey});pending.shift();processed++;
     await ref.update({pending,processed,lastProfileAt:this.now().toISOString()});
    }catch(error){
     const code=(error as {code?:string}).code;
     if(code==='hha_office_mismatch'){const cached=this.db.collection('workforceHhaProfiles').doc(id);if((await cached.get()).exists)await cached.update({status:'Office assignment changed',email:'',emailKey:'',fields:{}});pending.shift();await ref.update({pending});continue;}
     if(['background_read_budget_reserved','read_budget_exhausted_retry_next_minute','vendor_backoff_active'].includes(code||'')){
      const delay=Math.max(1,Math.min(60,Number((error as {retryAfterSeconds?:number}).retryAfterSeconds)||30));await new Promise(resolve=>setTimeout(resolve,delay*1000));continue;
     }
     throw error;
    }
   }
   await ref.update({state:pending.length?'continuing':'complete',pending,leaseUntil:0,...(!pending.length?{lastCompletedAt:cycleAt}:{}),lastFinishedAt:this.now().toISOString()});
   return {processed,remaining:pending.length};
  }catch(error){await ref.update({state:'needs_attention',leaseUntil:0,lastFinishedAt:this.now().toISOString(),error:'caregiver_sync_deferred'});throw error;}
 }
}
