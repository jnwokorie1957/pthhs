import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
initializeApp({projectId:process.env.GOOGLE_CLOUD_PROJECT});
const db=getFirestore(),bucket=getStorage().bucket(process.env.WORKFORCE_SCAN_BUCKET);
const pending=await db.collection('workforcePrivateDocuments').where('state','==','pending_security_review').limit(100).get();
const candidates=pending.docs.filter(d=>Number(d.data().scanRetryAt||0)<Date.now()).slice(0,15);
if(candidates.length){
 const directory='/var/lib/clamav';await fs.mkdir(directory,{recursive:true});
 // Only signed, official antivirus databases enter this cache. No caregiver bytes are written to disk.
 for(const name of ['main.cvd','daily.cvd','daily.cld','bytecode.cvd','bytecode.cld','freshclam.dat']){
  try{await bucket.file('workforce-scanner-definitions/'+name).download({destination:directory+'/'+name,validation:'crc32c'});}catch(error){if(error.code!==404)throw Error('Scanner definition cache unavailable.');}
 }
 await fs.writeFile('/tmp/freshclam.conf','DatabaseDirectory '+directory+'\nDatabaseOwner root\nDatabaseMirror database.clamav.net\nMaxAttempts 2\nConnectTimeout 20\nReceiveTimeout 60\n');
 const update=spawnSync('/usr/bin/freshclam',['--config-file=/tmp/freshclam.conf','--stdout'],{stdio:'ignore',timeout:240000});
 // A failed update can use a valid cached database; clamscan independently refuses definitions older than two days.
 if(update.status===0)for(const name of await fs.readdir(directory))if(/^(main|daily|bytecode)\.(cvd|cld)$|^freshclam\.dat$/.test(name))await bucket.upload(directory+'/'+name,{destination:'workforce-scanner-definitions/'+name,metadata:{cacheControl:'private, no-store'}});
 let cleared=0,held=0;
 for(const doc of candidates){
  const claimed=await db.runTransaction(async tx=>{const current=(await tx.get(doc.ref)).data();if(current?.state!=='pending_security_review'||Number(current.scanRetryAt||0)>Date.now())return false;tx.update(doc.ref,{scanRetryAt:Date.now()+1800000});return true;});
  if(!claimed)continue;
  const result=spawnSync(process.execPath,['scripts/scan-workforce-pdf.mjs',doc.id],{stdio:'ignore',timeout:110000});
  if(result.status===0)cleared++;else{held++;await doc.ref.update({scanRetryAt:Date.now()+900000});}
 }
 console.log(JSON.stringify({screened:cleared,held}));if(held)process.exitCode=1;
}else console.log(JSON.stringify({screened:0,held:0}));
