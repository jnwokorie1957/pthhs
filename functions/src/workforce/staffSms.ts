import {createHash,randomInt,randomUUID,randomBytes} from 'node:crypto';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {WorkforceError} from './policy.js';
import {portalSmsTransport} from './matchingSms.js';

const digest=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
type Principal={uid:string;authTime:number;phone:string};
export function staffSmsAction(path:string,method:string,body:Record<string,unknown>|undefined){
 if(!path.startsWith('/staff/'))return null;
 const visit=path.match(/^\/staff\/field-visits\/([\w-]+)(?:\/(preview|pdf|sign|amend))?$/);
 if(visit&&!['templates','names','scheduled-clients'].includes(visit[1]!)){
  return {step:visit[2]||'open',label:'review this client document',record:'visit/'+visit[1],continueView:visit[2]==='preview'||visit[2]==='sign',exporting:visit[2]==='pdf'};
 }
 const send=method==='POST'&&(/^\/staff\/(?:invitations$|accounts\/[\w-]+\/reset$|roster\/\d+\/access$|applications\/[\w-]+\/hha-transfer\/recheck$|admission-packets\/[\w-]+\/share$)/.test(path)||path==='/staff/opportunities'&&['publish','submit'].includes(String(body?.action))||/\/(?:send|notify|publish|dispatch)$/.test(path));
 const document=method==='GET'&&(/^\/staff\/(?:applications\/[\w-]+(?:\/.*)?|applicants\/[\w-]+\/print|roster\/\d+\/(?:files\/\d+|records\/[a-z-]+|detail)|authorizations\/[\w-]+(?:\/document)?|admission-templates\/[\w-]+(?:\/pdf)?|admission-packets\/[\w-]+\/pdf)$/.test(path)&&!path.endsWith('/summary'));
 return send||document?{step:'single',label:send?'send from the staff portal':'open this protected document',record:'',continueView:false,exporting:true}:null;
}
export const actionBinding=(method:string,url:string,bytes:Buffer)=>digest(JSON.stringify([method,url,digest(bytes)]));
export async function staffSmsPrincipal(uid:string,authTime:number):Promise<Principal>{
 const user=await getAuth().getUser(uid);
 const enrolled=user.multiFactor?.enrolledFactors.find(f=>f.factorId==='phone') as {phoneNumber?:string}|undefined;
 const phone=enrolled?.phoneNumber||(user.providerData.some(p=>p.providerId==='phone'&&p.phoneNumber===user.phoneNumber)?user.phoneNumber:null);
 if(user.disabled||!phone||!/^\+1[2-9]\d{9}$/.test(phone))throw new WorkforceError(403,'staff_verified_phone_required');
 return {uid,authTime,phone};
}
async function sendCode(to:string,code:string,id:string){
 const sender=await portalSmsTransport().catch(()=>{throw new WorkforceError(503,'staff_sms_delivery_unavailable');});
 const result=await sender.submit({outboxId:id,attemptId:id,to,body:'Primetime staff verification code: '+code+'. Expires in 5 minutes. Enter it only in the staff portal.'});
 if(!result||!['accepted','delivered'].includes(result.state))throw new WorkforceError(503,'staff_sms_delivery_unavailable');
}
export class StaffSms {
 constructor(private db=getFirestore(),private deliver=sendCode,private now=()=>Date.now()){}
 async request(p:Principal,binding:unknown){
  if(typeof binding!=='string'||!/^[a-f0-9]{64}$/.test(binding))throw new WorkforceError(400,'invalid_request');
  const id=randomUUID(),code=String(randomInt(1_000_000)).padStart(6,'0'),at=this.now(),ref=this.db.collection('workforceStaffSms').doc(id);
  await this.db.runTransaction(async tx=>{
   const limit=this.db.collection('workforceStaffSmsLimits').doc(p.uid),before=(await tx.get(limit)).data();
   const recent=before&&at-before.start<600_000;
   if(recent&&before.count>=20)throw new WorkforceError(429,'staff_sms_limit');
   tx.set(limit,{start:recent?before.start:at,count:recent?before.count+1:1});
   tx.create(ref,{uid:p.uid,authTime:p.authTime,phoneHash:digest(p.phone),binding,codeHash:digest(id+code),attempts:0,expires:at+300_000,deleteAfter:new Date(at+3600_000)});
  });
  await this.deliver(p.phone,code,id);
  return {id,lastFour:p.phone.slice(-4)};
 }
 async consume(p:Principal,binding:string,proof:string|undefined,action:NonNullable<ReturnType<typeof staffSmsAction>>,continuation?:string){
  const [id,secret]=(proof||continuation||'').split('.');
  if(!id||!secret||!/^[-a-f0-9]{36}$/.test(id)||!(proof?/^\d{6}$/:/^[a-f0-9]{64}$/).test(secret))throw new WorkforceError(403,'invalid_staff_code');
  const next=randomBytes(32).toString('hex'),at=this.now(),ref=this.db.collection('workforceStaffSms').doc(id);
  const ok=await this.db.runTransaction(async tx=>{
   const row=(await tx.get(ref)).data();
   if(!row||row.uid!==p.uid||row.authTime!==p.authTime||row.phoneHash!==digest(p.phone)||row.expires<=at)return false;
   if(!proof){
    if(!action.continueView||!action.record||row.record!==action.record||row.viewHash!==digest(secret)||action.step==='preview'&&row.previewUsed)return false;
    if(action.step==='preview')tx.update(ref,{previewUsed:true});
    else tx.update(ref,{viewHash:digest(next),previewUsed:false});
    return true;
   }
   if(row.used||row.binding!==binding||row.attempts>=5)return false;
   if(row.codeHash!==digest(id+secret)){tx.update(ref,{attempts:row.attempts+1});return false;}
   tx.update(ref,{used:true,codeHash:'',record:action.record,previewUsed:action.step==='preview',viewHash:action.record&&!action.exporting?digest(next):''});
   tx.create(this.db.collection('workforcePersonnelAudit').doc(),{actor:p.uid,action:'staff_sms_verified',at:new Date(at).toISOString(),binding});
   return true;
  });
  if(!ok)throw new WorkforceError(403,'invalid_staff_code');
  return (proof||action.step==='sign')&&action.record&&!action.exporting?id+'.'+next:null;
 }
}
