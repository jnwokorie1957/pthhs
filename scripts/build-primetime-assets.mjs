import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { minify } from 'terser';

export const PRIMETIME_ASSETS = Object.freeze([
  'primetime.css', 'data-source.js', 'demo-data.js', 'dashboard.js',
  'revisions.js', 'primetime.js', 'workspace.js', 'forms.js'
]);

const defaultSource = fileURLToPath(new URL('../source/primetime/', import.meta.url));
const defaultOutput = fileURLToPath(new URL('../public/primetime/', import.meta.url));
const lf = text => text.replace(/\r\n?/g, '\n');

// Only local identifiers change. Compression and property renaming stay off;
// function/class names and the public DOM/API contracts remain intact.
const minifierOptions = Object.freeze({
  compress: false,
  mangle: { toplevel: false },
  keep_fnames: true,
  keep_classnames: true,
  format: { comments: 'some', quote_style: 3, keep_quoted_props: true }
});

export async function renderPrimetimeAssets(sourceDir = defaultSource) {
  const output = new Map();
  let html = lf(await readFile(resolve(sourceDir, 'index.html'), 'utf8'));
  for (const name of PRIMETIME_ASSETS) {
    const source = lf(await readFile(resolve(sourceDir, name), 'utf8'));
    let content = source;
    if (name.endsWith('.js')) {
      const result = await minify(source, minifierOptions);
      if (typeof result.code !== 'string') throw new Error(`No generated code for ${name}`);
      content = `/* Generated from source/primetime/${name}; run npm run build:primetime. */\n${result.code}\n`;
    }
    output.set(name, content);
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 12);
    const assetPattern = new RegExp(`(/primetime/${name.replaceAll('.', '\\.')})(?:\\?v=[^"']*)?`, 'g');
    if (!assetPattern.test(html)) throw new Error(`Missing index reference to ${name}`);
    assetPattern.lastIndex = 0;
    html = html.replace(assetPattern, `$1?v=${hash}`);
  }
  output.set('index.html', html);
  return output;
}

export async function buildPrimetimeAssets({ sourceDir = defaultSource, outputDir = defaultOutput, check = false } = {}) {
  const output = await renderPrimetimeAssets(sourceDir);
  const stale = [];
  for (const [name, content] of output) {
    const target = resolve(outputDir, name);
    let actual;
    try { actual = await readFile(target, 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (actual !== content) stale.push(name);
    if (!check) await writeFile(target, content);
  }
  if (check && stale.length) {
    throw new Error(`Stale Primetime assets: ${stale.join(', ')}. Run npm run build:primetime and commit the generated files.`);
  }
  return { bytes: [...output.values()].reduce((total, content) => total + Buffer.byteLength(content), 0), files: output.size };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--check') || args.length > 1) throw new Error('Usage: node scripts/build-primetime-assets.mjs [--check]');
    const result = await buildPrimetimeAssets({ check: args.includes('--check') });
    console.log(`PRIMETIME_ASSETS: ${args.includes('--check') ? 'CURRENT' : 'BUILT'} (${result.files} files, ${result.bytes} bytes; catalog unchanged)`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
