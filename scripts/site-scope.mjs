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
  return relative === 'caregiver.html' || internalAppPrefixes.some((prefix) => relative.startsWith(prefix));
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


// Keep a newline between inline elements. Preserve whitespace-sensitive blocks
// after LF normalization; only layout indentation/blank lines outside are removed.
export function stripLayoutIndentation(html) {
  return html.replace(/\r\n/g, '\n').split(/(<pre\b[^>]*>[\s\S]*?<\/pre>|<textarea\b[^>]*>[\s\S]*?<\/textarea>|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>)/gi)
    .map((part, index) => index % 2 ? part : part.replace(/^[ \t]+/gm, '').replace(/^[ \t]*\r?\n/gm, ''))
    .join('');
}
