import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const errors = [];

const lcpByRoute = new Map([
  ['/', 'side-img2'],
  ['/home-care-services', 'side-img2'],
  ['/home-care-about-us', 'side-img1']
]);

const expectedLegacyAssets = new Set([
  'wp-content/themes/primetimehomeie989/images/footer-logo.png',
  'wp-content/themes/primetimehomeie989/images/main-logo.png',
  'wp-content/themes/primetimehomeie989/images/mid-img1.webp',
  'wp-content/themes/primetimehomeie989/images/mid-img2.webp',
  'wp-content/themes/primetimehomeie989/images/mid-img3.webp',
  'wp-content/themes/primetimehomeie989/images/mid-img4.webp'
]);

const expectedResponsiveAssets = new Set([
  'assets/media/side-img1-320.avif',
  'assets/media/side-img1-320.webp',
  'assets/media/side-img1-586.avif',
  'assets/media/side-img1-586.webp',
  'assets/media/side-img2-320.avif',
  'assets/media/side-img2-320.webp',
  'assets/media/side-img2-535.avif',
  'assets/media/side-img2-535.webp'
]);

async function walk(dir, predicate = () => true) {
  const output = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...await walk(full, predicate));
    else if (entry.isFile() && predicate(full)) output.push(full);
  }
  return output;
}

function routeFromFile(file) {
  let relative = path.relative(publicDir, file).replaceAll(path.sep, '/');
  if (relative === 'index.html') return '/';
  if (relative.endsWith('/index.html')) relative = relative.slice(0, -'/index.html'.length);
  else relative = relative.replace(/\.html$/i, '');
  return '/' + relative.replace(/^\/+/, '');
}

function attr(tag, name) {
  return tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, 'i'))?.[1] || '';
}

