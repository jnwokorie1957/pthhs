#!/usr/bin/env node
/* Browser-based responsive and navigation QA for representative templates. */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const base = process.env.BASE_URL || 'http://127.0.0.1:8765';
const widths = [320, 375, 768, 1024, 1440];
const routes = [
  '/',
  '/home-care-services',
  '/home-care-services/medication-reminders',
  '/home-care-areas-we-serve',
  '/locations/houston',
  '/home-care-insurance',
  '/home-care-resources',
  '/home-care-careers',
  '/home-care-contact-us',
  '/home-care-client-reviews',
  '/privacy-policy'
];

const browser = await chromium.launch({ headless: true });
const errors = [];
let checks = 0;

try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
    for (const route of routes) {
      const page = await context.newPage();
      const runtimeErrors = [];
      page.on('pageerror', (error) => runtimeErrors.push(error.message));
      const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      if (!response?.ok()) errors.push(`${width}px ${route}: HTTP ${response?.status()}`);
      await page.waitForTimeout(40);

      const layout = await page.evaluate(() => {
        const visible = (node) => Boolean(node) && getComputedStyle(node).display !== 'none';
        const bar = document.querySelector('.mobile-care-bar');
        const footer = document.querySelector('.site-footer');
        const logo = document.querySelector('.site-header .brand img');
        const logoBox = logo?.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          header: visible(document.querySelector('.site-header')),
          main: visible(document.querySelector('#main-content')),
          footer: visible(footer),
          nav: visible(document.querySelector('.site-nav')),
          toggle: visible(document.querySelector('.menu-toggle')),
          bar: visible(bar),
          barHeight: bar?.getBoundingClientRect().height || 0,
          footerBottomPadding: Number.parseFloat(getComputedStyle(footer).paddingBottom) || 0,
          logoInsideViewport: Boolean(logoBox && logoBox.left >= -1 && logoBox.right <= window.innerWidth + 1),
          wideElements: [...document.querySelectorAll('main img, main table, main form, main .card')]
            .filter((node) => {
              const box = node.getBoundingClientRect();
              return box.width > 0 && (box.left < -1 || box.right > window.innerWidth + 1);
            }).length
        };
      });
      checks += 1;
      if (layout.overflow > 1) errors.push(`${width}px ${route}: horizontal overflow ${layout.overflow}px`);
      if (!layout.header || !layout.main || !layout.footer) errors.push(`${width}px ${route}: landmark not visible`);
      if (!layout.logoInsideViewport) errors.push(`${width}px ${route}: header logo leaves viewport`);
      if (layout.wideElements) errors.push(`${width}px ${route}: ${layout.wideElements} content element(s) leave viewport`);
      if (runtimeErrors.length) errors.push(`${width}px ${route}: runtime ${runtimeErrors.join('; ')}`);

      if (width <= 900) {
        if (!layout.toggle || !layout.bar) errors.push(`${width}px ${route}: mobile controls not visible`);
        if (layout.footerBottomPadding < layout.barHeight) errors.push(`${width}px ${route}: mobile bar may cover footer content`);
        const toggle = page.locator('.menu-toggle');
        await toggle.click();
        if (await toggle.getAttribute('aria-expanded') !== 'true') errors.push(`${width}px ${route}: menu did not open`);
        await page.keyboard.press('Escape');
        if (await toggle.getAttribute('aria-expanded') !== 'false') errors.push(`${width}px ${route}: Escape did not close menu`);
        const focused = await toggle.evaluate((node) => node === document.activeElement);
        if (!focused) errors.push(`${width}px ${route}: menu focus did not return`);
      } else {
        if (!layout.nav || layout.toggle || layout.bar) errors.push(`${width}px ${route}: desktop/mobile control state is wrong`);
      }
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}

if (errors.length) {
  console.error('RESPONSIVE_SHELL_QA: FAIL');
  for (const error of errors) console.error('-', error);
  process.exit(1);
}

console.log(`RESPONSIVE_SHELL_QA: PASS (${checks} route/viewport combinations)`);
