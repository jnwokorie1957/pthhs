import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function deploymentEnvironment(index, config, wsdl) {
  const names = [...new Set(index.match(/PRIMETIME_[A-Z_]+_APPROVED/g) ?? [])].sort();
  if (!names.includes('PRIMETIME_OPERATIONAL_DATA_APPROVED') || names.length !== 24) {
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
  return [`HHAEXCHANGE_BASE_URL=${endpoint}`, ...names.map(name => `${name}=false`)].join('\n') + '\n';
}

const root = fileURLToPath(new URL('../..', import.meta.url));
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const content = deploymentEnvironment(
    readFileSync(path.join(root, 'functions/src/index.ts'), 'utf8'),
    readFileSync(path.join(root, 'functions/src/integrations/hhaexchange/config.ts'), 'utf8'),
    readFileSync(path.join(root, 'hharefs/hha-wdsl.xml'), 'utf8'),
  );
  // Fresh CI checkout only: never overwrite an operator's existing configuration.
  writeFileSync(path.join(root, 'functions/.env.primetimehomehealthservices'), content, { flag: 'wx', mode: 0o600 });
  console.log('Prepared non-secret deployment parameters: verified ENT endpoint; all 24 approval gates false.');
}
