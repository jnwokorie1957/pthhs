import fs from 'node:fs/promises';
import path from 'node:path';
import { marketingHtmlFiles } from './site-scope.mjs';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const metaDir = path.join(publicDir, 'assets', 'meta');
const SITE = 'https://pthhs.net';
const BRAND = 'Primetime Home Health';
const BRAND_FULL = 'Primetime Home Health Services';

const coreMeta = {
  '/': {
    title: 'Non-Medical Home Care Houston | Primetime',
    description: 'Compassionate non-medical personal assistance, attendant care, respite care and ADL support for eligible families across Greater Houston.'
  },
  '/home-care-about-us': {
    title: 'About Primetime Home Health | Houston Home Care',
    description: 'Learn about Primetime Home Health Services, a Houston-based personal assistance agency serving local families with dependable non-medical in-home support.'
  },
  '/home-care-services': {
    title: 'Home Care Services in Houston, TX | Primetime',
    description: 'Explore non-medical home care services in Greater Houston, including attendant care, personal care, respite care, ADL assistance and medication reminders.'
  },
  '/home-care-areas-we-serve': {
    title: 'Home Care Areas We Serve | Greater Houston, TX',
    description: 'Explore Primetime Home Health Services coverage across Greater Houston and surrounding Texas counties, with community and ZIP-level service information.'
  },
  '/home-care-insurance': {
    title: 'Insurance & Medicaid Plans | Primetime Home Health Services Houston',
    description: 'Review Medicaid and managed-care plans Primetime works with in Greater Houston, including UnitedHealthcare, Molina, Wellpoint, Texas Children’s Health Plan and Community Health Choice.'
  },
  '/home-care-contact-us': {
    title: 'Contact Primetime Home Health | Houston, TX',
    description: 'Contact Primetime Home Health Services in Houston to ask about personal assistance, service availability, Medicaid plans, eligibility and next steps.'
  },
  '/home-care-careers': {
    title: 'Home Care Careers in Houston, TX | Primetime',
    description: 'Explore caregiver and home care career opportunities with Primetime Home Health Services in Houston and surrounding communities.'
  },
  '/home-care-client-reviews': {
    title: 'Google Reviews | Primetime Home Health Services Houston',
    description: 'Read public Google review excerpts about the communication, responsiveness and support provided by Primetime Home Health Services in Houston.'
  },
  '/home-care-meet-our-staff': {
    title: 'Meet Our Leadership Team | Primetime Home Health Services',
    description: 'Meet the Primetime Home Health Services leadership team coordinating non-medical personal assistance and attendant support in Greater Houston.'
  },
  '/home-care-meet-our-staff/johnson-nwokorie': {
    title: 'Johnson Nwokorie | Administrator | Primetime Home Health',
    description: 'Meet Johnson Nwokorie, founder and Administrator of Primetime Home Health Services, with more than 25 years of Houston home-care leadership experience.'
  },
  '/home-care-resources': {
    title: 'Official Home Care Resources | Primetime Houston',
    description: 'Use maintained official Texas and federal resources for Medicaid, benefits, long-term supports and community assistance information.'
  },
  '/home-care-blog': {
    title: 'Home Care Information | Primetime Houston',
    description: 'Use verified Primetime service information and maintained official resources while the imported article archive remains under review.'
  }
};

