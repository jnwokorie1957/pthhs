#!/usr/bin/env node

import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const axeSource = await fs.readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const base = process.env.BASE_URL || "http://127.0.0.1:8765";
const routes = [
  "/",
  "/home-care-services",
  "/home-care-services/medication-reminders",
  "/home-care-areas-we-serve",
  "/locations/houston",
  "/home-care-insurance",
  "/home-care-contact-us",
  "/home-care-careers",
  "/home-care-client-reviews",
  "/home-care-resources",
  "/home-care-blog"
];
const auditWidths = [375, 1440];
const reflowWidths = [640, 320];
const errors = [];
let axeRuns = 0;
let reflowRuns = 0;

function describeViolation(violation) {
  const targets = violation.nodes.slice(0, 3).flatMap((node) => node.target).join(", ");
  return `${violation.id} (${violation.impact || "unknown"}): ${targets}`;
}

const browser = await chromium.launch({ headless: true });
try {
  for (const width of auditWidths) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: "reduce" });
    for (const route of routes) {
      const page = await context.newPage();
      const runtimeErrors = [];
      page.on("pageerror", (error) => runtimeErrors.push(error.message));
      const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
      if (!response?.ok()) errors.push(`${width}px ${route}: HTTP ${response?.status()}`);
      await page.addScriptTag({ content: axeSource });
      const result = await page.evaluate(async () => window.axe.run(document, {
        resultTypes: ["violations"],
        rules: { "region": { enabled: true } }
      }));
      axeRuns += 1;
      for (const violation of result.violations) {
        errors.push(`${width}px ${route}: ${describeViolation(violation)}`);
      }
      if (runtimeErrors.length) errors.push(`${width}px ${route}: runtime ${runtimeErrors.join("; ")}`);

      // Browser-process focus can persist between pages in the shared desktop
      // context. Anchor focus at the document entry before sending a real Tab.
      await page.evaluate(() => {
        document.body.setAttribute("tabindex", "-1");
        document.body.focus();
      });
      await page.keyboard.press("Tab");
      await page.waitForTimeout(20);
      await page.evaluate(() => document.body.removeAttribute("tabindex"));
      const skipVisible = await page.locator(".skip-link").evaluate((node) => {
        const box = node.getBoundingClientRect();
        return node === document.activeElement && box.width > 0 && box.height > 0 && box.bottom > 0;
      });
      if (!skipVisible) errors.push(`${width}px ${route}: skip link is not the first visible focus target`);
      await page.keyboard.press("Enter");
      if (!await page.locator("#main-content").evaluate((node) => node === document.activeElement)) {
        errors.push(`${width}px ${route}: skip link did not focus main content`);
      }
      await page.close();
    }
    await context.close();
  }

  for (const width of reflowWidths) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: "reduce" });
    for (const route of routes) {
      const page = await context.newPage();
      const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
      if (!response?.ok()) errors.push(`reflow ${width}px ${route}: HTTP ${response?.status()}`);
      const layout = await page.evaluate(() => {
        const visible = (node) => Boolean(node) && getComputedStyle(node).display !== "none";
        const clippedText = [...document.querySelectorAll("main h1, main h2, main h3, main p, main li, footer p, footer li")]
          .filter((node) => {
            const style = getComputedStyle(node);
            if (!visible(node) || style.position === "absolute") return false;
            return node.scrollWidth > node.clientWidth + 1 && ["hidden", "clip"].includes(style.overflowX);
          }).length;
        const primary = document.querySelector("main .btn-primary, main .btn-secondary, main a[href^='tel:']");
        const box = primary?.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          clippedText,
          landmarks: [document.querySelector("header"), document.querySelector("main"), document.querySelector("footer")].every(visible),
          primaryInside: !box || (box.left >= -1 && box.right <= window.innerWidth + 1),
          toggleVisible: visible(document.querySelector(".menu-toggle"))
        };
      });
      reflowRuns += 1;
      if (layout.overflow > 1) errors.push(`reflow ${width}px ${route}: horizontal overflow ${layout.overflow}px`);
      if (layout.clippedText) errors.push(`reflow ${width}px ${route}: ${layout.clippedText} clipped text element(s)`);
      if (!layout.landmarks) errors.push(`reflow ${width}px ${route}: landmark unavailable`);
      if (!layout.primaryInside) errors.push(`reflow ${width}px ${route}: primary action leaves viewport`);
      if (!layout.toggleVisible) errors.push(`reflow ${width}px ${route}: mobile navigation unavailable`);
      const toggle = page.locator(".menu-toggle");
      await toggle.click();
      await page.keyboard.press("Escape");
      if (await toggle.getAttribute("aria-expanded") !== "false") errors.push(`reflow ${width}px ${route}: menu did not close`);
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const plan = await fs.readFile(new URL("../plan.md", import.meta.url), "utf8");
if (!/- \[x\] \*\*79\./.test(plan)) errors.push("plan.md item 79 is not marked complete");
if (!/- \[ \] \*\*84\./.test(plan) || !/Automated Sep 12/.test(plan)) {
  errors.push("plan.md must keep item 84 open and record the completed automated portion");
}

if (errors.length) {
  console.error(`ACCESSIBILITY_BROWSER_QA: FAIL (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`ACCESSIBILITY_BROWSER_QA: PASS (${axeRuns} axe runs; ${reflowRuns} 200%/400% equivalent reflow runs)`);
