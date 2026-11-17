import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: '*.spec.mjs', outputDir: '../test-results',
  fullyParallel: true, reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4399/mis_correlativas/' },
  webServer: { command: 'npx astro preview --host 127.0.0.1 --port 4399', url: 'http://127.0.0.1:4399/mis_correlativas/', reuseExistingServer: true },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'celular', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
});
