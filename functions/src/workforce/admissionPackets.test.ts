import test from 'node:test';import assert from 'node:assert/strict';import {PDFDocument} from 'pdf-lib';import {AdmissionPackets} from './admissionPackets.js';
function fixture(){
 const rows:Record<string,any>={'workforceStaff/staff':{active:true,role:'owner',offices:['100'],permissions:['field_visits.manage']},'workforceFieldVisits/a':{office:'100',clientName:'Fictional Member',memberId:'TEST',state:'draft',revision:1,title:'First form'},'workforceFieldVisits/b':{office:'100',clientName:'Fictional Member',memberId:'TEST',state:'signing',revision:2,title:'Second form'}};let serial=0;
 const ref=(path:string):any=>({path,collection:(name:string)=>collection(path+'/'+name)}),collection=(path:string):any=>({path,doc:(id:string='audit-'+ ++serial)=>ref(path+'/'+id),orderBy:()=>collection(path),limit:()=>collection(path),startAfter:()=>collection(path),add:async(value:any)=>{rows[path+'/'+ ++serial]=value;}});
 const db={collection,runTransaction:async(fn:any)=>{const writes:Array<()=>void>=[],tx={get:async(target:any)=>target.path in rows?{data:()=>rows[target.path]}:{data:()=>undefined,docs:Object.keys(rows).filter(path=>path.startsWith(target.path+'/')&&path.slice(target.path.length+1).indexOf('/')<0).map(path=>({id:path.split('/').at(-1),data:()=>rows[path]}))},update:(target:any,value:any)=>writes.push(()=>Object.assign(rows[target.path],value)),create:(target:any,value:any)=>writes.push(()=>{assert(!rows[target.path]);rows[target.path]=value;})};const result=await fn(tx);writes.forEach(write=>write());return result;}};
 return {rows,db};
}
const input={office:'100',clientName:'Fictional Member',memberId:'TEST',documentIds:['a','b']};
test('packet membership and completion survive reload and use every current document state',async()=>{
 const f=fixture(),packets=new AdmissionPackets(f.db as any,{} as any);const created=await packets.create('staff','packet',input);assert.equal(created.completed,false);assert.equal(created.items.length,2);assert.equal((await packets.create('staff','packet',input)).id,'packet');assert.equal((await packets.list('staff','100','TEST')).items.length,1);
 f.rows['workforceFieldVisits/a'].state=f.rows['workforceFieldVisits/b'].state='signed';assert.equal((await new AdmissionPackets(f.db as any,{} as any).get('staff','packet')).completed,true);
 f.rows['workforceFieldVisits/b'].memberId='OTHER';await assert.rejects(packets.get('staff','packet'),/packet_changed/);
});
test('packet creation rejects foreign members and exports nothing until every form is signed',async()=>{
 const f=fixture();let exports=0;const packets=new AdmissionPackets(f.db as any,{pdf:async()=>{exports++;const pdf=await PDFDocument.create();pdf.addPage();return Buffer.from(await pdf.save());}});await assert.rejects(packets.create('staff','foreign',{...input,office:'200'}),/workforce_forbidden/);await assert.rejects(packets.create('staff','wrong',{...input,memberId:'OTHER'}),/packet_changed/);await packets.create('staff','packet',input);await assert.rejects(packets.pdf('staff','packet'),/form_not_complete/);assert.equal(exports,0);
 f.rows['workforceFieldVisits/a'].state=f.rows['workforceFieldVisits/b'].state='signed';assert.equal((await PDFDocument.load(await packets.pdf('staff','packet'))).getPageCount(),2);assert.equal(exports,2);f.rows['workforceStaff/staff'].active=false;await assert.rejects(packets.get('staff','packet'),/workforce_forbidden/);
});

test('completed admission links require their own code and a current office grant',async()=>{
 const f=fixture(),pdf=await PDFDocument.create();pdf.addPage();
 const packets=new AdmissionPackets(f.db as any,{pdf:async()=>Buffer.from(await pdf.save())});
 await packets.create('staff','packet',input);
 await assert.rejects(packets.share('staff','packet','email'),/form_not_complete/);
 for(const id of input.documentIds)Object.assign(f.rows['workforceFieldVisits/'+id],{kind:'upload',templateId:'blank-template',state:'signed'});
 const email=await packets.share('staff','packet','email'),sms=await packets.share('staff','packet','sms');
 assert.notEqual(email.token,sms.token);
 assert.equal((await PDFDocument.load(await packets.sharedPdf(email.token,email.code))).getPageCount(),2);
 const wrong=email.code==='123456'?'000000':'123456';
 for(let i=0;i<5;i++)await assert.rejects(packets.sharedPdf(email.token,wrong),/copy_unavailable/);
 await assert.rejects(packets.sharedPdf(email.token,email.code),/copy_unavailable/);
 f.rows['workforceStaff/staff'].active=false;
 await assert.rejects(packets.sharedPdf(sms.token,sms.code),/workforce_forbidden/);
 f.rows['workforceStaff/staff'].active=true;
 for(const [id,row] of Object.entries(f.rows))if(id.startsWith('workforceAdmissionShares/'))row.expiresAt=new Date(0).toISOString();
 await assert.rejects(packets.sharedPdf(sms.token,sms.code),/copy_unavailable/);
 f.rows['workforceFieldVisits/b'].kind='orientation';
 await assert.rejects(packets.share('staff','packet','sms'),/admission_forms_only/);
});
