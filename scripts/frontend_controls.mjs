#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

function versionFor(bytes) {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 12);
}

const htmlFiles = (await walk(publicDir)).filter((file) => file.endsWith(".html"));
const assetVersions = new Map();
let changed = 0;
let references = 0;

for (const file of htmlFiles) {
  const original = await fs.readFile(file, "utf8");
  const normalized = original
    .replace(/<p style=["']margin-top:26px["']>/g, '<p class="action-row-spaced">')
    .replace(/<div class=["']hero-actions["'] style=["']margin-top:26px["']>/g, '<div class="hero-actions hero-actions-spaced">')
    .replace(/<h2 class=["']section-title["'] style=["']margin-top:40px["']>/g, '<h2 class="section-title section-title-spaced">');
  const updated = normalized.replace(
    /(\b(?:href|src)=)(["'])(\/assets\/[^"'?#]+\.(?:css|js))(?:\?v=[^"'#]*)?\2/gi,
    (match, attribute, quote, assetUrl) => {
      const assetPath = path.join(publicDir, assetUrl.slice(1));
      if (!assetVersions.has(assetUrl)) {
        assetVersions.set(assetUrl, versionFor(requireBytes(assetPath)));
      }
      references += 1;
      return `${attribute}${quote}${assetUrl}?v=${assetVersions.get(assetUrl)}${quote}`;
    },
  );
  if (updated !== original) {
    await fs.writeFile(file, updated);
    changed += 1;
  }
}

function requireBytes(assetPath) {
  try {
    return fsSyncRead(assetPath);
  } catch (error) {
    throw new Error(`Unable to version ${path.relative(root, assetPath)}: ${error.message}`);
  }
}

function fsSyncRead(assetPath) {
  // Replacement callbacks are synchronous, so the referenced bytes must be read synchronously.
  return readFileSync(assetPath);
}

console.log(
  `Frontend controls: ${htmlFiles.length} pages; ${references} versioned CSS/JS references; ${assetVersions.size} assets; ${changed} pages changed.`,
);