function localFile(publicUrl) {
  return path.join(publicDir, publicUrl.split(/[?#]/)[0].replace(/^\//, ''));
}

const htmlFiles = await walk(publicDir, (file) => file.endsWith('.html'));
const metadata = new Map();
let imageCount = 0;
let lazyCount = 0;
let pictureCount = 0;
let preloadCount = 0;
let externalRuntimeCount = 0;

for (const file of htmlFiles) {
  const relative = path.relative(publicDir, file).replaceAll(path.sep, '/');
  const route = routeFromFile(file);
  const html = await fs.readFile(file, 'utf8');
  const expectedLcp = lcpByRoute.get(route) || '';
  const preloads = [...html.matchAll(/<link\b[^>]*data-lcp-image=["']([^"']+)["'][^>]*>/gi)];
  preloadCount += preloads.length;
  if (preloads.length !== (expectedLcp ? 1 : 0) || (expectedLcp && preloads[0][1] !== expectedLcp)) {
    errors.push(`LCP preload contract differs: ${relative}`);
  }

  for (const match of html.matchAll(/<(?:script|img|source)\b[^>]*(?:src|srcset)=["'](https?:\/\/[^"']+)["'][^>]*>/gi)) {
    externalRuntimeCount += 1;
    errors.push(`external runtime resource: ${relative} -> ${match[1]}`);
  }
  for (const link of html.matchAll(/<link\b[^>]*>/gi)) {
    const relation = attr(link[0], 'rel').toLowerCase();
    const href = attr(link[0], 'href');
    if (/^(?:https?:)?\/\//i.test(href) && /(?:stylesheet|preload|modulepreload|icon|manifest)/.test(relation)) {
      externalRuntimeCount += 1;
      errors.push(`external linked resource: ${relative} -> ${href}`);
    }
  }
  if (/<(?:iframe|embed|form)\b/i.test(html)) errors.push(`embedded runtime or form remains: ${relative}`);

  const pictures = [...html.matchAll(/<picture\s+data-responsive-image=["'](side-img[12])["'][^>]*>([\s\S]*?)<\/picture>/gi)];
  pictureCount += pictures.length;
  for (const picture of pictures) {
    const sources = [...picture[2].matchAll(/<source\b[^>]*>/gi)].map((item) => item[0]);
    if (sources.length !== 2 || attr(sources[0], 'type') !== 'image/avif' || attr(sources[1], 'type') !== 'image/webp') {
      errors.push(`responsive format fallback differs: ${relative}/${picture[1]}`);
    }
    for (const source of sources) {
      if (!attr(source, 'sizes')) errors.push(`responsive sizes missing: ${relative}/${picture[1]}`);
      for (const candidate of attr(source, 'srcset').split(',')) {
        const [url, descriptor] = candidate.trim().split(/\s+/);
        if (!url || !/^\d+w$/.test(descriptor || '')) errors.push(`invalid srcset: ${relative}/${picture[1]}`);
        else {
          try { await fs.access(localFile(url)); }
          catch { errors.push(`missing responsive candidate: ${url}`); }
        }
      }
    }
  }

  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((item) => item[0]);
  imageCount += images.length;
  let pageHighPriority = 0;
  for (const tag of images) {
    const src = attr(tag, 'src');
    const width = Number(attr(tag, 'width'));
    const height = Number(attr(tag, 'height'));
    const loading = attr(tag, 'loading');
    const priority = attr(tag, 'fetchpriority');
    if (attr(tag, 'decoding') !== 'async') errors.push(`async decoding missing: ${relative} -> ${src}`);
    if (!width || !height) errors.push(`intrinsic dimensions missing: ${relative} -> ${src}`);
    if (!metadata.has(src)) {
      try { metadata.set(src, await sharp(localFile(src)).metadata()); }
      catch (error) { errors.push(`image cannot be read: ${src} (${error.message})`); }
    }
    const actual = metadata.get(src);
    if (actual && (actual.width !== width || actual.height !== height)) {
      errors.push(`intrinsic dimensions differ: ${relative} -> ${src} (${width}x${height} vs ${actual.width}x${actual.height})`);
    }
    const responsive = src.match(/\/(side-img[12])-\d+\.webp$/)?.[1] || '';
    const isLcp = responsive && responsive === expectedLcp;
    const isHeaderLogo = src.endsWith('/main-logo.png');
    if (isLcp) {
      if (loading !== 'eager' || priority !== 'high') errors.push(`LCP priority missing: ${relative} -> ${src}`);
      pageHighPriority += 1;
    } else {
      if (!isHeaderLogo && loading !== 'lazy') errors.push(`below-fold image is not lazy: ${relative} -> ${src}`);
      if (isHeaderLogo && loading !== 'eager') errors.push(`header logo should load eagerly: ${relative}`);
      if (priority === 'high') errors.push(`non-LCP image has high priority: ${relative} -> ${src}`);
    }
    if (loading === 'lazy') lazyCount += 1;
  }
  if (pageHighPriority !== (expectedLcp ? 1 : 0)) errors.push(`high-priority image count differs: ${relative}`);
}

const cssFiles = await walk(path.join(publicDir, 'assets'), (file) => file.endsWith('.css'));
const css = (await Promise.all(cssFiles.map((file) => fs.readFile(file, 'utf8')))).join('\n');
if (/@import|fonts\.googleapis|fonts\.gstatic|font-family:(?:Barlow|Inter)/i.test(css)) {
  errors.push('external or duplicate webfont dependency remains');
}
if (!css.includes('picture{display:contents}')) errors.push('responsive picture layout rule missing');

const legacyAssets = new Set(
  (await walk(path.join(publicDir, 'wp-content'))).map((file) => path.relative(publicDir, file).replaceAll(path.sep, '/'))
);
if (legacyAssets.size !== expectedLegacyAssets.size || [...legacyAssets].some((item) => !expectedLegacyAssets.has(item))) {
  errors.push(`unexpected legacy public assets: ${[...legacyAssets].filter((item) => !expectedLegacyAssets.has(item)).join(', ')}`);
}
const responsiveAssets = new Set(
  (await walk(path.join(publicDir, 'assets', 'media'))).map((file) => path.relative(publicDir, file).replaceAll(path.sep, '/'))
);
if (responsiveAssets.size !== expectedResponsiveAssets.size || [...responsiveAssets].some((item) => !expectedResponsiveAssets.has(item))) {
  errors.push('responsive media set differs');
}
for (const file of await walk(path.join(root, 'source-assets', 'performance'))) {
  const info = await sharp(file).metadata();
  if (!['side-img1.webp', 'side-img2.webp'].includes(path.basename(file)) || !info.width || !info.height) {
    errors.push(`invalid performance source asset: ${file}`);
  }
}

const phpFiles = await walk(publicDir, (file) => file.endsWith('.php'));
if (phpFiles.length) errors.push(`public PHP endpoints remain: ${phpFiles.join(', ')}`);

const publicFiles = await walk(publicDir);
const publicBytes = (await Promise.all(publicFiles.map((file) => fs.stat(file)))).reduce((sum, stat) => sum + stat.size, 0);
if (publicBytes > 2_000_000) errors.push(`public output exceeds 2 MB foundation budget: ${publicBytes}`);
if (pictureCount !== 4 || preloadCount !== 3) errors.push(`expected 4 responsive pictures and 3 LCP preloads, found ${pictureCount}/${preloadCount}`);
if (externalRuntimeCount !== 0) errors.push(`expected zero external runtime resources, found ${externalRuntimeCount}`);

const plan = await fs.readFile(path.join(root, 'plan.md'), 'utf8');
for (const item of [87, 88, 89, 90, 91, 95]) {
  if (!new RegExp(`- \\[x\\] \\*\\*${item}\\. `).test(plan)) errors.push(`completed plan item is not checked: ${item}`);
}
try { await fs.access(path.join(root, 'PTHHS_FRONTEND_DEPENDENCY_REGISTER.md')); }
catch { errors.push('dependency register is missing'); }

if (errors.length) {
  console.error('PERFORMANCE_FOUNDATION_QA: FAIL');
  for (const error of errors) console.error('-', error);
  process.exit(1);
}

console.log(
  `PERFORMANCE_FOUNDATION_QA: PASS (${htmlFiles.length} pages; ${imageCount} dimension checks; ` +
  `${lazyCount} lazy images; ${pictureCount} responsive pictures; ${preloadCount} LCP preloads; ` +
  `0 external runtimes; ${publicBytes} public bytes)`
);
