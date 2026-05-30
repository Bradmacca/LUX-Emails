import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import manifest from './manifest.json'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      // Resolve the shared workspace package directly to its TypeScript source
      shared: resolve(__dirname, '../shared/types.ts'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
