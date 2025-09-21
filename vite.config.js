// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT: set to your repo name with leading & trailing slashes
const base = '/NebulaMC-Pokedex-Palette-Maker/'

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
