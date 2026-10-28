import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://gabibertero.github.io',
  outDir: '../docs', // NUNCA '../' ni la raíz: Astro vacía outDir y borraría .git
  base: '/mis_correlativas/',
  output: 'static',
  build: { assets: 'assets-astro' }, // sin guion bajo: Jekyll ignora carpetas con _
});
