import { defineConfig } from 'vite';

// GitHub Pages serves the site at /<repo>/
export default defineConfig({
  base: process.env.BASE_PATH ?? '/maplestory-ev-calculator/',
  build: { target: 'es2022' },
});
