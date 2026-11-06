import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
const read = p => fs.readFileSync(new URL('../'+p, import.meta.url),'utf8');
const context = vm.createContext({ URLSearchParams });
vm.runInContext(read('public/assets/workforce-contract.js'), context);
const contract = context.WorkforceContract;
test('phone numbers format area codes consistently while preserving international/extension values',()=>{
 assert.equal(contract.formatPhone('7135551234'),'(713) 555-1234');
 assert.equal(contract.formatPhone('1 713 555 1234'),'+1 (713) 555-1234');
 assert.equal(contract.formatPhone('(713) 555-1234'),'(713) 555-1234');
 assert.equal(contract.formatPhone(''),'');
 assert.equal(contract.formatPhone('+44 20 1234 5678'),'+44 20 1234 5678');
 const input={value:'123',selectionStart:3,setSelectionRange(start){this.selectionStart=start;}};
 contract.formatPhoneInput(input);assert.equal(input.value,'(123)');assert.equal(input.selectionStart,4);
});
test('free review navigation requires the local preview session and cannot be enabled for live applicants', () => {
  for(const host of ['localhost','127.0.0.1','[::1]']) { assert.equal(contract.reviewNavigationAllowed(host,true),true); assert.equal(contract.reviewNavigationAllowed(host,false),false); }
  for(const host of ['pthhs.net','www.pthhs.net','localhost.example.com','']) assert.equal(contract.reviewNavigationAllowed(host,true),false);
  assert.equal(contract.reviewNavigationAllowed('localhost','true'),false);
});
test('opportunity selection survives sign-in without accepting external redirect destinations', () => {
  assert.equal(contract.returnPath('?opportunity=synthetic-123&returnTo=https://example.invalid'), '/caregiver?opportunity=synthetic-123');
  for (const id of ['https://example.invalid','//example.invalid','../primetime','<script>', 'a/b','']) assert.equal(contract.returnPath('?opportunity='+encodeURIComponent(id)), '/caregiver');
});
test('ZIP, area, schedule, hours and type filters compose', () => {
  const o = {location:'Synthetic area',recruitingZip:'77000',weeklyHours:20,schedule:'weekdays',type:'assignment'};
  assert.equal(contract.matches(o,{zip:'77000',location:'SYNTHETIC',hours:'20',schedule:'weekdays',type:'assignment'}),true);
  for(const f of [{zip:'77001'},{location:'Other'},{hours:'21'},{schedule:'weekends'},{type:'employment'}]) assert.equal(contract.matches(o,f),false);
  assert.equal(contract.matches({...o,recruitingZip:''},{zip:'77000'}),false);
});
test('existing Careers URL, homeowner sign-in entry and staff entry remain reachable', () => {
  assert.match(read('public/index.html'),/href="\/caregiver">Caregiver Sign In/);
  assert.match(read('public/home-care-careers.html'),/https:\/\/pthhs.net\/home-care-careers/);
  assert.match(read('public/home-care-careers.html'),/Sign in to view openings/);
  assert.doesNotMatch(read('public/home-care-careers.html'),/id="opportunity-filters"|id="opportunity-list"/);
  assert.match(read('source/primetime/index.html'),/href="\/primetime\/workforce"/);
  assert.match(read('public/primetime/workforce.html'),/id="staff-editor"/);
});

