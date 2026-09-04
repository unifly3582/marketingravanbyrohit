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
      '/api': 'http://localhost:8787',
    },
  },
})
