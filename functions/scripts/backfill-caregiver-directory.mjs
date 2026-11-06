// Run after building functions. Default is a read-only dry run with count-only
// output. Use --write in the reviewed deployment environment to index older apps.
import {initializeApp} from 'firebase-admin/app';
import {getFirestore,FieldPath} from 'firebase-admin/firestore';
import {directoryEntry} from '../lib/workforce/directory.js';
initializeApp({projectId:'primetimehomehealthservices'});
const db=getFirestore(),write=process.argv.includes('--write');let after,count=0;
for(;;){
 let query=db.collection('workforceApplications').orderBy(FieldPath.documentId()).limit(100);if(after)query=query.startAfter(after);
 const page=await query.get();if(!page.size)break;
 if(write){await db.runTransaction(async tx=>{
  // Re-read within the transaction so an old backfill cannot replace a newer
  // projection after a caregiver changes their name or application status.
  const current=await Promise.all(page.docs.map(doc=>tx.get(doc.ref)));
  for(const doc of current)if(doc.exists){const app=doc.data();if(app.uid&&app.office&&app.answers)tx.set(db.collection('workforceCaregiverDirectory').doc(doc.id),directoryEntry(app));}
 });}
 count+=page.size;after=page.docs.at(-1);if(page.size<100)break;
}
process.stdout.write(JSON.stringify({mode:write?'write':'dry_run',applicationCount:count})+'\n');
