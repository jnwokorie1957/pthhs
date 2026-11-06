import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { buildWorkforceAssets } from './build-workforce-assets.mjs';
test('Windows-authored workforce hashes stay canonical in private entries and the Careers page', () => {
  const root = mkdtempSync(join(tmpdir(), 'pthhs-workforce-assets-'));
  try {
    mkdirSync(join(root, 'public/assets'), { recursive: true });
    mkdirSync(join(root, 'public/primetime'), { recursive: true });
    const css = join(root, 'public/assets/workforce.css');
    writeFileSync(css, 'body {\r\n color: navy;\r\n}\r\n');
    const pages = ['public/caregiver.html', 'public/primetime/workforce.html', 'public/home-care-careers.html'];
    for (const p of pages) writeFileSync(join(root, p), '<link href="/assets/workforce.css?v=stale">');
    assert.throws(() => buildWorkforceAssets({ root, check: true }), /line endings/);
    buildWorkforceAssets({ root });
    const bytes = readFileSync(css), hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    assert.ok(!bytes.includes(13));
    for (const p of pages) assert.ok(readFileSync(join(root, p), 'utf8').includes('?v=' + hash));
    buildWorkforceAssets({ root, check: true });
    writeFileSync(join(root, pages[2]), '<link href="/assets/workforce.css?v=stale">');
    assert.throws(() => buildWorkforceAssets({ root, check: true }), /Stale workforce assets: public\/home-care-careers.html/);
    buildWorkforceAssets({ root });
    buildWorkforceAssets({ root, check: true });
    writeFileSync(css, 'body { color: gold; }\n');
    assert.throws(() => buildWorkforceAssets({ root, check: true }), /Stale workforce assets/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
