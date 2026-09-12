#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marketingHtmlFiles } from "./site-scope.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const failures = [];

function fail(message) {
  failures.push(message);
}

function versionFor(bytes) {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 12);
}

const htmlFiles = await marketingHtmlFiles(publicDir);
const referencedAssets = new Set();
let versionedReferences = 0;
let jsonLdBlocks = 0;
let inlineStyles = 0;

for (const file of htmlFiles) {
  const relative = path.relative(root, file);
  const html = await fs.readFile(file, "utf8");
  const assetPattern = /(\b(?:href|src)=)(["'])(\/assets\/[^"'?#]+\.(?:css|js))(?:\?v=([^"'#]*))?\2/gi;
  for (const match of html.matchAll(assetPattern)) {
    const assetUrl = match[3];
    const supplied = match[4] ?? "";
    const assetPath = path.join(publicDir, assetUrl.slice(1));
    let bytes;
    try {
      bytes = await fs.readFile(assetPath);
    } catch {
      fail(`${relative}: missing referenced asset ${assetUrl}`);
      continue;
    }
    const expected = versionFor(bytes);
    if (supplied !== expected) fail(`${relative}: ${assetUrl} has version ${supplied || "<missing>"}; expected ${expected}`);
    if (!/^[0-9a-f]{12}$/.test(supplied)) fail(`${relative}: ${assetUrl} does not use a 12-character content version`);
    referencedAssets.add(assetUrl);
    versionedReferences += 1;
  }

  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = match[1];
    if (/\bsrc\s*=/.test(attributes)) continue;
    if (!/\btype\s*=\s*["']application\/ld\+json["']/i.test(attributes)) {
      fail(`${relative}: executable or unclassified inline script conflicts with the CSP policy`);
      continue;
    }
    try {
      JSON.parse(match[2]);
      jsonLdBlocks += 1;
    } catch {
      fail(`${relative}: invalid inline JSON-LD`);
    }
  }

  if (/\son[a-z]+\s*=/i.test(html)) fail(`${relative}: inline event handler conflicts with CSP controls`);
  if (/<(?:iframe|object|embed|form)\b/i.test(html)) fail(`${relative}: embedded/form dependency requires a CSP review`);
  if (/<base\b/i.test(html)) fail(`${relative}: base element is incompatible with the locked base-uri policy`);
  inlineStyles += (html.match(/\sstyle\s*=/gi) || []).length;
}

const expectedAssets = [
  "/assets/components.css",
  "/assets/home.css",
  "/assets/modern.css",
  "/assets/polish.css",
  "/assets/section-pages.css",
  "/assets/site-enhancements.js",
];
for (const asset of expectedAssets) {
  if (!referencedAssets.has(asset)) fail(`Expected versioned runtime asset is not referenced: ${asset}`);
}
if (referencedAssets.size !== expectedAssets.length) {
  fail(`Expected exactly ${expectedAssets.length} CSS/JS assets; found ${referencedAssets.size}`);
}

const firebase = JSON.parse(await fs.readFile(path.join(root, "firebase.json"), "utf8"));
const headerRules = firebase?.hosting?.headers ?? [];
const rule = (source) => headerRules.find((entry) => entry.source === source);
const values = (entry) => Object.fromEntries((entry?.headers ?? []).map(({ key, value }) => [key.toLowerCase(), value]));

const globalHeaders = values(rule("**"));
const requiredHeaders = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  "x-frame-options": "DENY",
};
for (const [key, expected] of Object.entries(requiredHeaders)) {
  if (globalHeaders[key] !== expected) fail(`Firebase global ${key} header does not match the approved value`);
}

const csp = globalHeaders["content-security-policy"] ?? "";
const requiredDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "media-src 'self'",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
];
for (const directive of requiredDirectives) {
  if (!csp.split(";").map((item) => item.trim()).includes(directive)) fail(`CSP is missing: ${directive}`);
}

const assetCache = values(rule("**/*.@(css|js)"))["cache-control"];
if (assetCache !== "public,max-age=31536000,immutable") fail("CSS/JS immutable cache policy is missing");
const imageRule = rule("**/*.@(jpg|jpeg|gif|png|svg|webp|avif|ico)");
if (values(imageRule)["cache-control"] !== "public,max-age=86400,stale-while-revalidate=604800") {
  fail("Stable-name image cache policy is unsafe or excludes AVIF");
}
const documentCache = values(rule("**/*.@(html|xml|json|webmanifest)"))["cache-control"];
if (documentCache !== "public,max-age=0,must-revalidate") fail("Document revalidation policy is missing");

const plan = await fs.readFile(path.join(root, "plan.md"), "utf8");
for (const item of [92, 93]) {
  if (!new RegExp(`- \\[x\\] \\*\\*${item}\\.`).test(plan)) fail(`plan.md item ${item} is not marked complete`);
}
if (!/- \[ \] \*\*96\./.test(plan)) fail("plan.md item 96 must remain open until browser metrics are enforced");
await fs.access(path.join(root, "PTHHS_SECURITY_CACHE_REGISTER.md")).catch(() => fail("Security/cache register is missing"));

if (inlineStyles !== 0) fail(`CSP compatibility inventory expected no inline style attributes; found ${inlineStyles}`);
if (failures.length) {
  console.error(`Frontend controls: FAIL (${failures.length} issue${failures.length === 1 ? "" : "s"})`);
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(
  `Frontend controls: PASS (${htmlFiles.length} pages; ${versionedReferences} versioned references; ${referencedAssets.size} assets; ${jsonLdBlocks} JSON-LD blocks; ${inlineStyles} approved inline styles).`,
);
