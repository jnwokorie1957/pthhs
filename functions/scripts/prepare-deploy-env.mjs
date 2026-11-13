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

const workforceFlags = ['WORKFORCE_STAFF_APPROVED','WORKFORCE_HHA_PORTAL_APPROVED','WORKFORCE_PUBLIC_OPPORTUNITIES_APPROVED','WORKFORCE_APPLICANT_COLLECTION_APPROVED','WORKFORCE_PACKET_REVIEW_APPROVED','WORKFORCE_ID_DOCUMENTS_APPROVED','WORKFORCE_ID_RETENTION_APPROVED','WORKFORCE_GOOGLE_PLACES_APPROVED','WORKFORCE_DOCUMENT_EMAIL_APPROVED','WORKFORCE_APPLICATION_EMAIL_APPROVED','WORKFORCE_HHA_APPLICANT_TRANSFER_APPROVED'];
export function workforceDeploymentEnvironment(release, source, operationalDataApproved) {
  const keys=[...workforceFlags,'WORKFORCE_SIGN_IN_PROVIDERS','WORKFORCE_INTAKE_OFFICE','WORKFORCE_EMPLOYER_EIN','WORKFORCE_PORTAL_ORIGIN','WORKFORCE_DOCUMENT_KMS_KEY','WORKFORCE_DOCUMENT_MAIL_TENANT','WORKFORCE_DOCUMENT_MAIL_CLIENT','WORKFORCE_DOCUMENT_SAMPLE_UNTIL','WORKFORCE_PORTAL_PREVIEW_UNTIL','WORKFORCE_PORTAL_LAUNCH_AT','WORKFORCE_HHA_APPLICATION_DOCUMENT_TYPE','WORKFORCE_HHA_DOCUMENT_LOOKUP_ID','WORKFORCE_HHA_APPLICANT_NOT_BEFORE'];
  if(!exactKeys(release,['version','reviewReference','environment'])||release.version!==1||!exactKeys(release.environment,keys)||typeof release.reviewReference!=='string'||!release.reviewReference.trim()||release.reviewReference.length>500||/[\x00-\x1f\x7f]/u.test(release.reviewReference))throw Error('Invalid workforce release review');
  const env=release.environment,declared=[...source.matchAll(/defineString\("(WORKFORCE_[A-Z_]+)"/g)].map(match=>match[1]);
  if(declared.length!==keys.length||keys.some(key=>!declared.includes(key))||Object.values(env).some(value=>typeof value!=='string'||/[\r\n]/u.test(value)))throw Error('Workforce parameter inventory changed');
  for(const flag of workforceFlags){if(!['true','false'].includes(env[flag])||!new RegExp(`defineString\\("${flag}",\\s*\\{\\s*default:\\s*"false"\\s*\\}\\)`).test(source))throw Error('Workforce approval must retain a closed default');}
  const enabled=key=>env[key]==='true';
  if(env.WORKFORCE_PORTAL_ORIGIN!=='https://pthhs.net'||env.WORKFORCE_INTAKE_OFFICE&&!/^[1-9]\d{0,9}$/.test(env.WORKFORCE_INTAKE_OFFICE)||env.WORKFORCE_EMPLOYER_EIN&&!/^\d{2}-\d{7}$/.test(env.WORKFORCE_EMPLOYER_EIN))throw Error('Invalid workforce public origin or office configuration');
  const providers=env.WORKFORCE_SIGN_IN_PROVIDERS?env.WORKFORCE_SIGN_IN_PROVIDERS.split(','):[];
  if(new Set(providers).size!==providers.length||providers.some(id=>!['google.com','apple.com','microsoft.com','yahoo.com'].includes(id)))throw Error('Invalid workforce sign-in providers');
  if(enabled('WORKFORCE_HHA_PORTAL_APPROVED')&&(!enabled('WORKFORCE_STAFF_APPROVED')||!operationalDataApproved||!env.WORKFORCE_INTAKE_OFFICE))throw Error('HHA portal release requires approved source and office');
  if(enabled('WORKFORCE_ID_DOCUMENTS_APPROVED')&&(!enabled('WORKFORCE_STAFF_APPROVED')||!enabled('WORKFORCE_APPLICANT_COLLECTION_APPROVED')||!enabled('WORKFORCE_PACKET_REVIEW_APPROVED')||!enabled('WORKFORCE_ID_RETENTION_APPROVED')||!env.WORKFORCE_INTAKE_OFFICE))throw Error('Identity collection prerequisites are not approved');
  if(env.WORKFORCE_DOCUMENT_KMS_KEY&&!/^projects\/primetimehomehealthservices\/locations\/us-central1\/keyRings\/[a-zA-Z0-9_-]+\/cryptoKeys\/[a-zA-Z0-9_-]+$/.test(env.WORKFORCE_DOCUMENT_KMS_KEY))throw Error('Invalid document KMS key');
  const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  for(const key of ['WORKFORCE_DOCUMENT_MAIL_TENANT','WORKFORCE_DOCUMENT_MAIL_CLIENT'])if(env[key]&&!uuid.test(env[key]))throw Error('Invalid verification mail identity');
  if(enabled('WORKFORCE_DOCUMENT_EMAIL_APPROVED')&&(!env.WORKFORCE_DOCUMENT_MAIL_TENANT||!env.WORKFORCE_DOCUMENT_MAIL_CLIENT))throw Error('Verification mail identity is not configured');
  if(env.WORKFORCE_DOCUMENT_SAMPLE_UNTIL&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(env.WORKFORCE_DOCUMENT_SAMPLE_UNTIL))throw Error('Invalid verification sample expiry');
  if(enabled('WORKFORCE_ID_DOCUMENTS_APPROVED')&&(!env.WORKFORCE_DOCUMENT_KMS_KEY||!enabled('WORKFORCE_DOCUMENT_EMAIL_APPROVED')))throw Error('Document encryption and verified email delivery prerequisites are not approved');
  for(const key of ['WORKFORCE_PORTAL_PREVIEW_UNTIL','WORKFORCE_PORTAL_LAUNCH_AT'])if(env[key]&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(env[key]))throw Error('Invalid caregiver release window');
  if(Boolean(env.WORKFORCE_PORTAL_PREVIEW_UNTIL)!==Boolean(env.WORKFORCE_PORTAL_LAUNCH_AT)||env.WORKFORCE_PORTAL_PREVIEW_UNTIL&&Date.parse(env.WORKFORCE_PORTAL_PREVIEW_UNTIL)>=Date.parse(env.WORKFORCE_PORTAL_LAUNCH_AT))throw Error('Invalid caregiver release window');
  if(enabled('WORKFORCE_HHA_APPLICANT_TRANSFER_APPROVED')&&(!enabled('WORKFORCE_HHA_PORTAL_APPROVED')||!enabled('WORKFORCE_ID_DOCUMENTS_APPROVED')||!operationalDataApproved
    ||env.WORKFORCE_INTAKE_OFFICE!=='503324'||!env.WORKFORCE_DOCUMENT_KMS_KEY||!['WORKFORCE_HHA_APPLICATION_DOCUMENT_TYPE','WORKFORCE_HHA_DOCUMENT_LOOKUP_ID'].every(key=>/^[1-9]\d{0,9}$/.test(env[key]))
    ||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(env.WORKFORCE_HHA_APPLICANT_NOT_BEFORE)||!env.WORKFORCE_PORTAL_LAUNCH_AT
    ||Date.parse(env.WORKFORCE_HHA_APPLICANT_NOT_BEFORE)<Math.max(Date.parse('2027-01-01T06:00:00.000Z'),Date.parse(env.WORKFORCE_PORTAL_LAUNCH_AT))))throw Error('HHA applicant transfer prerequisites or launch date are not approved');
  return keys.map(key=>key+'='+env[key]).join('\n')+'\n';
}

const root = fileURLToPath(new URL('../..', import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let release;
  try { release = JSON.parse(readFileSync(path.join(root, 'functions/deployment-approvals.json'), 'utf8')); }
  catch { throw new Error('Cannot read the checked-in deployment approval configuration'); }
  const legacyContent = deploymentEnvironment(
    readFileSync(path.join(root, 'functions/src/index.ts'), 'utf8'),
    readFileSync(path.join(root, 'functions/src/integrations/hhaexchange/config.ts'), 'utf8'),
    readFileSync(path.join(root, 'hharefs/hha-wdsl.xml'), 'utf8'),
    release,
  );
  const portalRelease=JSON.parse(readFileSync(path.join(root,'functions/workforce-deployment.json'),'utf8'));
  const content=legacyContent+workforceDeploymentEnvironment(portalRelease,readFileSync(path.join(root,'functions/src/workforce/http.ts'),'utf8'),reviewedApprovals(release).PRIMETIME_OPERATIONAL_DATA_APPROVED===true);
  // Fresh CI checkout only: never overwrite an operator's existing configuration.
  writeFileSync(path.join(root, 'functions/.env.primetimehomehealthservices'), content, { flag: 'wx', mode: 0o600 });
  const enabled = content.split('\n').filter(line => /^PRIMETIME_[A-Z_]+_APPROVED=true$/u.test(line)).length;
  console.log(`Prepared non-secret deployment parameters: enabled=${enabled}; closed=${29 - enabled}. Credentials excluded.`);
}
