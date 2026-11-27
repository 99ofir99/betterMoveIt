import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Android Chrome will NOT mint a real "Install app" / WebAPK from Vite's
// development service worker — it only offers "Create shortcut". Install
// testing must use a production build served over HTTPS (ngrok → :8787).
const pwaInDev = process.env.PWA_DEV === '1';

/** Replaces a leftover production SW so ngrok phones stop serving the old build. */
function killStalePwaInDev(): Plugin {
  const killSw = `/* betterMoveIt dev: clear production PWA cache */
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const c of clients) c.navigate(c.url);
  })());
});
`;
  return {
    name: 'kill-stale-pwa-in-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        if (path === '/sw.js' || path === '/registerSW.js' || path.startsWith('/workbox-')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(path === '/sw.js' ? killSw : '');
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    killStalePwaInDev(),
    VitePWA({
      registerType: 'autoUpdate',
      // Keep SW off in normal/tunnel Vite. Production `web/dist` + `npm start` is installable.
      devOptions: {
        enabled: pwaInDev,
        type: 'module',
        navigateFallback: 'index.html',
      },
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        id: '/',
        name: 'betterMoveIt',
        short_name: 'betterMoveIt',
        description: 'Ad-free multimodal transit with every feature unlocked.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // OpenFreeMap dark / liberty vector tiles + glyphs.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openfreemap-tiles',
              expiration: { maxEntries: 4000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Carto Dark Matter (Moovit-night raster fallback).
            urlPattern: /^https:\/\/[abcd]\.basemaps\.cartocdn\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'carto-dark-tiles',
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Google Maps raster tiles (mt0–mt3): night-paint fallback.
            urlPattern: /^https:\/\/mt[0-3]\.google\.com\/vt\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-map-tiles',
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // OSM fallback tiles.
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 14 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Stop detail / search can be briefly stale; nearby must stay fresh
            // (location-keyed empty results would otherwise stick for an hour).
            urlPattern: /\/api\/(health|stop|search).*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'transit-api', expiration: { maxEntries: 300, maxAgeSeconds: 3600 } },
          },
          {
            urlPattern: /\/api\/nearby.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'transit-nearby',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 60, maxAgeSeconds: 120 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    // Listen on 0.0.0.0 so ngrok can reach 127.0.0.1:5173 (not only ::1).
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: [
      '.ngrok-free.app',
      '.ngrok-free.dev',
      '.ngrok.app',
      '.ngrok.io',
      '.loca.lt',
      'loca.lt',
    ],
    // Tunnel mode needs WSS on 443; plain localhost keeps Vite's default HMR.
    ...(process.env.DEV_TUNNEL === '1'
      ? { hmr: { protocol: 'wss' as const, clientPort: 443 } }
      : {}),
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1200 },
});
