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
  'case-dhcp-apipa': resolve(import.meta.dirname, 'src/islands/case-dhcp-apipa/main.tsx'),
  'drill-dhcp-1059': resolve(import.meta.dirname, 'src/islands/drill-dhcp-1059/main.tsx'),
  'case-dns-split-horizon': resolve(import.meta.dirname, 'src/islands/case-dns-split-horizon/main.tsx'),
  'drill-dns-nxdomain': resolve(import.meta.dirname, 'src/islands/drill-dns-nxdomain/main.tsx'),
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
        // Islands inline their own CSS via a `<style>` tag (see any
        // component's `import styles from './X.css?raw'`) rather than a
        // separate linked stylesheet — a consuming static page only ever
        // needs the one <script> tag. This isn't just simpler: with
        // unhashed filenames (needed so a hand-written page can link a
        // stable name), two islands whose CSS ends up byte-identical
        // after edits get silently deduped into one file by Rollup,
        // dropping the other's stylesheet entirely — hit this for real
        // between the DHCP and DNS Drills. Inlining sidesteps the whole
        // class of bug. Only non-CSS assets (fonts, images) would still
        // land here if an island ever needs one.
        assetFileNames: 'islands/assets/[name][extname]',
      },
    },
  },
})
