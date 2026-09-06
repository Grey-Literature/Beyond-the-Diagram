import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Each entry below is one island: a self-contained bundle a static HTML
// page loads via <script type="module" src="..."> and that mounts itself
// into a matching #<name>-root div. This is not a single-page app with a
// router — add a new entry here for each island as it's built.
const islands = {
  'drill-http-401-403': resolve(import.meta.dirname, 'src/islands/drill-401-403/main.tsx'),
  'case-trust-relationship': resolve(import.meta.dirname, 'src/islands/case-trust-relationship/main.tsx'),
  'placement-quiz-networking': resolve(import.meta.dirname, 'src/islands/placement-quiz/main.tsx'),
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Overrides Vite's default index.html entry — index.html here is a
      // dev-only sandbox (see the file itself) and is never built/shipped.
      input: islands,
      output: {
        entryFileNames: 'islands/[name].js',
        chunkFileNames: 'islands/chunks/[name]-[hash].js',
        // No hash on assets (deliberately) — a hand-written static page
        // needs a stable filename to link a <link rel="stylesheet"> to.
        // Tradeoff: no cache-busting on CSS changes; acceptable at this
        // scale. Revisit if/when a real build+deploy pipeline templates
        // the consuming pages instead of hand-authoring them.
        assetFileNames: 'islands/assets/[name][extname]',
      },
    },
  },
})
