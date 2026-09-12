#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(import.meta.dirname, "..");
const publicDir = path.join(root, "public");
const config = JSON.parse(await fs.readFile(path.join(root, "performance-budgets.json"), "utf8"));
const browserMode = process.argv.includes("--browser");
const errors = [];
const browserResults = [];

async function walk(directory, predicate) {
  const output = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(file, predicate));
    else if (entry.isFile() && predicate(file)) output.push(file);
  }
  return output;
}

async function totalBytes(files) {
  const sizes = await Promise.all(files.map(async (file) => ({ file, bytes: (await fs.stat(file)).size })));
  return { total: sizes.reduce((sum, item) => sum + item.bytes, 0), sizes };
}

const javascript = await totalBytes(await walk(path.join(publicDir, "assets"), (file) => file.endsWith(".js")));
const images = await totalBytes(await walk(publicDir, (file) => /\.(?:avif|gif|ico|jpe?g|png|svg|webp)$/i.test(file)));
const largestImage = images.sizes.sort((a, b) => b.bytes - a.bytes)[0];
const deploy = config.deploy_thresholds;

if (javascript.total > deploy.marketing_javascript_bytes) {
  errors.push(`marketing JavaScript ${javascript.total} B exceeds ${deploy.marketing_javascript_bytes} B`);
}
if (images.total > deploy.all_image_bytes) {
  errors.push(`deploy images ${images.total} B exceed ${deploy.all_image_bytes} B`);
}
if (largestImage?.bytes > deploy.largest_image_bytes) {
  errors.push(`${path.relative(root, largestImage.file)} is ${largestImage.bytes} B; limit ${deploy.largest_image_bytes} B`);
}

if (browserMode) {
  const base = process.env.BASE_URL || "http://127.0.0.1:8765";
  const threshold = config.lab_thresholds;
  const browser = await chromium.launch({ headless: true });
  try {
    for (const route of config.representative_routes) {
      const context = await browser.newContext({ viewport: config.mobile_viewport, reducedMotion: "reduce" });
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.__pthhsVitals = {
          lcp: 0,
          cls: 0,
          events: [],
          shifts: [],
          supportsEventTiming: PerformanceObserver.supportedEntryTypes.includes("event")
        };
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          window.__pthhsVitals.lcp = entries.at(-1)?.startTime || 0;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              window.__pthhsVitals.cls += entry.value;
              window.__pthhsVitals.shifts.push({
                value: entry.value,
                sources: [...entry.sources].map(({ node }) => {
                  if (!node) return "unknown";
                  return `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}${node.className ? `.${String(node.className).trim().replace(/\s+/g, ".")}` : ""}`;
                })
              });
            }
          }
        }).observe({ type: "layout-shift", buffered: true });
        if (window.__pthhsVitals.supportsEventTiming) {
          new PerformanceObserver((list) => {
            window.__pthhsVitals.events.push(...list.getEntries().map((entry) => entry.duration));
          }).observe({ type: "event", buffered: true, durationThreshold: 16 });
        }
      });
      const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
      if (!response?.ok()) errors.push(`${route}: HTTP ${response?.status()}`);
      const toggle = page.locator(".menu-toggle");
      if (await toggle.isVisible()) {
        await toggle.click();
        await page.keyboard.press("Escape");
      }
      await page.waitForTimeout(150);
      const result = await page.evaluate(() => {
        const resources = performance.getEntriesByType("resource");
        const bytes = (type) => resources
          .filter((entry) => entry.initiatorType === type)
          .reduce((sum, entry) => sum + (entry.decodedBodySize || entry.transferSize || 0), 0);
        return {
          lcp: window.__pthhsVitals.lcp,
          cls: window.__pthhsVitals.cls,
          inp: Math.max(0, ...window.__pthhsVitals.events),
          javascript: bytes("script"),
          images: bytes("img"),
          shifts: window.__pthhsVitals.shifts,
          eventCount: window.__pthhsVitals.events.length,
          supportsEventTiming: window.__pthhsVitals.supportsEventTiming
        };
      });
      browserResults.push({ route, ...result });
      if (!result.lcp) errors.push(`${route}: LCP was not observed`);
      if (result.lcp > threshold.lcp_ms) errors.push(`${route}: LCP ${result.lcp.toFixed(1)} ms exceeds ${threshold.lcp_ms} ms`);
      if (result.cls > threshold.cls) errors.push(`${route}: CLS ${result.cls.toFixed(3)} exceeds ${threshold.cls}; shifts ${JSON.stringify(result.shifts)}`);
      if (!result.supportsEventTiming || !result.eventCount) errors.push(`${route}: INP event timing was not observed`);
      if (result.inp > threshold.inp_ms) errors.push(`${route}: INP sample ${result.inp.toFixed(1)} ms exceeds ${threshold.inp_ms} ms`);
      if (result.javascript > threshold.route_javascript_bytes) errors.push(`${route}: JavaScript ${result.javascript} B exceeds ${threshold.route_javascript_bytes} B`);
      if (result.images > threshold.route_image_bytes) errors.push(`${route}: images ${result.images} B exceed ${threshold.route_image_bytes} B`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

if (errors.length) {
  console.error(`PERFORMANCE_BUDGET_QA: FAIL (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const measured = browserMode
  ? `; ${config.representative_routes.length} mobile routes; max LCP ${Math.max(...browserResults.map(({ lcp }) => lcp)).toFixed(1)} ms; ` +
    `max CLS ${Math.max(...browserResults.map(({ cls }) => cls)).toFixed(3)}; max INP ${Math.max(...browserResults.map(({ inp }) => inp)).toFixed(1)} ms`
  : "";
console.log(
  `PERFORMANCE_BUDGET_QA: PASS (${javascript.total} marketing JS bytes; ${images.total} image bytes; ` +
  `${largestImage?.bytes || 0} largest-image bytes${measured})`,
);
