import fs from 'node:fs/promises';

const file = 'scripts/site-polish.mjs';
let source = await fs.readFile(file, 'utf8');

const start = source.indexOf('function linkAddresses(html) {');
const end = source.indexOf('function stylePhoneLinks(html) {');

if (start === -1 || end === -1 || end <= start) {
  throw new Error('Could not locate linkAddresses() in site-polish.mjs');
}

const fixed = `function linkAddresses(html) {
  // Do not touch pages that have already been processed.
  if (/class=["']address-link["']/i.test(html)) return html;

  const addressPattern = /11602 Burdine St, Suite A(?:,\\s*|<br\\s*\\/?>\\s*)Houston, TX 77035/gi;
  return html.replace(addressPattern, (match) => {
    const label = /<br/i.test(match)
      ? '11602 Burdine St, Suite A<br>Houston, TX 77035'
      : addressPlain;
    return \`<a class="address-link" data-map-address="\${addressPlain}" href="\${googleMaps}" target="_blank" rel="noopener noreferrer">\${label}</a>\`;
  });
}

`;

source = source.slice(0, start) + fixed + source.slice(end);
await fs.writeFile(file, source);
console.log('Patched address-link generation safely.');
