import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Exact original blobs from 178ab2a68c1c69dbedca32de11b4f06465c67c01,
// the parent of the first September 22 logo-suppression commit.
// Website display was explicitly approved by the owner; see the payer register.
const logos = [
  ['wellpoint.png', 'Wellpoint', 'a44fd90bfc589abff932c1e09b14bf52f32de4e9'],
  ['molina.png', 'Molina Healthcare', 'c726e19ffb8f377cca77beb867c37df540b7a0ab'],
  ['united-healthcare.png', 'UnitedHealthcare', '747236ed42cf98ee9dc65db5b554ab56a4440a38'],
  ['medicaid-1.png', 'Medicaid', '76c0fd9c4de73551072243f5f9796aaa2d37a11c'],
  ['texas-chldrn-hlth-plan.png', "Texas Children's Health Plan", '05c5ef37ecbfded2eb67d0fd46d5962a5ac23c99'],
  ['comm-health-choice.jpg', 'Community Health Choice', 'd154921348ba4031eb6a3f881d0da2c04ded54bf'],
];
const base = '/wp-content/themes/primetimehomeie989/images/';
const pages = ['index.html', 'home-care-insurance.html'];
const cssPath = '/assets/insurance-logos.css';
const css = '.approved-insurance-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:30px 0}.approved-insurance-grid .insurance-logo{box-sizing:border-box;min-width:0;height:108px;padding:16px;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid var(--line);border-radius:18px}.approved-insurance-grid .insurance-logo img{display:block;width:auto;height:auto;max-width:100%;max-height:72px;object-fit:contain}@media(max-width:620px){.approved-insurance-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}\n';
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const blobSha = buffer => createHash('sha1').update(`blob ${buffer.length}\0`).update(buffer).digest('hex');
const dimensions = new Map();
for (const [file, label, expected] of logos) {
  const bytes = await fs.readFile(`public${base}${file}`);
  assert.equal(blobSha(bytes), expected, `${label}: original image was changed or replaced`);
  const metadata = await sharp(bytes).metadata();
  assert(metadata.width > 1 && metadata.height > 1, `${label}: placeholder image`);
  dimensions.set(file, metadata);
}

if (process.argv.includes('--restore')) {
  const grid = '<div class="insurance-grid approved-insurance-grid" data-insurance-logos="approved" role="list" aria-label="Insurance plans and Medicaid">' + logos.map(([file, label, sha]) => {
    const { width, height } = dimensions.get(file);
    return `<div class="insurance-logo" role="listitem"><img src="${base}${file}?v=${sha.slice(0, 12)}" alt="${escape(label)}" width="${width}" height="${height}" decoding="async" loading="lazy"></div>`;
  }).join('') + '</div>';
  const homePath = 'public/index.html';
  let home = await fs.readFile(homePath, 'utf8');
  if (!home.includes('data-insurance-logos="approved"')) {
    const anchor = '<a class="btn-secondary" href="/home-care-insurance">View Insurance Information</a>';
    assert.equal(home.split(anchor).length, 2, 'Homepage insurance insertion point changed; review instead of overwriting');
    home = home.replace(anchor, grid + anchor);
  }
  home = home.replace('Named network claims are withheld until current documentation is approved. Confirm network status with the plan and Primetime before relying on coverage.', 'Contact Primetime to confirm the member’s plan, covered services and current authorization before services begin.');
  await fs.writeFile(homePath, home);
  const insurancePath = 'public/home-care-insurance.html';
  let insurance = await fs.readFile(insurancePath, 'utf8');
  if (!insurance.includes('data-insurance-logos="approved"')) {
    const removed = '<h2>Ask about your current plan</h2><p>We have temporarily removed plan logos and named network claims while documentation is being refreshed. This does not determine whether a particular client can receive services; call for a current, case-specific confirmation.</p>';
    assert.equal(insurance.split(removed).length, 2, 'Insurance insertion point changed; review instead of overwriting');
    insurance = insurance.replace(removed, '<h2>Insurance plans and Medicaid</h2><p>Contact Primetime about services through the plans shown below. Coverage and availability depend on the member’s benefits, service authorization and location.</p>' + grid);
  }
  await fs.writeFile(insurancePath, insurance);
  await fs.writeFile(`public${cssPath}`, css);
  for (const page of pages) {
    const file = `public/${page}`;
    let html = await fs.readFile(file, 'utf8');
    if (!html.includes(cssPath)) {
      assert(html.includes('</head>'), `${page}: missing head`);
      html = html.replace('</head>', `<link rel="stylesheet" href="${cssPath}"></head>`);
    }
    await fs.writeFile(file, html);
  }
}

function verifyPage(html, page) {
  assert.equal(html.split('data-insurance-logos="approved"').length - 1, 1, `${page}: missing or duplicate logo grid`);
  assert(html.includes(cssPath), `${page}: shared logo styles missing`);
  assert(!html.includes('temporarily removed plan logos'), `${page}: stale removal notice`);
  assert(!html.includes('Named network claims are withheld'), `${page}: stale suppression notice`);
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map(match => match[0]);
  for (const [file, label, sha] of logos) {
    const matches = images.filter(tag => tag.includes(`src="${base}${file}?v=${sha.slice(0, 12)}"`));
    assert.equal(matches.length, 1, `${page}: missing or duplicate ${label}`);
    assert(matches[0].includes(`alt="${escape(label)}"`), `${page}: incorrect accessible label for ${label}`);
    const { width, height } = dimensions.get(file);
    assert(matches[0].includes(`width="${width}"`) && matches[0].includes(`height="${height}"`), `${page}: missing image dimensions for ${label}`);
  }
}

const originIndex = process.argv.indexOf('--origin');
if (originIndex >= 0) {
  const origin = new URL(process.argv[originIndex + 1]);
  assert.equal(origin.protocol, 'https:', 'Live verification requires HTTPS');
  const get = async pathname => {
    const url = new URL(pathname, origin);
    url.searchParams.set('logo-verification', Date.now().toString());
    const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'Cache-Control': 'no-cache' } });
    assert(response.ok, `${url.pathname}: HTTP ${response.status}`);
    return response;
  };
  for (const page of pages) {
    const route = page === 'index.html' ? '/' : '/home-care-insurance';
    verifyPage(await (await get(route)).text(), route);
  }
  for (const [file, label, sha] of logos) {
    const response = await get(`${base}${file}?v=${sha.slice(0, 12)}`);
    assert(response.headers.get('content-type')?.startsWith('image/'), `${label}: response is not an image`);
    assert.equal(blobSha(Buffer.from(await response.arrayBuffer())), sha, `${label}: live image does not match recovered original`);
  }
  assert.equal(await (await get(cssPath)).text(), await fs.readFile(`public${cssPath}`, 'utf8'), 'Live logo styles differ from committed styles');
  console.log(`INSURANCE_LOGOS_LIVE: PASS (${origin.origin}: both pages, six byte-identical originals, shared CSS)`);
} else {
  for (const page of pages) verifyPage(await fs.readFile(`public/${page}`, 'utf8'), page);
  const styles = await fs.readFile(`public${cssPath}`, 'utf8');
  assert(styles.includes('.approved-insurance-grid'), 'Logo layout styles missing');
  console.log('INSURANCE_LOGOS_QA: PASS (both pages; all six original image hashes and dimensions verified)');
}
