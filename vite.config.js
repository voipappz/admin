import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

// Dev HTTPS: WebRTC getUserMedia (the softphone mic) only works in a SECURE
// context — HTTPS or localhost. Accessed via a LAN/public IP over plain http the
// browser blocks the mic and calls fail ("Media devices not available in insecure
// contexts"). If a self-signed dev cert exists (certs/, openssl-generated), serve
// over HTTPS so the phone can dial from any host.
const ROOT_DIR = dirname(fileURLToPath(import.meta.url))
const DEV_KEY = resolve(ROOT_DIR, 'certs/dev-key.pem')
const DEV_CRT = resolve(ROOT_DIR, 'certs/dev-cert.pem')
const devHttps = fs.existsSync(DEV_KEY) && fs.existsSync(DEV_CRT)
  ? { key: fs.readFileSync(DEV_KEY), cert: fs.readFileSync(DEV_CRT) }
  : undefined

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [react()],
    // The Elixir portal is the single upstream: it serves /ws/events and
    // forwards /api, /auth and /tasks to the mothership server-side. The
    // browser only ever talks to Vite, which forwards internally, so the app
    // works however it is reached and the portal's port is never exposed.
    // Override the host with VITE_PORTAL_TARGET.
    server: {
      host: '0.0.0.0',
      port: 4200,
      https: devHttps,
    proxy: (() => {
      const PORTAL = process.env.VITE_PORTAL_TARGET || 'http://localhost:4001';
      return {
        // All portal traffic enters Elixir in development, matching the
        // production topology: one process serves the SPA, the socket and the
        // forwarded routes, so the browser remains same-origin.
        '/api':   { target: PORTAL, changeOrigin: true },
        '/tasks': { target: PORTAL, changeOrigin: true },
        '/auth':  { target: PORTAL, changeOrigin: true },
        '/ws/events': { target: PORTAL, changeOrigin: true, ws: true },
        // Everything the portal serves itself, under one dev-only prefix that
        // is stripped on the way through. The prefix exists because
        // `/dashboard` and `/calls` are React routes as well as backend paths:
        // a proxy rule on either name would stop the page from loading.
        // Production has one origin and no prefix — see `lib/clients/portalApi.js`.
        '/portal': { target: PORTAL, changeOrigin: true, rewrite: (p) => p.replace(/^\/portal/, '') },
        // The PostgREST plane, still unserved since the Deno BFF was removed.
        // Pointed at the portal deliberately: it 404s there, which is legible,
        // whereas leaving it out makes Vite answer a JSON fetch with the SPA's
        // index.html and the caller fails on a parse error instead.
        '/rest/v1': { target: PORTAL, changeOrigin: true },
      };
    })(),
  },
  build: {
    sourcemap: false, // Disable sourcemap in production to reduce size
    rollupOptions: {
      output: {
        // Simpler chunking strategy to avoid React compatibility issues
        manualChunks: {
          // Keep React and related libraries in one chunk to prevent compatibility issues
          'vendor': [
            'react',
            'react-dom',
            'react-router-dom',
            'scheduler'
          ],
          // UI components - all MUI together
          'mui': [
            '@mui/material',
            '@mui/icons-material',
            '@emotion/react',
            '@emotion/styled'
          ]
        }
      }
    },
    // Increase the warning limit to avoid warning for moderately sized chunks
    chunkSizeWarningLimit: 1000
  },
  resolve: {
    alias: {
      '@': resolve(ROOT_DIR, 'src')
    }
  }
  }
})
