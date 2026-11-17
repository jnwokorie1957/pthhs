import { randomUUID } from 'node:crypto';
import type { DocumentCipher } from '../workforce/documentEncryption.js';
import { WorkforceError, validId } from '../workforce/policy.js';
import type { HhaEligibilitySource } from './hha.js';
import type { EligibilityStore } from './store.js';

export const ROSTER_MAX_AGE=24*3600000,ROSTER_LEASE_MS=120000;
export interface RosterState {
  version:2; generation:string; phase:'discover'|'profiles'|'reconcile'|'complete'; complete:boolean;
  ids:string[]; offset:number; after:string; sourceRevision:number|null;
  leaseToken:string|null; leaseUntil:number; startedAt:string; completedAt:string|null;
  missingCount:number; excludedCount:number; error:string|null;
}
export interface RosterFence {generation:string;leaseToken:string;offset:number;now:number}
export function rosterReady(state:Partial<RosterState>|undefined,now=Date.now()):boolean{
  const age=now-Date.parse(state?.completedAt??'');
  return state?.version===2&&state.phase==='complete'&&state.complete===true&&Number.isFinite(age)&&age>=0&&age<=ROSTER_MAX_AGE;
}
export function assertRosterFence(state:RosterState|undefined,fence:RosterFence,phase:RosterState['phase']='profiles'){
  if(!state||state.generation!==fence.generation||state.leaseToken!==fence.leaseToken||state.leaseUntil<=fence.now||state.phase!==phase||
    phase==='profiles'&&state.offset!==fence.offset)throw new WorkforceError(409,'eligibility_roster_lease_lost');
}
const sameIds=(a:string[],b:string[])=>{const right=[...b].sort();return a.length===b.length&&[...a].sort().every((id,i)=>id===right[i]);};

export class RosterReconciler {
  constructor(private store:EligibilityStore,private source:Pick<HhaEligibilitySource,'discover'|'read'|'revision'>,
    private cipher:()=>DocumentCipher,private enabled:()=>boolean,private now=()=>new Date()){}
  async tick(office:string){
    if(!this.enabled())return;
    if(!validId(office))throw new WorkforceError(400,'invalid_request');
    const sourceRevision=await this.source.revision(office);
    if(!this.enabled())return;
    const ref=this.store.db.collection('medicaidRoster').doc(office),at=this.now(),token=randomUUID();
    let state=await this.store.db.runTransaction(async tx=>{
      const previous=(await tx.get(ref)).data() as RosterState|undefined;
      if(rosterReady(previous,at.getTime())&&previous?.sourceRevision===sourceRevision||Number(previous?.leaseUntil)>at.getTime())return null;
      const resume=previous?.version===2&&previous.phase!=='complete'&&!previous.error&&
        (previous.sourceRevision===null||previous.sourceRevision===sourceRevision)&&at.getTime()-Date.parse(previous.startedAt)<ROSTER_MAX_AGE;
      const next:RosterState=resume?{...previous,leaseToken:token,leaseUntil:at.getTime()+ROSTER_LEASE_MS}:
        {version:2,generation:randomUUID(),phase:'discover',complete:false,ids:[],offset:0,after:'',sourceRevision:null,
          leaseToken:token,leaseUntil:at.getTime()+ROSTER_LEASE_MS,startedAt:at.toISOString(),completedAt:null,missingCount:0,excludedCount:0,error:null};
      tx.set(ref,next);return next;
    });
    if(!state)return;
    const fence=()=>({generation:state!.generation,leaseToken:token,offset:state!.offset,now:this.now().getTime()});
    const change=async(patch:Partial<RosterState>)=>{const phase=state!.phase;
      await this.store.db.runTransaction(async tx=>{const current=(await tx.get(ref)).data() as RosterState|undefined;assertRosterFence(current,fence(),phase);
        tx.update(ref,{...patch,leaseUntil:this.now().getTime()+ROSTER_LEASE_MS});});state={...state!,...patch};};
    const approved=async()=>{if(!this.enabled())throw new WorkforceError(423,'eligibility_source_pending');
      if(state!.sourceRevision!==null&&await this.source.revision(office)!==state!.sourceRevision)throw new WorkforceError(409,'eligibility_roster_source_changed');};
    try{
      await approved();
      if(state.phase==='discover'){
        const revision=await this.source.revision(office),ids=await this.source.discover(office,'eligibility_roster');
        if(await this.source.revision(office)!==revision)throw new WorkforceError(409,'eligibility_roster_source_changed');
        await approved();await change({ids,sourceRevision:revision,phase:'profiles'});
      }
      if(state.phase==='profiles'){
        for(const id of state.ids.slice(state.offset,state.offset+5)){
          await approved();const profile=await this.source.read(office,id,'eligibility_roster');
          await approved();
          // SearchPatients is agency-wide. A null read means the adapter proved
          // a different OfficeID; source errors throw and cannot be skipped.
          if(!profile)await change({offset:state.offset+1,excludedCount:(state.excludedCount??0)+1});
          else{await this.store.syncMember(profile.snapshot,profile.identity,this.cipher(),'eligibility_roster',fence());state.offset++;}
        }
        if(state.offset===state.ids.length){
          const ids=await this.source.discover(office,'eligibility_roster');await approved();
          if(!sameIds(state.ids,ids))throw new WorkforceError(409,'eligibility_roster_source_changed');
          await change({phase:'reconcile'});
        }
      }
      if(state.phase==='reconcile'){
        const page=await this.store.list(office,state.after,100);
        for(const member of page.items){await approved();
          await this.store.markSourceMissing(member,fence());}
        state.missingCount=((await ref.get()).data() as RosterState).missingCount;
        await change({after:page.next??'',missingCount:state.missingCount});
        if(!page.next){const ids=await this.source.discover(office,'eligibility_roster');await approved();
          if(!sameIds(state.ids,ids))throw new WorkforceError(409,'eligibility_roster_source_changed');
          await change({phase:'complete',complete:true,completedAt:this.now().toISOString()});
          await this.store.audit('eligibility_roster','roster_reconciled',office);
        }
      }
    }catch(error){
      // Policy/manifest changes invalidate the generation. Transient failures keep
      // the same cursor for retry. Neither may mark a roster complete.
      const reset=error instanceof WorkforceError&&error.code==='eligibility_roster_source_changed';
      await this.store.db.runTransaction(async tx=>{const current=(await tx.get(ref)).data() as RosterState|undefined;
        if(current?.generation===state!.generation&&current.leaseToken===token)tx.update(ref,{complete:false,error:reset?'source_changed':null});});
      throw new WorkforceError(503,'eligibility_roster_incomplete');
    }finally{
      await this.store.db.runTransaction(async tx=>{const current=(await tx.get(ref)).data() as RosterState|undefined;
        if(current?.generation===state!.generation&&current.leaseToken===token)tx.update(ref,{leaseToken:null,leaseUntil:0});});
    }
  }
}
