import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('immutable Primetime assets have current content versions', () => {
  const html = readFileSync(new URL('../public/primetime/index.html', import.meta.url), 'utf8');
  for (const name of ['primetime.css', 'primetime.js', 'workspace.js']) {
    const bytes = readFileSync(new URL(`../public/primetime/${name}`, import.meta.url));
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    assert.ok(html.includes(`/primetime/${name}?v=${hash}`), `Run node scripts/version-primetime-assets.mjs after editing ${name}`);
  }
});

test('dashboard inventory covers exactly the captured SOAP contract', () => {
  const xml = readFileSync(new URL('../hharefs/hha-wdsl.xml', import.meta.url), 'utf8');
  const contract = new Set([...xml.matchAll(/<wsdl:operation name="([^"]+)"/g)].map(match => match[1]));
  const catalog = JSON.parse(readFileSync(new URL('../public/primetime/hha-capabilities.json', import.meta.url), 'utf8'));
  assert.equal(catalog.count, 222);
  assert.ok(catalog.items.every(item => typeof catalog.areas[item.area] === "string" && typeof catalog.implementationStates[item.implementation] === "string" && typeof catalog.guideStatuses[item.guideStatus] === "string"));
  assert.deepEqual(new Set(catalog.items.map(item => item.name)), contract);
  assert.equal(catalog.items.filter(item => item.executable).length, 1);
  assert.equal(catalog.items.find(item => item.executable).name, 'GetCollectionStatus');
  assert.equal(catalog.items.filter(item => item.kind === 'Consequential write').length, 60);
  assert.equal(catalog.items.filter(item => catalog.guideStatuses[item.guideStatus].startsWith('Absent')).length, 21);
  assert.equal(catalog.items.filter(item => catalog.guideStatuses[item.guideStatus].startsWith('Removed')).length, 4);
  assert.deepEqual(catalog.items.filter(item => item.writeExecutable).map(item => item.name), ['AddCaregiverDocument', 'AddCaregiverPermanentWeekAvailability', 'AddCaregiverRate', 'AddCaregiverSpecialAvailability', 'AddCollectionNote', 'AddPatientContract', 'AddPatientDocument', 'ChangeCaregiverDocument', 'ChangePatientDocument', 'CreateCaregiverMedical', 'CreateInserviceTopics', 'CreatePatientNote', 'CreateReferralSource', 'UpdateCaregiverDocument', 'UpdateCaregiverPermanentWeekAvailability', 'UpdateCaregiverRate', 'UpdateCaregiverSpecialAvailability', 'UpdateDocumentType', 'UpdatePatientClinicalInfo', 'UpdatePatientContract', 'UpdatePatientDocument', 'UploadCaregiverPicture']);
  assert.deepEqual(Object.keys(catalog.prerequisites).sort(), ['CreateCaregiver','CreatePatient','CreatePatientAuthorization','CreateSchedule','UpdateLinkedSchedule','UpdateSchedule']);
  for (const name of Object.keys(catalog.prerequisites)) { const item = catalog.items.find(row => row.name === name); assert.equal(Boolean(item.writeExecutable), false); assert.equal(Boolean(item.writePrepared), false); assert.ok(catalog.prerequisites[name].length > 80); }
  const linked = catalog.items.find(item => item.name === 'CreateLinkedSchedule'); assert.equal(linked.writePrepared, true); assert.equal(Boolean(linked.writeExecutable), false);
  const reads = readFileSync(new URL('../functions/src/operations/reads.ts', import.meta.url), 'utf8').match(/READ_OPERATIONS = \[(.*?)\]/s)[1];
  const operations = new Set([...reads.matchAll(/"([A-Za-z0-9]+)"/g)].map(match => match[1]));
  assert.deepEqual(new Set(catalog.items.filter(item => item.workspaceRead).map(item => item.name)), operations);
  const html = readFileSync(new URL('../public/primetime/index.html', import.meta.url), 'utf8');
  const select = html.match(/<select id="readOperation">([\s\S]*?)<\/select>/)[1];
  assert.deepEqual(new Set([...select.matchAll(/<option value="([^"]+)"/g)].map(match => match[1])), operations, 'Every typed read needs a dashboard control');
});
