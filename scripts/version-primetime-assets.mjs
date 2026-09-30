import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const index = new URL('../public/primetime/index.html', import.meta.url);
let html = readFileSync(index, 'utf8');
for (const name of ['primetime.css', 'primetime.js', 'workspace.js']) {
  const hash = createHash('sha256').update(readFileSync(new URL(`../public/primetime/${name}`, import.meta.url))).digest('hex').slice(0, 12);
  html = html.replace(new RegExp(`(/primetime/${name.replace('.', '\\.')})(?:\\?v=[^"']*)?`, 'g'), `$1?v=${hash}`);
}
writeFileSync(index, html);
