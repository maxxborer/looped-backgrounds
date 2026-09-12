import { createRequire } from 'node:module';
import path from 'node:path';
export async function getBrowser() {
  let playwright;
  try { playwright = await import('playwright'); }
  catch (error) {
    if (!process.env.PLAYWRIGHT_PACKAGE_ROOT) throw error;
    playwright = createRequire(path.join(process.env.PLAYWRIGHT_PACKAGE_ROOT, 'package.json'))('playwright');
  }
  return playwright.chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
}
