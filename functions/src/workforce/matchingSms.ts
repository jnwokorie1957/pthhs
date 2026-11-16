import {getApp} from 'firebase-admin/app';
import {TwilioRestAdapter,type NotificationDeliveryAdapter,type TwilioConfig} from '../revisions/notifications.js';
import {WorkforceError} from './policy.js';
// A distinct opening-alert gate; visit-reminder approvals never enable this.
export async function opportunitySms(enabled:boolean,request:typeof fetch=fetch):Promise<NotificationDeliveryAdapter|undefined>{
 if(!enabled)return undefined;
 try{const credential=getApp().options.credential;if(!credential)throw Error();const token=(await credential.getAccessToken()).access_token;
  const response=await request('https://secretmanager.googleapis.com/v1/projects/primetimehomehealthservices/secrets/primetime-sms-credentials/versions/latest:access',{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error();const text=await response.text();if(text.length>24000)throw Error();const payload=JSON.parse(text).payload?.data;if(typeof payload!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)||payload.length>16000)throw Error();const parsed=JSON.parse(Buffer.from(payload,'base64').toString('utf8'));if(!parsed||Object.keys(parsed).some(k=>!['accountSid','authToken','from','messagingServiceSid'].includes(k)))throw Error();
  // Keep accepted distinct from delivered; ambiguous sends are never retried.
  return new TwilioRestAdapter(parsed as TwilioConfig,request);
 }catch{throw new WorkforceError(503,'matching_sms_setup_required');}
}
