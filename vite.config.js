import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt', not 'autoUpdate': this app autosaves to IndexedDB 2s
      // after you stop typing, but there's still a window where an
      // in-flight write could be interrupted by the page silently
      // reloading out from under it. A new service worker installs in
      // the background as usual; nothing takes over the page until the
      // person explicitly confirms via the update prompt (App.jsx).
      registerType: 'prompt',
      injectRegister: null, // registering manually via useRegisterSW in App.jsx, not the auto-injected script
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'SecureDiary',
        short_name: 'SecureDiary',
        description: 'Tactile, skeuomorphic, zero-knowledge encrypted, local-first diary.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#d9cdb8',
        theme_color: '#6b4226',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the whole app shell (JS/CSS/HTML/fonts/icons) so the
        // app opens with zero network - matches the local-first premise
        // the rest of the app is already built around.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
        // Deliberately no runtimeCaching entries for the Supabase
        // domain: anything not matched by an explicit rule just passes
        // through to the network uncached, which is exactly what a
        // sync/auth API needs - caching a stale query result or an
        // auth response would be actively wrong, not just unhelpful.
      },
    }),
  ],
});
