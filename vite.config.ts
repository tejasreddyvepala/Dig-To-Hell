import { defineConfig } from 'vite';
import pkg from './package.json';

// Relative asset URLs so the build runs from any sub-folder (portal CDNs, itch.io / GameDistribution zips, file hosts).
export default defineConfig({
  base: './',
  define: { __VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2020', assetsInlineLimit: 4096 },
});
