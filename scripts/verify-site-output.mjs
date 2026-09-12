import fs from 'node:fs/promises';
import path from 'node:path';
import { marketingHtmlFiles } from './site-scope.mjs';

const publicDir = path.join(process.cwd(), 'public');

const failures = [];
for (const file of await marketingHtmlFiles(publicDir)) {
  const html = await fs.readFile(file, 'utf8');
  const rel = path.relative(publicDir, file);

  if (/data-map-address=["']\s*<a\b/i.test(html)) {
    failures.push(`${rel}: nested anchor leaked into data-map-address`);
  }
  if (/<\/a>["']\s+href=["']https:\/\/www\.google\.com\/maps/i.test(html)) {
    failures.push(`${rel}: malformed nested map anchor attributes leaked into markup`);
  }
  if (/class=["'][^"']*address-link[^"']*["'][^>]*data-map-address=["'][^"']+["'][^>]*href=["']https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=[^"']+["']/i.test(html) === false &&
      rel === 'index.html') {
    failures.push(`${rel}: homepage address link was not generated correctly`);
  }
  if (/<header\b[^>]*class=["'][^"']*site-header/i.test(html) && !html.includes('/assets/site-enhancements.js')) {
    failures.push(`${rel}: site header is missing the shared enhancement script`);
  }
}

const enhancementJs = await fs.readFile(path.join(publicDir, 'assets', 'site-enhancements.js'), 'utf8');
const polishCss = await fs.readFile(path.join(publicDir, 'assets', 'polish.css'), 'utf8');
if (!enhancementJs.includes('setupMobileNavigation') || !enhancementJs.includes('menu-toggle')) {
  failures.push('site-enhancements.js: mobile hamburger navigation logic is missing');
}
if (!polishCss.includes('.menu-toggle') || !polishCss.includes('site-nav[data-mobile-enhanced')) {
  failures.push('polish.css: mobile hamburger navigation styles are missing');
}

if (failures.length) {
  console.error('Site output verification failed:\n' + failures.join('\n'));
  process.exit(1);
}

console.log('Verified generated HTML, map-link integrity, and mobile hamburger navigation assets.');
