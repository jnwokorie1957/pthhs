import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const index = new URL('../public/primetime/index.html', import.meta.url);
let html = readFileSync(index, 'utf8');
for (const name of ['primetime.css', 'primetime.js', 'workspace.js']) {
  const asset = new URL(`../public/primetime/${name}`, import.meta.url);
  // Match the repository's LF attributes before hashing bytes for Linux Hosting.
  const content = readFileSync(asset, 'utf8').replace(/\r\n/g, '\n');
  writeFileSync(asset, content);
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 12);
  html = html.replace(new RegExp(`(/primetime/${name.replace('.', '\\.')})(?:\\?v=[^"']*)?`, 'g'), `$1?v=${hash}`);
}
writeFileSync(index, html);
