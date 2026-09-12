import fs from 'node:fs/promises';
import path from 'node:path';
import { marketingHtmlFiles } from './site-scope.mjs';

const publicDir = path.join(process.cwd(), 'public');

function stripInjectedLinksFromJsonLd(html) {
  return html.replace(/<script\b([^>]*type=["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi, (_all, attrs, body) => {
    const clean = body.replace(/<a\b[^>]*class=["'][^"']*address-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, label) =>
      label.replace(/<br\s*\/?\s*>/gi, ', ').replace(/<[^>]+>/g, '')
    );
    return `<script${attrs}>${clean}</script>`;
  });
}

function normalizeLocationTitles(html) {
  return html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, (head) =>
    head
      .replace(/,\s*Texas,\s*TX/gi, ', TX')
      .replace(/,\s*TX,\s*TX/gi, ', TX')
      .replace(/\s+Texas,\s*TX/gi, ', TX')
  );
}

function injectPolishCss(html) {
  if (html.includes('/assets/polish.css')) return html;
  return html.replace(/<\/head>/i, '<link rel="stylesheet" href="/assets/polish.css"></head>');
}

for (const file of await marketingHtmlFiles(publicDir)) {
  let html = await fs.readFile(file, 'utf8');
  html = stripInjectedLinksFromJsonLd(html);
  html = normalizeLocationTitles(html);
  html = injectPolishCss(html);
  await fs.writeFile(file, html, 'utf8');
}

console.log('Finalized site-wide polish stylesheet and metadata cleanup.');
