import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
const read = p => fs.readFileSync(new URL('../'+p, import.meta.url),'utf8');
const context = vm.createContext({ URLSearchParams });
vm.runInContext(read('public/assets/workforce-contract.js'), context);
const contract = context.WorkforceContract;
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
  assert.match(read('public/home-care-careers.html'),/id="opportunity-filters"/);
  assert.match(read('source/primetime/index.html'),/href="\/primetime\/workforce"/);
  assert.match(read('public/primetime/workforce.html'),/id="staff-editor"/);
});
test('client database and document access stay denied; application/document collection has closed release gates', () => {
  for(const path of ['firestore.rules','storage.rules']) assert.match(read(path),/allow read, write: if false/);
  const backend = read('functions/src/workforce/http.ts');
  for (const gate of ['WORKFORCE_APPLICANT_COLLECTION_APPROVED','WORKFORCE_PACKET_REVIEW_APPROVED','WORKFORCE_ID_DOCUMENTS_APPROVED','WORKFORCE_ID_RETENTION_APPROVED']) assert.ok(backend.includes(`defineString("${gate}", { default: "false" })`));
  assert.doesNotMatch(backend,/hhaexchange|adp/);
  for(const path of ['public/caregiver.html','public/primetime/workforce.html']) {
    assert.doesNotMatch(read(path),/assets\/analytics|routing.number|bank.account/i);
    assert.match(read(path),/noindex,nofollow,noarchive/);
  }
  assert.match(read('public/caregiver.html'),/capture="environment"/);
  assert.match(read('public/caregiver.html'),/id="document-file" type="file"/);
  assert.match(read('public/caregiver.html'),/id="private-documents"/);
});
test('new API uses existing project and preserves legacy routing and security boundary', () => {
  const config = JSON.parse(read('firebase.json'));
  for(const path of ['/caregiver/workforce-api/**','/primetime/workforce-api/**']) assert.equal(config.hosting.rewrites.find(r=>r.source===path).function.functionId,'workforceApi');
  assert.equal(config.hosting.rewrites.find(r=>r.source==='/primetime/api/**').function.functionId,'primetimeApi');
  assert.match(read('functions/src/index.ts'),/principal = await requirePrimetimeAdmin\(request\)/);
});
test('build pruning explicitly retains all workforce runtime assets', () => {
  for (const asset of ['workforce.css','workforce.js','workforce-contract.js','workforce-session.js','workforce-staff.js','workforce-application.js','workforce-personnel.js','workforce-address.js']) {
    assert.ok(read('scripts/accessibility_foundation.py').includes('assets/'+asset));
    assert.ok(read('scripts/verify_accessibility_foundation.py').includes('assets/'+asset));
  }
  assert.ok(read('scripts/site-scope.mjs').includes("relative === 'caregiver.html'"));
  assert.ok(read('scripts/site_scope.py').includes('relative == "caregiver.html"'));
});
test('sensitive application data has no browser persistence or analytics sink', () => {
  for (const asset of ['workforce-application.js','workforce-personnel.js']) assert.doesNotMatch(read('public/assets/'+asset),/localStorage|sessionStorage|console\.|gtag|analytics|innerHTML/);
  assert.match(read('public/assets/workforce-application.js'),/URL\.revokeObjectURL/);
  const storage = read('functions/src/workforce/intakeStore.ts');
  assert.doesNotMatch(storage,/makePublic|getSignedUrl|firebaseStorageDownloadTokens|originalFilename/);
  assert.match(storage,/generation: record.generation/);
});

test('complete role reading and dedicated document/form steps remain available', () => {
  const html = read('public/caregiver.html');
  for (const id of ['job-description-step','job-description-text','job-description-read','job-description-questions','official-forms']) assert.ok(html.includes(`id="${id}"`));
  assert.match(html,/accept="image\/jpeg,image\/png,application\/pdf"/);
  assert.match(html,/https:\/\/www\.uscis\.gov\/sites\/default\/files\/document\/forms\/i-9\.pdf/);
  assert.match(html,/href="\/assets\/forms\/w4-2026\.pdf"/);
  const manifest = JSON.parse(read('public/assets/forms/manifest.json'));
  const w4 = manifest.forms.find(f => f.id === 'w4-2026');
  const bytes = fs.readFileSync(new URL('../public'+w4.file,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),w4.sha256);
  assert.match(bytes.subarray(0,8).toString(),/^%PDF-/);
});
