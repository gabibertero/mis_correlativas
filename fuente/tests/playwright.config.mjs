import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: '*.spec.mjs', outputDir: '../test-results',
  fullyParallel: true, reporter: [['list']],
  use: { baseURL: 'http://localhost:4399/Correlativas/' },
  webServer: { command: 'npx astro preview --port 4399', url: 'http://localhost:4399/Correlativas/', reuseExistingServer: true },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'celular', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
});
