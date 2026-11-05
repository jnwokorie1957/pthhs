import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
// These private entry pages are excluded from marketing generators. Version
// their immutable-cache assets explicitly; never inject marketing analytics.
const check = process.argv.includes('--check');
for (const path of ['public/caregiver.html', 'public/primetime/workforce.html']) {
  const before = readFileSync(path, 'utf8');
  const after = before.replace(/(\/assets\/[^"?]+\.(?:css|js))(?:\?v=[^"']*)?/g, (_, asset) =>
    asset + '?v=' + createHash('sha256').update(readFileSync('public' + asset)).digest('hex').slice(0, 12));
  if (check && before !== after) throw Error('Stale workforce assets: ' + path);
  if (!check && before !== after) writeFileSync(path, after);
}
console.log('WORKFORCE_ASSETS: CURRENT');
