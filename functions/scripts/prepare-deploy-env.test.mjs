import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { deploymentEnvironment } from './prepare-deploy-env.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const index = read('../src/index.ts');
const config = read('../src/integrations/hhaexchange/config.ts');
const wsdl = read('../../hharefs/hha-wdsl.xml');

test('noninteractive deployment supplies every approval as false and the captured endpoint', () => {
  const values = Object.fromEntries(deploymentEnvironment(index, config, wsdl).trim().split('\n').map(line => line.split('=')));
  assert.equal(Object.keys(values).length, 25);
  assert.equal(values.HHAEXCHANGE_BASE_URL, 'https://cloud.hhaexchange.com/Integration/ENT/V1.8/ws.asmx');
  for (const [key, value] of Object.entries(values)) if (key.startsWith('PRIMETIME_')) assert.equal(value, 'false');
  assert.equal(values.HHAEXCHANGE_CREDENTIALS, undefined);
});
test('changed, missing or newly added approval defaults require review', () => {
  assert.throws(() => deploymentEnvironment(index.replace('default: "false"', 'default: "true"'), config, wsdl), /Unsafe/);
  assert.throws(() => deploymentEnvironment(index.replaceAll('PRIMETIME_OPERATIONAL_DATA_APPROVED', 'REMOVED'), config, wsdl), /inventory/);
  assert.throws(() => deploymentEnvironment(index + '\nPRIMETIME_NEW_WRITE_APPROVED', config, wsdl), /inventory/);
});
test('unverified or missing HHA endpoint cannot be deployed', () => {
  assert.throws(() => deploymentEnvironment(index, config.replace('cloud.hhaexchange.com', 'other.example'), wsdl), /endpoint/);
  assert.throws(() => deploymentEnvironment(index, config, ''), /endpoint/);
});
