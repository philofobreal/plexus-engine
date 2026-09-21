import { resolve } from 'path'
import { defineConfig } from 'vite'
import { devPresetSavePlugin } from './scripts/devPresetSavePlugin.mjs'

export default defineConfig({
  base: '/plexus-engine/',
  // Genuine multi-page app (main dashboard + mvp): disable Vite's default SPA
  // history-fallback middleware so a request/reload under /mvp/ is served by
  // mvp/index.html instead of being rewritten back to the root index.html.
  appType: 'mpa',
  plugins: [devPresetSavePlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        mvp: resolve(__dirname, 'mvp/index.html')
      }
    }
  }
})
