import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import manifest from './src/manifest';

// BROWSER=firefox switches the CRXJS output target (MV3 background differs
// slightly between Chrome and Firefox). Defaults to Chrome.
const browser = process.env.BROWSER === 'firefox' ? 'firefox' : 'chrome';

export default defineConfig({
  plugins: [tailwindcss(), crx({ manifest, browser })],
  build: {
    outDir: browser === 'firefox' ? 'dist/firefox' : 'dist/chrome',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
});
