import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { isInternalAppFile, marketingHtmlFiles } from './site-scope.mjs';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const sourceDir = path.join(root, 'source-assets', 'performance');
const ownerSourceDir = path.join(root, 'source-assets', 'owner-content');
const mediaDir = path.join(publicDir, 'assets', 'media');

const responsiveImages = {
  'side-img1': { width: 586, height: 586, sourceWidth: 586, sourceHeight: 586, widths: [320, 586], source: path.join(sourceDir, 'side-img1.webp') },
  'side-img2': { width: 535, height: 684, sourceWidth: 535, sourceHeight: 684, widths: [320, 535], source: path.join(sourceDir, 'side-img2.webp') },
  'staff-johnson': { width: 640, height: 698, sourceWidth: 867, sourceHeight: 945, widths: [320, 640], source: path.join(ownerSourceDir, 'Team-img6.jpg') },
  'staff-irasema': { width: 640, height: 703, sourceWidth: 735, sourceHeight: 807, widths: [320, 640], source: path.join(ownerSourceDir, 'Team-img41.jpg') },
  'staff-jeremy': { width: 640, height: 698, sourceWidth: 867, sourceHeight: 945, widths: [320, 640], source: path.join(ownerSourceDir, 'team-img42.jpg') },
  'medication-reminders': { width: 300, height: 200, sourceWidth: 300, sourceHeight: 200, widths: [300], source: path.join(ownerSourceDir, 'medication-reminders.jpg') }
};

const intrinsicDimensions = new Map([
  ['/wp-content/themes/primetimehomeie989/images/main-logo.png', [388, 106]],
  ['/wp-content/themes/primetimehomeie989/images/footer-logo.png', [410, 203]],
  ['/wp-content/themes/primetimehomeie989/images/mid-img1.webp', [209, 209]],
  ['/wp-content/themes/primetimehomeie989/images/mid-img2.webp', [209, 209]],
  ['/wp-content/themes/primetimehomeie989/images/mid-img3.webp', [209, 209]],
  ['/wp-content/themes/primetimehomeie989/images/mid-img4.webp', [209, 209]],
  ['/wp-content/themes/primetimehomeie989/images/wellpoint.png', [300, 140]],
  ['/wp-content/themes/primetimehomeie989/images/molina.png', [300, 140]],
  ['/wp-content/themes/primetimehomeie989/images/united-healthcare.png', [300, 140]],
  ['/wp-content/themes/primetimehomeie989/images/medicaid-1.png', [302, 151]],
  ['/wp-content/themes/primetimehomeie989/images/texas-chldrn-hlth-plan.png', [300, 140]],
  ['/wp-content/themes/primetimehomeie989/images/comm-health-choice.jpg', [300, 123]],
  ['/assets/media/side-img1-586.webp', [586, 586]],
  ['/assets/media/side-img2-535.webp', [535, 684]]
  ,['/assets/media/staff-johnson-640.webp', [640, 698]]
  ,['/assets/media/staff-irasema-640.webp', [640, 703]]
  ,['/assets/media/staff-jeremy-640.webp', [640, 698]]
  ,['/assets/media/medication-reminders-300.webp', [300, 200]]
]);

