import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMarketingHtml, isInternalAppFile } from './site-scope.mjs';
import { portalLinks, careersRedirect, removeCareersFromSitemap } from './retire-careers.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const publicDir = path.join(root, 'public');

test('the retired Careers fallback survives outside marketing generators', () => {
  const file = path.join(publicDir, 'home-care-careers.html');
  assert.equal(isMarketingHtml(file, publicDir), false);
  assert.equal(isInternalAppFile(file, publicDir), false);
  assert.equal(isMarketingHtml(path.join(publicDir, 'home-care-services.html'), publicDir), true);
  assert.equal(fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n'), careersRedirect);
  const redirects = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'))).hosting.redirects;
  for (const source of ['/home-care-careers', '/home-care-careers.html', '/home-care-careers/']) {
    assert.equal(redirects.filter(row => row.source === source).length, 1);
    assert.ok(redirects.some(row => row.source === source && row.type === 301 && row.destination === '/caregiver'));
  }
});

test('public recruiting links converge on one portal without changing other navigation', () => {
  const html = '<nav><a href="/home-care-services">Services</a><a href="/home-care-careers">Careers</a><a href="/caregiver">Caregiver Portal</a></nav><p><a href="/home-care-careers.html">Apply Online</a></p>';
  const result = portalLinks(html);
  assert.equal(result, '<nav><a href="/home-care-services">Services</a><a href="/caregiver">Caregiver Portal</a></nav><p><a href="/caregiver">Caregiver Portal</a></p>');
  assert.equal(portalLinks(result), result);
});

test('retired sitemap aliases are removed without losing other reviewed entries', () => {
  const xml = '<urlset><url><loc>https://pthhs.net/</loc></url><url><loc>https://pthhs.net/home-care-careers</loc><lastmod>2026-01-01</lastmod></url><url><loc>https://pthhs.net/home-care-services</loc></url></urlset>';
  const result = removeCareersFromSitemap(xml);
  assert.equal(result, '<urlset><url><loc>https://pthhs.net/</loc></url><url><loc>https://pthhs.net/home-care-services</loc></url></urlset>');
  assert.equal(removeCareersFromSitemap(result), result);
});
