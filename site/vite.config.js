import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
