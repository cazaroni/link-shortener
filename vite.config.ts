import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// In `npm run dev`, Vite serves the UI and proxies /api to `wrangler pages dev` (npm run dev:api).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8788',
    },
  },
})
