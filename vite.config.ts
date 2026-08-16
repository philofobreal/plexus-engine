import { defineConfig } from 'vite'
import { devPresetSavePlugin } from './scripts/devPresetSavePlugin.mjs'

export default defineConfig({
  base: '/plexus-engine/',
  plugins: [devPresetSavePlugin()]
})
