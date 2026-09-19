import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Every build gets its own asset filenames, not just the ones whose contents
// changed.
//
// Content hashing alone is not enough in front of a CDN. On 2026-09-05 the live
// site rendered a blank page for hours because Cloudflare had cached a 522 for
// assets/rolldown-runtime-hePW80VL.js — the module runtime, without which
// nothing mounts. The origin served that file in 58 ms; the edge kept handing
// back the error, and the same URL with a cache-buster returned 200 instantly.
// The error was almost certainly captured mid-deploy, while `vite build` had
// emptied dist and the file genuinely did not exist for a moment.
//
// Rotating the build stamp in main.jsx did not help: it only changes the chunk
// that contains it, and the poisoned file was a shared runtime chunk whose
// contents were identical, so index.html kept pointing at the same dead URL.
//
// With a build id in the name, a deploy can never point at a URL the edge has
// seen before. The cost is that one deploy invalidates every asset instead of
// only the changed ones — cheap next to serving a blank page.
const BUILD_ID = Date.now().toString(36)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Vite's default target is "baseline widely available" (Chrome 107+,
    // Safari 16+). Older phone browsers (Samsung Internet, in-app WebViews,
    // iOS 15) then choke on unsupported syntax and unprefixed CSS and the
    // whole page, not just its animations, stops working. Lower the floor:
    // syntax is transpiled to ES2020 and Lightning CSS adds the -webkit-
    // prefixes (backdrop-filter, mask-image) those browsers still need.
    target: ['es2020', 'chrome87', 'safari14', 'firefox78', 'edge88'],
    cssTarget: ['chrome87', 'safari14', 'firefox78', 'edge88'],
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-${BUILD_ID}-[hash].js`,
        chunkFileNames: `assets/[name]-${BUILD_ID}-[hash].js`,
        assetFileNames: `assets/[name]-${BUILD_ID}-[hash][extname]`,
      },
    },
  },
  server: {
    // honor the port assigned by the preview harness (PORT env var)
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
    proxy: {
      // ws:true is required for the website voice agent: /api/voice/web is a
      // WebSocket upgrade, and Vite's proxy passes only plain HTTP unless it
      // is told otherwise — the socket simply never opens, with no error.
      '/api': { target: 'http://localhost:8787', ws: true },
    },
  },
})