function htmlDecode(value = '') {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&hellip;/gi, '…')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function cleanText(value = '') {
  return htmlDecode(value.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function routeFromFile(file) {
  let rel = path.relative(publicDir, file).replaceAll(path.sep, '/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) rel = rel.slice(0, -'/index.html'.length);
  else rel = rel.replace(/\.html$/i, '');
  return '/' + rel.replace(/^\/+/, '');
}

function titleCaseSlug(slug = '') {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAdl\b/g, 'ADL')
    .replace(/\bPas\b/g, 'PAS');
}

function shortenTitle(title, max = 64) {
  title = cleanText(title);
  if (title.length <= max) return title;
  const brandSuffixes = [' | Primetime Home Health Services', ' | Primetime Home Health', ' | Primetime'];
  for (const suffix of brandSuffixes) {
    if (title.endsWith(suffix)) {
      const base = title.slice(0, -suffix.length).trim();
      const room = max - suffix.length - 1;
      if (room > 24) {
        const cut = base.slice(0, room).replace(/\s+\S*$/, '').trim();
        return `${cut}${suffix}`;
      }
    }
  }
  return title.slice(0, max - 1).replace(/\s+\S*$/, '').trimEnd() + '…';
}

function shortenDescription(text, max = 158) {
  text = cleanText(text);
  if (text.length <= max) return text;
  const clipped = text.slice(0, max + 1);
  const sentence = clipped.match(/^(.{80,158}?[.!?])(?:\s|$)/);
  if (sentence) return sentence[1];
  return clipped.slice(0, max - 1).replace(/\s+\S*$/, '').trimEnd() + '…';
}

function firstMeaningfulParagraph(html) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  const paragraphs = [...main.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => cleanText(m[1]))
    .filter((t) => t.length >= 55)
    .filter((t) => !/service availability and plan participation/i.test(t));
  return paragraphs[0] || '';
}

function existingDescription(html) {
  return cleanText(html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["'][^>]*>/i)?.[1] || '');
}

function extractH1(html) {
  return cleanText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
}

function placeFromRoute(route, h1) {
  const slug = route.split('/').filter(Boolean).pop() || '';
  let place = cleanText(h1)
    .replace(/^Home Care (?:Services )?in\s+/i, '')
    .replace(/^Personal Assistance (?:Services )?in\s+/i, '')
    .replace(/^Non-Medical Home Care in\s+/i, '')
    .replace(/\s*[|–—-].*$/, '')
    .trim();
  if (!place || place.length > 48 || /home care/i.test(place)) place = titleCaseSlug(slug);
  return place;
}

function serviceNameFromRoute(route, h1) {
  const slug = route.split('/').filter(Boolean).pop() || '';
  let service = cleanText(h1)
    .replace(/\s+(?:Services?|Support)\s+in\s+Houston.*$/i, '')
    .replace(/\s+in\s+Houston.*$/i, '')
    .replace(/\s*[|–—-].*$/, '')
    .trim();
  if (!service || service.length > 58) service = titleCaseSlug(slug);
  return service;
}

function pageMeta(route, html) {
  if (coreMeta[route]) return coreMeta[route];

  if (route === '/404') {
    return {
      title: 'Page Not Found | Primetime Home Health',
      description: 'The page you requested could not be found. Return to Primetime Home Health Services for Houston home care information and contact details.'
    };
  }

  const h1 = extractH1(html);
  const existing = existingDescription(html);
  const firstP = firstMeaningfulParagraph(html);

  if (route.startsWith('/locations/')) {
    const place = placeFromRoute(route, h1);
    return {
      title: shortenTitle(`Home Care in ${place}, TX | Primetime Home Health`),
      description: shortenDescription(`Explore non-medical personal assistance and home care in ${place}, Texas. Primetime helps eligible families understand local service availability, Medicaid plans and next steps.`)
    };
  }

  if (route.startsWith('/home-care-services/')) {
    const service = serviceNameFromRoute(route, h1);
    return {
      title: shortenTitle(`${service} in Houston, TX | Primetime Home Health`),
      description: shortenDescription(firstP || existing || `Learn about ${service.toLowerCase()} from Primetime Home Health Services for eligible clients across Greater Houston.`)
    };
  }

  if (/^\/(?:home-care-)?(?:blog|resources)\//.test(route)) {
    const subject = h1 || titleCaseSlug(route.split('/').pop());
    return {
      title: shortenTitle(`${subject} | Primetime Home Health`),
      description: shortenDescription(firstP || existing || `Read ${subject.toLowerCase()} guidance from Primetime Home Health Services for Houston-area families and caregivers.`)
    };
  }

  if (route.split('/').filter(Boolean).length === 1 && !route.startsWith('/home-care-')) {
    const subject = h1 || titleCaseSlug(route.slice(1));
    return {
      title: shortenTitle(`${subject} | Primetime Home Health`),
      description: shortenDescription(firstP || existing || `Read ${subject.toLowerCase()} information from Primetime Home Health Services in Houston, Texas.`)
    };
  }

  const subject = h1 || titleCaseSlug(route.split('/').filter(Boolean).pop() || 'Primetime Home Health');
  return {
    title: shortenTitle(`${subject} | ${BRAND}`),
    description: shortenDescription(firstP || existing || `Learn more about ${subject.toLowerCase()} from ${BRAND_FULL} in Houston, Texas.`)
  };
}

function canonicalForRoute(route) {
  if (route === '/') return `${SITE}/`;
  return `${SITE}${route}`;
}

function ogImageForRoute(route) {
  if (route === '/') return `${SITE}/assets/meta/og-home.png`;
  if (route === '/home-care-areas-we-serve' || route.startsWith('/locations/')) return `${SITE}/assets/meta/og-locations.png`;
  if (route === '/home-care-services' || route.startsWith('/home-care-services/')) return `${SITE}/assets/meta/og-services.png`;
  if (route.includes('blog') || route.includes('resource') || (!route.startsWith('/home-care-') && route !== '/')) return `${SITE}/assets/meta/og-resources.png`;
  return `${SITE}/assets/meta/og-default.png`;
}

function removeHeadTag(html, regex) {
  return html.replace(regex, '');
}

function injectMeta(html, route, meta) {
  const canonical = canonicalForRoute(route);
  const ogImage = ogImageForRoute(route);
  const ogType = route.includes('blog') || (!route.startsWith('/home-care-') && route !== '/' && route !== '/404') ? 'article' : 'website';

  html = removeHeadTag(html, /<title>[\s\S]*?<\/title>/i);
  html = removeHeadTag(html, /<meta\s+name=["']description["'][^>]*>/gi);
  html = removeHeadTag(html, /<link\s+rel=["']canonical["'][^>]*>/gi);
  html = removeHeadTag(html, /<meta\s+(?:property|name)=["'](?:og:[^"']+|twitter:[^"']+|theme-color)["'][^>]*>/gi);
  html = removeHeadTag(html, /<link\s+rel=["'](?:icon|shortcut icon|apple-touch-icon|manifest)["'][^>]*>/gi);

  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}">`,
    `<link rel="canonical" href="${canonical}">`,
    `<meta name="theme-color" content="#0d4f8f">`,
    `<link rel="icon" href="/assets/meta/favicon.svg" type="image/svg+xml">`,
    `<link rel="icon" href="/assets/meta/favicon-32x32.png" sizes="32x32" type="image/png">`,
    `<link rel="icon" href="/assets/meta/favicon-16x16.png" sizes="16x16" type="image/png">`,
    `<link rel="shortcut icon" href="/assets/meta/favicon.ico">`,
    `<link rel="apple-touch-icon" href="/assets/meta/apple-touch-icon.png" sizes="180x180">`,
    `<link rel="manifest" href="/site.webmanifest">`,
    `<meta property="og:type" content="${ogType}">`,
    `<meta property="og:site_name" content="${BRAND_FULL}">`,
    `<meta property="og:title" content="${escapeHtml(meta.title)}">`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}">`,
    `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:image" content="${ogImage}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${escapeHtml(meta.title)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}">`,
    `<meta name="twitter:image" content="${ogImage}">`
  ].join('');

  html = html.replace(/<head([^>]*)>/i, `<head$1>${tags}`);
  if (route === '/404' && !/<meta\s+name=["']robots["']/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, '<head$1><meta name="robots" content="noindex,follow">');
  }
  return html;
}

function formatZipText(html) {
  return html.replace(/(<p\b[^>]*>\s*ZIPs:\s*)([\s\S]*?)(<\/p>)/gi, (_, open, content, close) => {
    const formatted = content
      .replace(/\s*\/\s*/g, ' / ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([,.;:)])/g, '$1')
      .replace(/([(])\s+/g, '$1');
    return `${open}${formatted}${close}`;
  });
}

function markCountyGrid(html) {
  if (!/County hubs/i.test(html)) return html;
  return html.replace(
    /(<h2\b[^>]*>\s*County hubs\s*<\/h2>\s*)<div class=["']grid grid-3["']>/i,
    '$1<div class="grid grid-3 county-hub-grid">'
  );
}

const addressPlain = '11602 Burdine St, Suite A, Houston, TX 77035';
const addressEncoded = encodeURIComponent(addressPlain);
const googleMaps = `https://www.google.com/maps/search/?api=1&query=${addressEncoded}`;

function linkAddresses(html) {
  // Do not touch pages that have already been processed.
  if (/class=["']address-link["']/i.test(html)) return html;

  const addressPattern = /11602 Burdine St, Suite A(?:,\s*|<br\s*\/?>\s*)Houston, TX 77035/gi;
  return html.replace(addressPattern, (match) => {
    const label = /<br/i.test(match)
      ? '11602 Burdine St, Suite A<br>Houston, TX 77035'
      : addressPlain;
    return `<a class="address-link" data-map-address="${addressPlain}" href="${googleMaps}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
}

function stylePhoneLinks(html) {
  html = html.replace(/<a([^>]*\bhref=["']tel:[^"']+["'][^>]*)>/gi, (full, attrs) => {
    if (/\bclass=["'][^"']*\bphone-link\b/i.test(attrs)) return full;
    if (/\bclass=["']/.test(attrs)) {
      return `<a${attrs.replace(/\bclass=["']([^"']*)["']/i, (_m, classes) => `class="${classes} phone-link"`)}>`;
    }
    return `<a class="phone-link"${attrs}>`;
  });
  html = html.replace(/After Hours:\s*(?!<a)(346-599-2755)/gi, 'After Hours: <a class="phone-link" href="tel:3465992755">$1</a>');
  return html;
}

const fbSvg = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M13.7 22v-8.6h2.9l.4-3.4h-3.3V7.8c0-1 .3-1.7 1.7-1.7h1.8V3.1c-.3 0-1.4-.1-2.7-.1-2.7 0-4.6 1.7-4.6 4.7V10H7v3.4h2.9V22h3.8Z"/></svg>';
const igSvg = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.4 2h9.2A5.4 5.4 0 0 1 22 7.4v9.2a5.4 5.4 0 0 1-5.4 5.4H7.4A5.4 5.4 0 0 1 2 16.6V7.4A5.4 5.4 0 0 1 7.4 2Zm0 2A3.4 3.4 0 0 0 4 7.4v9.2A3.4 3.4 0 0 0 7.4 20h9.2a3.4 3.4 0 0 0 3.4-3.4V7.4A3.4 3.4 0 0 0 16.6 4H7.4Zm9.7 1.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>';

function socialIcons(html) {
  const fb = '<a class="social-icon social-facebook" href="https://www.facebook.com/primetimehomehealth/" target="_blank" rel="noopener noreferrer" aria-label="Primetime Home Health on Facebook">' + fbSvg + '</a>';
  const ig = '<a class="social-icon social-instagram" href="https://www.instagram.com/primetimehomehealthservices/" target="_blank" rel="noopener noreferrer" aria-label="Primetime Home Health on Instagram">' + igSvg + '</a>';
  return html.replace(
    /<p>\s*<a\s+href=["']https:\/\/www\.facebook\.com\/primetimehomehealth\/?["'][^>]*>\s*Facebook\s*<\/a>\s*(?:·|&middot;|\|)\s*<a\s+href=["']https:\/\/www\.instagram\.com\/primetimehomehealthservices\/?["'][^>]*>\s*Instagram\s*<\/a>\s*<\/p>/gi,
    `<div class="social-links" aria-label="Social media">${fb}${ig}</div>`
  );
}

function injectEnhancementScript(html) {
  if (html.includes('/assets/site-enhancements.js')) return html;
  return html.replace(/<\/body>/i, '<script src="/assets/site-enhancements.js" defer></script></body>');
}

function faviconSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Primetime Home Health">\n  <rect width="64" height="64" rx="15" fill="#0d4f8f"/>\n  <path d="M16 31.5 32 18l16 13.5v17.2H37.7V37.8H26.3v10.9H16V31.5Z" fill="#fff"/>\n  <path d="M27.2 25.4h9.6v4.9h4.9v9.6h-4.9v4.9h-9.6v-4.9h-4.9v-9.6h4.9v-4.9Z" fill="#f5a623"/>\n</svg>`;
}

function ogSvg(label, subtitle) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">\n  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d4f8f"/><stop offset="1" stop-color="#1768b5"/></linearGradient></defs>\n  <rect width="1200" height="630" fill="url(#g)"/>\n  <circle cx="1040" cy="85" r="230" fill="#f5a623" opacity=".16"/>\n  <circle cx="1090" cy="590" r="310" fill="#ffffff" opacity=".06"/>\n  <rect x="88" y="74" width="76" height="76" rx="18" fill="#fff"/>\n  <path d="M105 111.5 126 94l21 17.5v22.6h-13.5v-14.3h-15v14.3H105v-22.6Z" fill="#0d4f8f"/>\n  <path d="M120 103h12v6h6v12h-6v6h-12v-6h-6v-12h6v-6Z" fill="#f5a623"/>\n  <text x="186" y="122" fill="#fff" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700">Primetime Home Health Services</text>\n  <text x="88" y="325" fill="#fff" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700">${escapeHtml(label)}</text>\n  <text x="88" y="395" fill="#dceafb" font-family="Arial, Helvetica, sans-serif" font-size="32">${escapeHtml(subtitle)}</text>\n  <rect x="88" y="474" width="200" height="8" rx="4" fill="#f5a623"/>\n  <text x="88" y="540" fill="#dceafb" font-family="Arial, Helvetica, sans-serif" font-size="25">Houston, Texas • pthhs.net • 713-977-7721</text>\n</svg>`;
}

function pngToIco(pngBuffer, width = 32, height = 32) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(width >= 256 ? 0 : width, 0);
  entry.writeUInt8(height >= 256 ? 0 : height, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, pngBuffer]);
}

async function generateMetaAssets() {
  await fs.mkdir(metaDir, { recursive: true });
  const favSvg = faviconSvg();
  await fs.writeFile(path.join(metaDir, 'favicon.svg'), favSvg, 'utf8');
  const ogs = {
    'og-home': ['Houston Home Care', 'Personal assistance with a local, experienced team'],
    'og-services': ['Home Care Services', 'Attendant care, personal care, respite and ADL support'],
    'og-locations': ['Areas We Serve', 'Greater Houston and surrounding Texas communities'],
    'og-resources': ['Home Care Resources', 'Practical guidance for families and caregivers'],
    'og-default': ['Primetime Home Health', 'Compassionate personal assistance across Greater Houston']
  };
  for (const [name, [label, subtitle]] of Object.entries(ogs)) {
    await fs.writeFile(path.join(metaDir, `${name}.svg`), ogSvg(label, subtitle), 'utf8');
  }

  const manifest = {
    name: BRAND_FULL,
    short_name: 'Primetime',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0d4f8f',
    icons: [
      { src: '/assets/meta/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/assets/meta/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
    ]
  };
  await fs.writeFile(path.join(publicDir, 'site.webmanifest'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  try {
    const { default: sharp } = await import('sharp');
    const favBuffer = Buffer.from(favSvg);
    const sizes = [
      ['favicon-16x16.png', 16],
      ['favicon-32x32.png', 32],
      ['apple-touch-icon.png', 180],
      ['android-chrome-192x192.png', 192],
      ['android-chrome-512x512.png', 512]
    ];
    for (const [name, size] of sizes) {
      await sharp(favBuffer).resize(size, size).png().toFile(path.join(metaDir, name));
    }
    const png32 = await sharp(favBuffer).resize(32, 32).png().toBuffer();
    await fs.writeFile(path.join(metaDir, 'favicon.ico'), pngToIco(png32));
    for (const [name, [label, subtitle]] of Object.entries(ogs)) {
      await sharp(Buffer.from(ogSvg(label, subtitle))).png().toFile(path.join(metaDir, `${name}.png`));
    }
    console.log('Generated PNG/ICO favicon and Open Graph image set.');
  } catch (error) {
    console.warn('Sharp was unavailable; SVG meta assets were generated, but PNG/ICO generation was skipped.', error?.message || error);
  }
}

async function processHtmlFile(file) {
  let html = await fs.readFile(file, 'utf8');
  const route = routeFromFile(file);
  const meta = pageMeta(route, html);
  html = formatZipText(html);
  if (route === '/home-care-areas-we-serve') html = markCountyGrid(html);
  html = linkAddresses(html);
  html = stylePhoneLinks(html);
  html = socialIcons(html);
  html = injectMeta(html, route, meta);
  html = injectEnhancementScript(html);
  html = html.split(/\r?\n/).map((line) => line.trimEnd()).join('\n');
  if (!html.endsWith('\n')) html += '\n';
  await fs.writeFile(file, html, 'utf8');
  const indexable = !/<meta\s+name=["']robots["'][^>]+noindex/i.test(html);
  return { route, indexable, ...meta };
}

async function main() {
  await generateMetaAssets();
  const files = await marketingHtmlFiles(publicDir);
  const results = [];
  for (const file of files) results.push(await processHtmlFile(file));
  const titles = new Map();
  for (const item of results) {
    if (!item.indexable) continue;
    if (!titles.has(item.title)) titles.set(item.title, []);
    titles.get(item.title).push(item.route);
  }
  const duplicates = [...titles.entries()].filter(([, routes]) => routes.length > 1);
  if (duplicates.length) {
    console.warn('Duplicate generated titles detected:');
    for (const [title, routes] of duplicates) console.warn(`- ${title}: ${routes.join(', ')}`);
  }
  console.log(`Polished ${results.length} HTML pages with page-specific metadata, maps, phone links, social icons, favicons and OG tags.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