test('caregiver account screens use a dedicated portal without marketing navigation',()=>{
 const page=read('public/caregiver.html');assert.match(page,/class="portal-header"/);assert.match(page,/Caregiver portal/);
 assert.doesNotMatch(page,/class="site-nav"|class="site-header"|class="account-story"|assets\/site-enhancements|href="\/home-care-services"/);
 assert.match(page,/id="account-back"/);assert.match(page,/id="account-tabs"/);
});
test('client database and document access stay denied; application/document collection has closed release gates', () => {
  for(const path of ['firestore.rules','storage.rules']) assert.match(read(path),/allow read, write: if false/);
  const backend = read('functions/src/workforce/http.ts');
  for (const gate of ['WORKFORCE_APPLICANT_COLLECTION_APPROVED','WORKFORCE_PACKET_REVIEW_APPROVED','WORKFORCE_ID_DOCUMENTS_APPROVED','WORKFORCE_ID_RETENTION_APPROVED']) assert.ok(backend.includes(`defineString("${gate}", { default: "false" })`));
  assert.doesNotMatch(backend,/adp|CreateCaregiver|UpdateCaregiver/);
  assert.doesNotMatch(read("functions/src/workforce/hhaDirectory.ts"),/CreateCaregiver|UpdateCaregiver|\.mutate\(/);
  for(const path of ['public/caregiver.html','public/primetime/workforce.html']) {
    assert.doesNotMatch(read(path),/assets\/analytics|routing.number|bank.account/i);
    assert.match(read(path),/noindex,nofollow,noarchive/);
  }
  assert.match(read('public/assets/workforce-camera.js'),/getUserMedia/);
  assert.match(read('public/assets/workforce-camera.js'),/audio: false/);
  assert.doesNotMatch(read('public/caregiver.html'),/Save Photo ID|Save Social Security card|capture="environment"/);
  for (const kind of ['identity','social_security']) assert.match(read('public/caregiver.html'),new RegExp(`id="${kind}-file" type="file"`));
  assert.match(read('public/caregiver.html'),/id="private-documents"/);
});
test('new API uses existing project and preserves legacy routing and security boundary', () => {
  const config = JSON.parse(read('firebase.json'));
  const csp=source=>config.hosting.headers.find(rule=>rule.source===source).headers.find(header=>header.key==='Content-Security-Policy').value;
  assert.match(csp('/caregiver'),/frame-src 'self' https:\/\/primetimehomehealthservices\.firebaseapp\.com;/);
  assert.match(csp('/caregiver'),/frame-ancestors 'none'/);assert.match(csp('**'),/frame-src 'none'/);
  for(const path of ['/caregiver/workforce-api/**','/primetime/workforce-api/**']) assert.equal(config.hosting.rewrites.find(r=>r.source===path).function.functionId,'workforceApi');
  assert.equal(config.hosting.rewrites.find(r=>r.source==='/primetime/api/**').function.functionId,'primetimeApi');
  assert.match(read('functions/src/index.ts'),/principal = await requirePrimetimeAdmin\(request\)/);
});
test('build pruning explicitly retains all workforce runtime assets', () => {
  for (const asset of ['workforce-management-auth.js','workforce-hha.js','workforce-management.css','workforce-management.js','workforce.css','workforce.js','workforce-contract.js','workforce-session.js','workforce-staff.js','workforce-application.js','workforce-personnel.js','workforce-address.js','workforce-readings.js','workforce-forms.js','workforce-form-fields.js','workforce-form-layout.css']) {
    assert.ok(read('scripts/accessibility_foundation.py').includes('assets/'+asset));
    assert.ok(read('scripts/verify_accessibility_foundation.py').includes('assets/'+asset));
  }
  assert.ok(read('scripts/site-scope.mjs').includes("relative === 'caregiver.html'"));
  assert.ok(read('scripts/site_scope.py').includes('relative == "caregiver.html"'));
});
test('sensitive application data has no browser persistence or analytics sink', () => {
  for (const asset of ['workforce-application.js','workforce-personnel.js']) assert.doesNotMatch(read('public/assets/'+asset),/localStorage|sessionStorage|console\.|gtag|analytics|innerHTML/);
  assert.match(read('public/assets/workforce-camera.js'),/URL\.revokeObjectURL/);
  const storage = read('functions/src/workforce/intakeStore.ts');
  assert.doesNotMatch(storage,/makePublic|getSignedUrl|firebaseStorageDownloadTokens|originalFilename/);
  assert.match(storage,/generation: record.generation/);
});

test('complete role reading and dedicated document/form steps remain available', () => {
  const html = read('public/caregiver.html');
  for (const id of ['job-description-step','job-description-text','job-description-read','job-description-questions','official-forms']) assert.ok(html.includes(`id="${id}"`));
  assert.match(html,/accept="image\/jpeg,image\/png,application\/pdf"/);
  assert.match(html,/id="complete-i9"/);
  assert.match(html,/id="complete-w4"/);
  assert.doesNotMatch(html,/private-document-kind|return-i9|return-w4|Completed Form [IW]-[49]/);
  const formsArea=html.slice(html.indexOf('id="official-forms"'),html.indexOf('id="application-navigation"'));
  assert.doesNotMatch(formsArea,/type="file"|Upload completed/);
  const manifest = JSON.parse(read('public/assets/forms/manifest.json'));
  const w4 = manifest.forms.find(f => f.id === 'w4-2026');
  const bytes = fs.readFileSync(new URL('../public'+w4.file,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),w4.sha256);
  assert.match(bytes.subarray(0,8).toString(),/^%PDF-/);
});
