import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { buildPrimetimeAssets, PRIMETIME_ASSETS, renderPrimetimeAssets } from './build-primetime-assets.mjs';

const sample = `(() => {
  function retainedFunctionName() { const descriptiveLocalVariable = 7; return descriptiveLocalVariable; }
  class RetainedClassName {}
  window.contract = { readableField: retainedFunctionName(), functionName: retainedFunctionName.name,
    className: RetainedClassName.name, quoted: { 'source-field': 'preserved' },
    regexResult: /^https:\\/\\/pthhs\\.net\\/primetime$/.test('https://pthhs.net/primetime') };
})();\n`;

async function fixture(t, newline = '\n') {
  const prefix = resolve(tmpdir(), 'pthhs-primetime-build-');
  const dir = await mkdtemp(prefix);
  const sourceDir = resolve(dir, 'source');
  const outputDir = resolve(dir, 'output');
  await mkdir(sourceDir);
  await mkdir(outputDir);
  t.after(async () => {
    // Only this test's freshly created, absolute temporary tree may be removed.
    if (!dir.startsWith(prefix) || dir.includes(`${sep}..${sep}`)) throw new Error('Unexpected fixture path');
    await rm(dir, { recursive: true, force: true });
  });
  for (const name of PRIMETIME_ASSETS) {
    await writeFile(resolve(sourceDir, name), (name.endsWith('.js') ? sample : '.fixture { color: blue; }\n').replaceAll('\n', newline));
  }
  const html = PRIMETIME_ASSETS.map(name => `<link href="/primetime/${name}?v=outdated">`).join('\n') + '\n';
  await writeFile(resolve(sourceDir, 'index.html'), html.replaceAll('\n', newline));
  return { sourceDir, outputDir };
}

test('checked-in production artifacts exactly match the readable authoring source', async () => {
  const result = await buildPrimetimeAssets({ check: true });
  assert.equal(result.files, PRIMETIME_ASSETS.length + 1);
});

test('production rebuilds are byte-identical across LF and CRLF authoring files', async t => {
  const a = await fixture(t);
  const b = await fixture(t, '\r\n');
  assert.deepEqual(await renderPrimetimeAssets(a.sourceDir), await renderPrimetimeAssets(b.sourceDir));
  await buildPrimetimeAssets(a);
  const before = await readFile(resolve(a.outputDir, 'index.html'), 'utf8');
  await buildPrimetimeAssets(a);
  assert.equal(await readFile(resolve(a.outputDir, 'index.html'), 'utf8'), before);
});

test('stale production checking fails without overwriting an artifact and rebuild updates its content hash', async t => {
  const paths = await fixture(t);
  await buildPrimetimeAssets(paths);
  const target = resolve(paths.outputDir, 'dashboard.js');
  const before = await readFile(target, 'utf8');
  await writeFile(resolve(paths.sourceDir, 'dashboard.js'), sample.replace('= 7', '= 8'));
  await assert.rejects(buildPrimetimeAssets({ ...paths, check: true }), /Stale Primetime assets:.*dashboard\.js.*index\.html/);
  assert.equal(await readFile(target, 'utf8'), before);
  await buildPrimetimeAssets(paths);
  const bytes = await readFile(target);
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const html = await readFile(resolve(paths.outputDir, 'index.html'), 'utf8');
  assert.ok(html.includes(`/primetime/dashboard.js?v=${hash}`));
  assert.notEqual(bytes.toString(), before);
});

test('generated JavaScript preserves public properties, function/class names and regular expressions', async t => {
  const paths = await fixture(t);
  const rendered = await renderPrimetimeAssets(paths.sourceDir);
  const original = { window: {} };
  const production = { window: {} };
  vm.runInNewContext(sample, original);
  vm.runInNewContext(rendered.get('primetime.js'), production);
  assert.deepEqual(JSON.parse(JSON.stringify(production.window.contract)), JSON.parse(JSON.stringify(original.window.contract)));
  assert.equal(production.window.contract.functionName, 'retainedFunctionName');
  assert.equal(production.window.contract.className, 'RetainedClassName');
  assert.equal(production.window.contract.regexResult, true);
  assert.ok(!rendered.get('primetime.js').includes('descriptiveLocalVariable'));
});
