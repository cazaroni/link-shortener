import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Copies the built index.html to 404.html. When a 404.html exists, Cloudflare Pages serves it
 * with a real 404 status for any path that isn't a file or a function route (e.g. /foo/bar,
 * /dashboard, /missing.js) instead of falling back to index.html with a 200. The SPA then
 * renders its "link not found" page from that same shell.
 */
function spaNotFoundPage(): Plugin {
  let outDir = 'dist'
  return {
    name: 'spa-404-page',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
    },
  }
}

// https://vite.dev/config/
// In `npm run dev`, Vite serves the UI and proxies /api to `wrangler pages dev` (npm run dev:api).
export default defineConfig({
  plugins: [react(), spaNotFoundPage()],
  server: {
    proxy: {
      '/api': 'http://localhost:8788',
    },
  },
})
