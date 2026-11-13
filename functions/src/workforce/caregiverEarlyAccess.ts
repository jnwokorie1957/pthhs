import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';

export interface EarlyAccessRecord {uid?:string;email?:string;enabled?:boolean;expiresAt?:string;phoneNumber?:string}
interface Identity {uid:string;email?:string;emailVerified:boolean;disabled:boolean}
export function approvedEarlyAccess(uid:string,user:Identity,record:EarlyAccessRecord|undefined,now=Date.now()) {
  if(!record || record.enabled!==true || record.uid!==uid || user.uid!==uid || user.disabled || !user.emailVerified
    || !user.email || user.email.toLowerCase()!==record.email?.toLowerCase()
    || !Number.isFinite(Date.parse(record.expiresAt||'')) || now>=Date.parse(record.expiresAt!)) return null;
  return {phoneNumber:typeof record.phoneNumber==='string'&&/^\+[1-9]\d{7,14}$/.test(record.phoneNumber)?record.phoneNumber:''};
}
// Server-owned exception records never replace verified identity, office scope,
// collection approvals, recent sign-in, or document verification requirements.
export async function caregiverEarlyAccess(uid:string) {
  try {
    const [user,grant]=await Promise.all([getAuth().getUser(uid),getFirestore().collection('workforceCaregiverEarlyAccess').doc(uid).get()]);
    return approvedEarlyAccess(uid,user,grant.exists?grant.data():undefined);
  } catch { return null; }
}
