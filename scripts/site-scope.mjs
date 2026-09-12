import fs from 'node:fs/promises';
import path from 'node:path';

// Deployed internal applications have their own UI/runtime contracts. Marketing
// generators must leave these paths byte-for-byte untouched.
export const internalAppPrefixes = ['primetime/'];

export function relativePublicPath(file, publicDir) {
  return path.relative(publicDir, file).replaceAll(path.sep, '/');
}

export function isInternalAppFile(file, publicDir) {
  const relative = relativePublicPath(file, publicDir);
  return internalAppPrefixes.some((prefix) => relative.startsWith(prefix));
}

export function isMarketingHtml(file, publicDir) {
  return file.toLowerCase().endsWith('.html') && !isInternalAppFile(file, publicDir);
}

export async function walkFiles(dir) {
  const output = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...await walkFiles(full));
    else if (entry.isFile()) output.push(full);
  }
  return output;
}

export async function marketingHtmlFiles(publicDir) {
  return (await walkFiles(publicDir))
    .filter((file) => isMarketingHtml(file, publicDir))
    .sort();
}
