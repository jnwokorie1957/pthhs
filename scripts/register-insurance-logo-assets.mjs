import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';

// One-time migration for the original, owner-approved image set. The resulting
// dimension map and asset inventory are committed and checked by normal CI.
const files = ['wellpoint.png', 'molina.png', 'united-healthcare.png', 'medicaid-1.png', 'texas-chldrn-hlth-plan.png', 'comm-health-choice.jpg'];
const base = '/wp-content/themes/primetimehomeie989/images/';
const performancePath = 'scripts/performance_foundation.mjs';
let performance = await fs.readFile(performancePath, 'utf8');
const dimensionAnchor = 'const intrinsicDimensions = new Map([\n';
assert(performance.includes(dimensionAnchor), 'Intrinsic-dimension registry changed');
const dimensions = [];
for (const file of files) {
  const { width, height } = await sharp(`public${base}${file}`).metadata();
  assert(width > 1 && height > 1, `Invalid original logo: ${file}`);
  if (!performance.includes(`['${base}${file}',`)) dimensions.push(`  ['${base}${file}', [${width}, ${height}]],`);
}
if (dimensions.length) performance = performance.replace(dimensionAnchor, dimensionAnchor + dimensions.join('\n') + '\n');
// Cache versions are URL metadata, not part of the asset's filesystem path.
performance = performance.replace('intrinsicDimensions.get(src)', 'intrinsicDimensions.get(src.split(/[?#]/)[0])');
assert(performance.includes('intrinsicDimensions.get(src.split(/[?#]/)[0])'), 'Image URL normalization changed');
await fs.writeFile(performancePath, performance);
const verifierPath = 'scripts/verify_performance_foundation.mjs';
let verifier = await fs.readFile(verifierPath, 'utf8');
const inventoryAnchor = 'const expectedLegacyAssets = new Set([\n';
assert(verifier.includes(inventoryAnchor), 'Expected asset inventory changed');
const assets = files.filter(file => !verifier.includes(`'${base.slice(1)}${file}'`)).map(file => `  '${base.slice(1)}${file}',`);
if (assets.length) verifier = verifier.replace(inventoryAnchor, inventoryAnchor + assets.join('\n') + '\n');
await fs.writeFile(verifierPath, verifier);
console.log('Registered all six original insurance images with the performance generator and asset inventory.');
