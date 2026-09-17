import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'test-results', 'playwright-report'],
    // @mui/x-data-grid's entry imports its own .css, which Node cannot load
    // when the package is externalized. Inlining it lets Vite handle the
    // import the way it does in the app build.
    server: { deps: { inline: [/@mui\/x-data-grid/] } }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});