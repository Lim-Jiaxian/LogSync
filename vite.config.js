import fs from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const NAVY = '#14212b';

// Store-style screenshots shown in the install dialog (Chrome/Edge). Added only if present.
const screenshots = [
  { src: '/screenshots/mobile-armoury.png', sizes: '780x1688', form_factor: 'narrow', label: 'HOTO checklist for an appliance' },
  { src: '/screenshots/mobile-tracker.png', sizes: '780x1688', form_factor: 'narrow', label: 'Equipment status and change log' },
  { src: '/screenshots/desktop-tracker.png', sizes: '1440x900', form_factor: 'wide', label: 'Equipment tracker on a station PC' },
].filter((s) => fs.existsSync('public' + s.src)).map((s) => ({ ...s, type: 'image/png' }));

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // We show our own "new version" prompt, so an update never reloads someone mid-checklist.
      registerType: 'prompt',
      injectRegister: false, // registered in src/pwa.js
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'LogSync – Station Equipment',
        short_name: 'LogSync',
        description: 'Handover checklists, equipment status and servicing requests for every rota at the station.',
        lang: 'en-SG',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: NAVY,
        theme_color: NAVY,
        categories: ['productivity', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'HOTO checklist', short_name: 'HOTO', url: '/home?tab=armoury', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Equipment & log', short_name: 'Equipment', url: '/home?tab=tracker', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
        screenshots,
      },
      workbox: {
        // Precache the app shell; screenshots are only for the install dialog.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        globIgnores: ['screenshots/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // The API is never cached by the service worker: responses are per-user and must be live.
        // (The app keeps its own per-user offline snapshot, cleared at logout.)
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    open: true,
    // In development the API runs separately (npm run server); in production Express serves both.
    proxy: { '/api': 'http://localhost:3000' },
  },
  preview: { proxy: { '/api': 'http://localhost:3000' } },
});
