import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { deploymentEnvironment, READ_AND_REMINDER_APPROVALS } from './prepare-deploy-env.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const index = read('../src/index.ts');
const config = read('../src/integrations/hhaexchange/config.ts');
const wsdl = read('../../hharefs/hha-wdsl.xml');
const closedRelease = () => JSON.parse(read('../deployment-approvals.json'));
const releaseWith = (...enabled) => ({ ...closedRelease(), reviewReference: enabled.length ? 'agency-review-2026-10-14' : '',
  approvals: Object.fromEntries(READ_AND_REMINDER_APPROVALS.map(name => [name, enabled.includes(name)])) });
const data = 'PRIMETIME_OPERATIONAL_DATA_APPROVED', source = 'PRIMETIME_REVISION_SOURCE_APPROVED', monitor = 'PRIMETIME_REVISION_MONITOR_APPROVED';
const capability = 'PRIMETIME_SMS_CAPABILITY_APPROVED', configuration = 'PRIMETIME_SMS_CONFIGURATION_APPROVED', send = 'PRIMETIME_SMS_SEND_APPROVED';
const environment = release => Object.fromEntries(deploymentEnvironment(index, config, wsdl, release).trim().split('\n').map(line => line.split('=')));

test('noninteractive deployment supplies every approval as false and the captured endpoint', () => {
  const values = Object.fromEntries(deploymentEnvironment(index, config, wsdl).trim().split('\n').map(line => line.split('=')));
  assert.equal(Object.keys(values).length, 30);
  assert.equal(values.HHAEXCHANGE_BASE_URL, 'https://cloud.hhaexchange.com/Integration/ENT/V1.8/ws.asmx');
  for (const [key, value] of Object.entries(values)) if (key.startsWith('PRIMETIME_')) assert.equal(value, 'false');
  assert.equal(values.HHAEXCHANGE_CREDENTIALS, undefined);
});
test('changed, missing or newly added approval defaults require review', () => {
  assert.throws(() => deploymentEnvironment(index.replace('default: "false"', 'default: "true"'), config, wsdl), /Unsafe/);
  assert.throws(() => deploymentEnvironment(index.replaceAll('PRIMETIME_OPERATIONAL_DATA_APPROVED', 'REMOVED'), config, wsdl), /inventory/);
  assert.throws(() => deploymentEnvironment(index + '\nPRIMETIME_NEW_WRITE_APPROVED', config, wsdl), /inventory/);
  assert.throws(() => deploymentEnvironment(index.replaceAll('PRIMETIME_SMS_SEND_APPROVED', 'PRIMETIME_NEW_WRITE_APPROVED'), config, wsdl), /inventory/);
});
test('unverified or missing HHA endpoint cannot be deployed', () => {
  assert.throws(() => deploymentEnvironment(index, config.replace('cloud.hhaexchange.com', 'other.example'), wsdl), /endpoint/);
  assert.throws(() => deploymentEnvironment(index, config, ''), /endpoint/);
});

test('checked-in approval configuration preserves the default closed release', () => {
  const release = closedRelease();
  assert.equal(release.version, 1);
  assert.equal(release.reviewReference, '');
  assert.deepEqual(Object.keys(release.approvals).sort(), [...READ_AND_REMINDER_APPROVALS].sort());
  assert.ok(Object.values(release.approvals).every(value => value === false));
  assert.equal(deploymentEnvironment(index, config, wsdl, release), deploymentEnvironment(index, config, wsdl));
});

test('reviewed read-only release survives preparation while every mutation stays closed', () => {
  const release = releaseWith(data, source), before = structuredClone(release);
  const values = environment(release);
  assert.deepEqual(release, before);
  assert.equal(values[data], 'true'); assert.equal(values[source], 'true');
  assert.ok(Object.entries(values).filter(([name]) => name.startsWith('PRIMETIME_') && ![data, source].includes(name)).every(([, value]) => value === 'false'));
  assert.equal(values.reviewReference, undefined);
  assert.ok(!deploymentEnvironment(index, config, wsdl, release).includes(release.reviewReference));
});

test('accepted monitor and provider configuration do not imply send approval', () => {
  const values = environment(releaseWith(data, source, monitor, capability, configuration));
  assert.equal(values[send], 'false');
  assert.equal(Object.values(values).filter(value => value === 'true').length, 5);
});

test('only the six reviewed read/reminder flags can be enabled', () => {
  const values = environment(releaseWith(...READ_AND_REMINDER_APPROVALS));
  assert.equal(Object.values(values).filter(value => value === 'true').length, 6);
  for (const [name, value] of Object.entries(values)) if (name.startsWith('PRIMETIME_') && !READ_AND_REMINDER_APPROVALS.includes(name)) assert.equal(value, 'false');
});

test('unknown or missing keys and schema versions are rejected', () => {
  const unknownFlag = closedRelease(); unknownFlag.approvals.PRIMETIME_RATE_WRITE_APPROVED = true;
  const missingFlag = closedRelease(); delete missingFlag.approvals[data];
  const unknownTop = { ...closedRelease(), authToken: 'not-accepted' };
  const missingTop = closedRelease(); delete missingTop.reviewReference;
  for (const value of [unknownFlag, missingFlag, unknownTop, missingTop, { ...closedRelease(), version: 2 }, { ...closedRelease(), approvals: [] }, null, []]) {
    assert.throws(() => environment(value), /schema/);
  }
});

test('string true and other non-boolean activation values are rejected', () => {
  for (const value of ['true', 'false', 1, 0, null, undefined]) {
    const release = closedRelease(); release.approvals[data] = value;
    assert.throws(() => environment(release), /schema/);
  }
});

test('enabled stages require a nonempty bounded review reference', () => {
  for (const reference of ['', ' ', ' leading', 'trailing ', 'x'.repeat(501), 'bad\nreference', null, 42]) {
    const release = releaseWith(data); release.reviewReference = reference;
    assert.throws(() => environment(release), /review reference/);
  }
  const release = closedRelease(); release.reviewReference = 'unused-old-review';
  assert.throws(() => environment(release), /review reference/);
});

test('source and monitor stages require their scoped data prerequisites', () => {
  for (const enabled of [[source], [monitor], [data, monitor], [source, monitor], [capability], [data, capability]]) {
    assert.throws(() => environment(releaseWith(...enabled)), /dependencies/);
  }
  assert.equal(environment(releaseWith(data))[data], 'true');
  assert.equal(environment(releaseWith(data, source, monitor))[monitor], 'true');
});

test('SMS configuration requires capability and sending requires every other reviewed stage', () => {
  assert.throws(() => environment(releaseWith(data, source, configuration)), /dependencies/);
  for (const omitted of READ_AND_REMINDER_APPROVALS.filter(name => name !== send)) {
    assert.throws(() => environment(releaseWith(...READ_AND_REMINDER_APPROVALS.filter(name => name !== omitted))), /dependencies/);
  }
  assert.equal(environment(releaseWith(...READ_AND_REMINDER_APPROVALS))[send], 'true');
});
