import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Normalize workforce authoring line endings before hashing, so Windows-created
// references match canonical Git/Linux bytes. Never inject marketing analytics.
export function buildWorkforceAssets({ root = process.cwd(), check = false } = {}) {
  for (const path of ['public/caregiver.html', 'public/primetime/workforce.html', 'public/home-care-careers.html']) {
    const target = resolve(root, path), before = readFileSync(target, 'utf8');
    const after = before.replace(/(\/assets\/[^"?]+\.(?:css|js))(?:\?v=[^"']*)?/g, (_, asset) => {
      const file = resolve(root, 'public' + asset);
      let bytes = readFileSync(file);
      if (asset.startsWith('/assets/workforce')) {
        const normalized = Buffer.from(bytes.toString('utf8').replace(/\r\n?/g, '\n'));
        if (check && !bytes.equals(normalized)) throw Error('Noncanonical workforce source line endings: ' + asset);
        if (!check && !bytes.equals(normalized)) writeFileSync(file, normalized);
        bytes = normalized;
      }
      return asset + '?v=' + createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    });
    if (check && before !== after) throw Error('Stale workforce assets: ' + path);
    if (!check && before !== after) writeFileSync(target, after);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  buildWorkforceAssets({ check: process.argv.includes('--check') });
  console.log('WORKFORCE_ASSETS: CURRENT');
}
