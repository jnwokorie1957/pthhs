import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const READ_AND_REMINDER_APPROVALS = Object.freeze([
  'PRIMETIME_OPERATIONAL_DATA_APPROVED',
  'PRIMETIME_REVISION_SOURCE_APPROVED',
  'PRIMETIME_REVISION_MONITOR_APPROVED',
  'PRIMETIME_SMS_CAPABILITY_APPROVED',
  'PRIMETIME_SMS_CONFIGURATION_APPROVED',
  'PRIMETIME_SMS_SEND_APPROVED',
]);
const CLOSED_RELEASE = Object.freeze({
  version: 1,
  reviewReference: '',
  approvals: Object.freeze(Object.fromEntries(READ_AND_REMINDER_APPROVALS.map(name => [name, false]))),
});
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exactKeys = (value, keys) => plain(value) && Object.keys(value).length === keys.length
  && keys.every(key => Object.hasOwn(value, key));

function reviewedApprovals(release) {
  if (!exactKeys(release, ['version', 'reviewReference', 'approvals']) || release.version !== 1
    || !exactKeys(release.approvals, READ_AND_REMINDER_APPROVALS)
    || READ_AND_REMINDER_APPROVALS.some(name => typeof release.approvals[name] !== 'boolean')) {
    throw new Error('Invalid deployment approval schema; review the six allowed boolean parameters');
  }
  const enabled = READ_AND_REMINDER_APPROVALS.filter(name => release.approvals[name]);
  if (typeof release.reviewReference !== 'string' || release.reviewReference.length > 500
    || /[\x00-\x1f\x7f]/u.test(release.reviewReference)
    || release.reviewReference !== release.reviewReference.trim()
    || (enabled.length ? !release.reviewReference : release.reviewReference !== '')) {
    throw new Error('Deployment approval review reference must identify an enabled release and be empty for a closed release');
  }
  const has = short => release.approvals[`PRIMETIME_${short}_APPROVED`];
  if ((has('REVISION_SOURCE') || has('REVISION_MONITOR') || has('SMS_CAPABILITY') || has('SMS_CONFIGURATION') || has('SMS_SEND')) && !has('OPERATIONAL_DATA')
    || (has('REVISION_MONITOR') || has('SMS_CAPABILITY') || has('SMS_CONFIGURATION') || has('SMS_SEND')) && !has('REVISION_SOURCE')
    || (has('SMS_CONFIGURATION') || has('SMS_SEND')) && !has('SMS_CAPABILITY')
    || has('SMS_SEND') && (!has('REVISION_MONITOR') || !has('SMS_CONFIGURATION'))) {
    throw new Error('Deployment approval dependencies are inconsistent; review source, monitoring and SMS stages');
  }
  return release.approvals;
}

export function deploymentEnvironment(index, config, wsdl, release = CLOSED_RELEASE) {
  const names = [...new Set(index.match(/PRIMETIME_[A-Z_]+_APPROVED/g) ?? [])].sort();
  if (!READ_AND_REMINDER_APPROVALS.every(name => names.includes(name)) || names.length !== 29) {
    throw new Error('Deployment approval inventory changed; review before deploying');
  }
  for (const name of names) {
    const declaration = new RegExp(`defineString\\("${name}",\\s*\\{\\s*default:\\s*"false"\\s*\\}\\)`);
    if (!declaration.test(index)) throw new Error(`Unsafe or missing closed default: ${name}`);
  }
  const endpoint = config.match(/defineString\("HHAEXCHANGE_BASE_URL",\s*\{\s*default:\s*"([^"]+)"/u)?.[1];
  if (!endpoint || endpoint !== 'https://cloud.hhaexchange.com/Integration/ENT/V1.8/ws.asmx' || !wsdl.includes(`location="${endpoint}"`)) {
    throw new Error('HHA endpoint requires reviewed source and captured-contract agreement');
  }
  const approvals = reviewedApprovals(release);
  // Read/reminder activation cannot open any of the 23 HHA mutation gates.
  return [`HHAEXCHANGE_BASE_URL=${endpoint}`, ...names.map(name => `${name}=${approvals[name] === true}`)].join('\n') + '\n';
}

const root = fileURLToPath(new URL('../..', import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let release;
  try { release = JSON.parse(readFileSync(path.join(root, 'functions/deployment-approvals.json'), 'utf8')); }
  catch { throw new Error('Cannot read the checked-in deployment approval configuration'); }
  const content = deploymentEnvironment(
    readFileSync(path.join(root, 'functions/src/index.ts'), 'utf8'),
    readFileSync(path.join(root, 'functions/src/integrations/hhaexchange/config.ts'), 'utf8'),
    readFileSync(path.join(root, 'hharefs/hha-wdsl.xml'), 'utf8'),
    release,
  );
  // Fresh CI checkout only: never overwrite an operator's existing configuration.
  writeFileSync(path.join(root, 'functions/.env.primetimehomehealthservices'), content, { flag: 'wx', mode: 0o600 });
  const enabled = content.split('\n').filter(line => /^PRIMETIME_[A-Z_]+_APPROVED=true$/u.test(line)).length;
  console.log(`Prepared non-secret deployment parameters: enabled=${enabled}; closed=${29 - enabled}. Credentials excluded.`);
}