const lcpByRoute = new Map([
  ['/', 'side-img2'],
  ['/home-care-services', 'side-img2'],
  ['/home-care-about-us', 'side-img1']
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

function removeAttr(tag, name) {
  return tag.replace(new RegExp(`\\s${name}=["'][^"']*["']`, 'gi'), '');
}

function setAttr(tag, name, value) {
  tag = removeAttr(tag, name);
  return tag.replace(/\s*\/>$|>$/, ` ${name}="${value}">`);
}

function responsiveName(src) {
  const name = src.match(/\/assets\/media\/([a-z0-9-]+)-\d+\.webp$/i)?.[1]
    || src.match(/\/(side-img[12])(?:-\d+)?\.webp$/i)?.[1]
    || '';
  return responsiveImages[name] ? name : '';
}

function imageSizes(image) {
  return `(max-width: 900px) calc(100vw - 40px), ${responsiveImages[image].width}px`;
}

function responsivePicture(image, imageTag) {
  const config = responsiveImages[image];
  const srcset = (format) => config.widths
    .map((width) => `/assets/media/${image}-${width}.${format} ${width}w`)
    .join(', ');
  return `<picture data-responsive-image="${image}">` +
    `<source type="image/avif" srcset="${srcset('avif')}" sizes="${imageSizes(image)}">` +
    `<source type="image/webp" srcset="${srcset('webp')}" sizes="${imageSizes(image)}">` +
    `${imageTag}</picture>`;
}

function lcpPreload(image) {
  const config = responsiveImages[image];
  const srcset = config.widths
    .map((width) => `/assets/media/${image}-${width}.avif ${width}w`)
    .join(', ');
  return `<link rel="preload" as="image" type="image/avif" href="/assets/media/${image}-${config.width}.avif" imagesrcset="${srcset}" imagesizes="${imageSizes(image)}" fetchpriority="high" data-lcp-image="${image}">`;
}

function optimizeHtml(html, route) {
  html = html.replace(
    /<picture\s+data-responsive-image=["'][^"']+["'][^>]*>[\s\S]*?(<img\b[^>]*>)[\s\S]*?<\/picture>/gi,
    '$1'
  );
  html = html.replace(/<link\b[^>]*data-lcp-image=["'][^"']+["'][^>]*>/gi, '');
  const lcpImage = lcpByRoute.get(route) || '';

  html = html.replace(/<img\b[^>]*>/gi, (original) => {
    let tag = original;
    let src = attr(tag, 'src');
    const responsive = responsiveName(src);
    if (responsive) {
      const config = responsiveImages[responsive];
      src = `/assets/media/${responsive}-${config.width}.webp`;
      tag = setAttr(tag, 'src', src);
    }
    const dimensions = intrinsicDimensions.get(src);
    if (!dimensions) throw new Error(`No approved intrinsic dimensions for ${src} on ${route}`);
    tag = setAttr(tag, 'width', dimensions[0]);
    tag = setAttr(tag, 'height', dimensions[1]);
    tag = setAttr(tag, 'decoding', 'async');

    const isLogo = src.endsWith('/main-logo.png');
    const isLcp = responsive && responsive === lcpImage;
    if (isLcp || isLogo) tag = setAttr(tag, 'loading', 'eager');
    else tag = setAttr(tag, 'loading', 'lazy');
    if (isLcp) tag = setAttr(tag, 'fetchpriority', 'high');
    else tag = removeAttr(tag, 'fetchpriority');

    return responsive ? responsivePicture(responsive, tag) : tag;
  });

  if (lcpImage) html = html.replace(/<\/head>/i, `${lcpPreload(lcpImage)}</head>`);
  return html;
}

async function generateResponsiveImages() {
  await fs.mkdir(mediaDir, { recursive: true });
  for (const [name, config] of Object.entries(responsiveImages)) {
    const source = config.source;
    const metadata = await sharp(source).metadata();
    if (metadata.width !== config.sourceWidth || metadata.height !== config.sourceHeight) {
      throw new Error(`${name} source dimensions changed: ${metadata.width}x${metadata.height}`);
    }
    for (const width of config.widths) {
      const input = sharp(source).resize({ width, withoutEnlargement: true });
      await input.clone().webp({ quality: 78, effort: 6 }).toFile(path.join(mediaDir, `${name}-${width}.webp`));
      await input.clone().avif({ quality: 52, effort: 5 }).toFile(path.join(mediaDir, `${name}-${width}.avif`));
    }
  }
}

async function removeExternalFonts() {
  const cssFiles = await walk(path.join(publicDir, 'assets'), (file) => file.endsWith('.css'));
  for (const file of cssFiles) {
    let css = await fs.readFile(file, 'utf8');
    css = css.replace(/^@import[^\r\n]*fonts\.googleapis\.com[^\r\n]*(?:\r?\n)?/gim, '');
    css = css.replace(/^[^\r\n]*display=swap["']?\);\s*(?:\r?\n)?/i, '');
    css = css
      .replace(/font-family:Barlow,Inter,sans-serif/gi, 'font-family:system-ui,-apple-system,"Segoe UI",sans-serif')
      .replace(/font-family:Inter,Arial,sans-serif/gi, 'font-family:system-ui,-apple-system,"Segoe UI",sans-serif')
      .replace(/font-family:Barlow(?:,sans-serif)?/gi, 'font-family:system-ui,-apple-system,"Segoe UI",sans-serif')
      .replace(/font-family:Inter(?:,sans-serif)?/gi, 'font-family:system-ui,-apple-system,"Segoe UI",sans-serif');
    if (file.endsWith('modern.css') && !css.includes('picture{display:contents}')) {
      css = css.replace('*{box-sizing:border-box}', '*{box-sizing:border-box}picture{display:contents}');
    }
    await fs.writeFile(file, css, 'utf8');
  }
}

function referencedPublicPaths(documents) {
  const references = new Set();
  for (const text of documents) {
    for (const match of text.matchAll(/(?:src|href|srcset|imagesrcset)=["']([^"']+)["']/gi)) {
      for (const candidate of match[1].split(',')) {
        const value = candidate.trim().split(/\s+/)[0];
        if (value.startsWith('/')) references.add(value.split(/[?#]/)[0]);
      }
    }
    for (const match of text.matchAll(/url\(["']?([^)'"\s]+)["']?\)/gi)) {
      if (match[1].startsWith('/')) references.add(match[1].split(/[?#]/)[0]);
    }
  }
  return references;
}

async function pruneLegacyPublicFiles(documents) {
  const references = referencedPublicPaths(documents);
  let removedFiles = 0;
  let removedBytes = 0;
  const legacyRoot = path.join(publicDir, 'wp-content');
  for (const file of await walk(legacyRoot)) {
    const publicPath = '/' + path.relative(publicDir, file).replaceAll(path.sep, '/');
    if (references.has(publicPath)) continue;
    const stat = await fs.stat(file);
    removedBytes += stat.size;
    removedFiles += 1;
    await fs.unlink(file);
  }
  for (const file of await walk(publicDir, (entry) => entry.endsWith('.php'))) {
    if (isInternalAppFile(file, publicDir)) continue;
    const stat = await fs.stat(file);
    removedBytes += stat.size;
    removedFiles += 1;
    await fs.unlink(file);
  }
  return { removedFiles, removedBytes };
}

await generateResponsiveImages();
await removeExternalFonts();
const htmlFiles = await marketingHtmlFiles(publicDir);
const documents = [];
for (const file of htmlFiles) {
  const html = optimizeHtml(await fs.readFile(file, 'utf8'), routeFromFile(file));
  documents.push(html);
  await fs.writeFile(file, html, 'utf8');
}
const cssFiles = await walk(path.join(publicDir, 'assets'), (file) => file.endsWith('.css'));
for (const file of cssFiles) documents.push(await fs.readFile(file, 'utf8'));
documents.push(await fs.readFile(path.join(publicDir, 'site.webmanifest'), 'utf8'));
const pruned = await pruneLegacyPublicFiles(documents);

console.log(
  `Performance foundation processed ${htmlFiles.length} pages; generated responsive image variants; ` +
  `pruned ${pruned.removedFiles} unreachable legacy files (${pruned.removedBytes} bytes).`
);
