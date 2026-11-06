import test from "node:test";
import assert from "node:assert/strict";
import { maintenanceReferenceCodes } from "./references.js";
function fixture(){
 const state={dataApproved:true,settings:{officeId:'123',revision:1,enabledReads:['GetScheduleBillInfoEditReasons','GetMissedVisitReasons','GetMissedVisitActionTaken']}};
 const result={operation:'GetScheduleBillInfoEditReasons',source:'hhaexchange',fetchedAt:'2026-11-05T18:00:00Z',truncated:false,records:[{ReasonID:'51',Reason:'Synthetic reference',ReasonDescription:'Synthetic description',ReasonStatus:'Raw status',NoteRequired:'Y',MinCharacterCount:'10'}] as Record<string,string|null>[]};
 let queries=0,change=false;const workspace={settings:async()=>structuredClone(state),query:async(input:{operation:string})=>{queries++;if(change)state.settings.revision++;return{...structuredClone(result),operation:input.operation};}};
 return{workspace,state,result,queries:()=>queries,change:()=>{change=true;}};
}
test('all three source catalogs preserve raw note/status fields and never become visit approval',async()=>{
 const f=fixture();for(const[catalog,operation]of [['schedule','GetScheduleBillInfoEditReasons'],['missed_reason','GetMissedVisitReasons'],['missed_action','GetMissedVisitActionTaken']]){const result=await maintenanceReferenceCodes(f.workspace as never,{catalog},'synthetic-owner');assert.equal(result.operation,operation);assert.equal(result.scope,'agency_reference');assert.equal(result.supportsConfirmation,false);assert.equal(result.applicability,'not_verified_for_selected_visit');assert.equal(result.items[0]?.description,'Synthetic description');}
 const result=await maintenanceReferenceCodes(f.workspace as never,{catalog:'schedule'},'synthetic-owner');assert.equal(result.items[0]?.minimumNoteCharacters,'10');assert.equal(result.items[0]?.status,'Raw status');
});
test('reference reads enforce release, owner method, exact input and current office context',async()=>{
 const f=fixture();f.state.dataApproved=false;await assert.rejects(maintenanceReferenceCodes(f.workspace as never,{catalog:'schedule'},'owner'),/operational_data_release_not_approved/);f.state.dataApproved=true;f.state.settings.enabledReads=[];await assert.rejects(maintenanceReferenceCodes(f.workspace as never,{catalog:'schedule'},'owner'),/read_not_owner_enabled/);assert.equal(f.queries(),0);
 for(const value of [{catalog:'ConfirmVisits'},{catalog:'schedule',visitId:'15'},null])await assert.rejects(maintenanceReferenceCodes(f.workspace as never,value,'owner'),/invalid_reference_catalog/);
 const g=fixture();g.change();await assert.rejects(maintenanceReferenceCodes(g.workspace as never,{catalog:'schedule'},'owner'),/office_policy_changed_restart/);
});
test('duplicate and malformed source IDs cannot produce a misleading selectable reference',async()=>{
 const f=fixture();f.result.records.push({...f.result.records[0]!});await assert.rejects(maintenanceReferenceCodes(f.workspace as never,{catalog:'schedule'},'owner'),/reference_source_unverified/);
 f.result.records=[{ReasonID:'not-a-code'}];await assert.rejects(maintenanceReferenceCodes(f.workspace as never,{catalog:'schedule'},'owner'),/reference_source_unverified/);
});
