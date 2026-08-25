import fs from 'node:fs/promises';
import { test as base, expect } from '@playwright/test';

const fixtureUrl = name => new URL(`../../fixtures/${name}`, import.meta.url);
const mainCatalog = JSON.parse(await fs.readFile(fixtureUrl('catalog-main.json'), 'utf8'));
const adultCatalog = JSON.parse(await fs.readFile(fixtureUrl('catalog-adult.json'), 'utf8'));
const transparentSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="12" viewBox="0 0 8 12"><rect width="8" height="12" fill="#151a17"/></svg>';

async function fulfillJson(route, value) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    headers: { 'cache-control': 'no-store' },
    body: JSON.stringify(value)
  });
}

async function installFixtureRoutes(page) {
  await page.addInitScript(() => localStorage.setItem('sg-adult-ack', '1'));
  await page.route('**/data/source.json', route => fulfillJson(route, { mode: 'local' }));
  await page.route('**/data/catalog.json', route => fulfillJson(route, mainCatalog));
  await page.route('**/data/adult-catalog.json', route => fulfillJson(route, adultCatalog));
  await page.route('**/data/version.json', route => fulfillJson(route, { version: '2.6.0-e2e', commit: 'fixture' }));
  await page.route('**/media/shadow-garden/covers/**', route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: transparentSvg }));
}

export const test = base.extend({
  fixtureRoutes: [async ({ page }, use) => {
    await installFixtureRoutes(page);
    await use();
  }, { auto: true }],
  browserDiagnostics: [async ({ page }, use, testInfo) => {
    const diagnostics = [];
    page.on('pageerror', error => diagnostics.push({ type: 'pageerror', message: error.message }));
    page.on('console', message => {
      if (message.type() === 'error') diagnostics.push({ type: 'console', message: message.text() });
    });
    page.on('requestfailed', request => diagnostics.push({
      type: 'requestfailed',
      url: request.url(),
      message: request.failure()?.errorText || 'request failed'
    }));
    await use(diagnostics);
    if (testInfo.status !== testInfo.expectedStatus || diagnostics.length) {
      await testInfo.attach('browser-diagnostics.json', {
        body: Buffer.from(JSON.stringify(diagnostics, null, 2)),
        contentType: 'application/json'
      });
    }
  }, { auto: true }]
});

export { expect };
