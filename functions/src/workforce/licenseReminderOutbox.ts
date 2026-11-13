import {randomUUID} from 'node:crypto';
import {getFirestore} from 'firebase-admin/firestore';
import {chicagoDate} from './dates.js';

export class ReminderSendError extends Error {
 constructor(public safeRetry:boolean,public permanent=false,public retryAfterSeconds=900){super('reminder_transport_failed');}
}
export function reminderWindow(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now),value=(kind:string)=>Number(parts.find(p=>p.type===kind)?.value);
 return value('hour')>=8&&value('hour')<=17&&(value('hour')!==8||value('minute')>=30);
}
export async function dispatchLicenseReminder(transport:{prepareReminder():Promise<(count:number)=>Promise<void>>},count:number,evidenceHash:string,to:string,db=getFirestore(),now=()=>new Date()){
 const date=chicagoDate(now()),ref=db.collection('workforceLicenseReminderMail').doc(date),attempt=randomUUID();
 const claimed=await db.runTransaction(async tx=>{
  const old=(await tx.get(ref)).data(),time=now().getTime();
  if(old&&['accepted','unconfirmed','failed'].includes(old.status))return false;
  if(old?.status==='dispatching'){
   if(Number(old.leaseUntil||0)<=time)tx.update(ref,{status:'unconfirmed',reason:'dispatch_interrupted',leaseUntil:0});
   return false;
  }
  if(old?.leaseUntil>time||old?.nextAttemptAt>time)return false;
  if(Number(old?.attempts||0)>=3){tx.update(ref,{status:'failed',reason:'retry_limit',leaseUntil:0});return false;}
  tx.set(ref,{status:'preparing',to,count,date,evidenceHash,attempt,attempts:Number(old?.attempts||0)+1,leaseUntil:time+120000,at:now().toISOString(),nextAttemptAt:0});return true;
 });
 if(!claimed)return;
 let started=false;
 try{
  const send=await transport.prepareReminder();
  await db.runTransaction(async tx=>{const row=(await tx.get(ref)).data();if(row?.attempt!==attempt||row.status!=='preparing'||row.leaseUntil<=now().getTime())throw Error('reminder_lease_lost');tx.update(ref,{status:'dispatching',leaseUntil:now().getTime()+120000});});
  started=true;await send(count);
  await db.runTransaction(async tx=>{const row=(await tx.get(ref)).data();if(row?.attempt===attempt)tx.update(ref,{status:'accepted',leaseUntil:0,acceptedAt:now().toISOString()});});
 }catch(error){
  await db.runTransaction(async tx=>{const row=(await tx.get(ref)).data();if(row?.attempt!==attempt)return;
   const known=error instanceof ReminderSendError,safe=!started||known&&error.safeRetry,terminal=known&&error.permanent||safe&&row.attempts>=3;
   tx.update(ref,{status:safe?(terminal?'failed':'retry_wait'):'unconfirmed',reason:!started?'preparation_failed':safe?'send_rejected':'delivery_unknown',leaseUntil:0,nextAttemptAt:safe&&!terminal?now().getTime()+Math.max(900,Math.min(3600,known?error.retryAfterSeconds:900))*1000:0});
  });
 }
}
