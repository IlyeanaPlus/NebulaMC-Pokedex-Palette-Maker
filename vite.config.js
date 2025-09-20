import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // For GitHub Pages, set BASE path (e.g., '/pokedex-palette-previewer/').
  base: process.env.VITE_BASE || '/',
})
