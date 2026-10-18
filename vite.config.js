import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    // Admin (PDF export) is lazy-loaded; the main chunk is the editor stack
    // (Tiptap/ProseMirror/Yjs) which the app can't open without.
    chunkSizeWarningLimit: 900,
  },
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
        id: '/',
        name: 'SecureDiary',
        short_name: 'SecureDiary',
        description: 'Tactile, zero-knowledge encrypted, local-first diary. Works offline.',
        lang: 'en',
        dir: 'auto',
        categories: ['productivity', 'lifestyle', 'utilities'],
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        background_color: '#d9cdb8',
        theme_color: '#6b4226',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'New entry', short_name: 'New', description: 'Start a blank page', url: '/?action=new', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Search', short_name: 'Search', description: 'Search your diary', url: '/?action=search', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Contents', short_name: 'Contents', description: 'Browse all entries', url: '/?action=contents', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
        ],
        // "Share to SecureDiary": shared text/links open a new entry (handled in DiaryShell).
        share_target: {
          action: '/',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        screenshots: [
          { src: '/screenshots/desktop.png', sizes: '1280x800', type: 'image/png', form_factor: 'wide', label: 'A leather diary that encrypts everything on your device' },
          { src: '/screenshots/phone.png', sizes: '540x960', type: 'image/png', form_factor: 'narrow', label: 'Write, draw and record - fully offline' },
        ],
      },
      workbox: {
        // Precache the whole app shell (JS/CSS/HTML/fonts/icons) so the
        // app opens with zero network - matches the local-first premise
        // the rest of the app is already built around.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
        // Offline navigations fall back to the app shell, except the standalone diagnostics page.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/diagnostics\.html/, /^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: false, // an update only takes over after the person confirms (see UpdatePrompt)
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Deliberately no runtimeCaching entries for the Supabase
        // domain: anything not matched by an explicit rule just passes
        // through to the network uncached, which is exactly what a
        // sync/auth API needs - caching a stale query result or an
        // auth response would be actively wrong, not just unhelpful.
      },
    }),
  ],
});
