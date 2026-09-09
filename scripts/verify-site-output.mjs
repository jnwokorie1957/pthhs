import fs from 'node:fs/promises';
import path from 'node:path';

const publicDir = path.join(process.cwd(), 'public');

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

const failures = [];
for (const file of await walk(publicDir)) {
  const html = await fs.readFile(file, 'utf8');
  const rel = path.relative(publicDir, file);

  if (/data-map-address=["']\s*<a\b/i.test(html)) {
    failures.push(`${rel}: nested anchor leaked into data-map-address`);
  }
  if (/11602 Burdine St, Suite A[^<]{0,80}["']\s+href=["']https:\/\/www\.google\.com\/maps/i.test(html)) {
    failures.push(`${rel}: raw href text appears after the street address`);
  }
  if (html.includes('11602 Burdine St') && !/class=["']address-link["']/i.test(html)) {
    failures.push(`${rel}: street address is present but is not linked`);
  }
}

if (failures.length) {
  console.error('Site output verification failed:\n' + failures.join('\n'));
  process.exit(1);
}

console.log('Verified generated HTML: address links are valid and no raw anchor attributes leaked into page text.');
