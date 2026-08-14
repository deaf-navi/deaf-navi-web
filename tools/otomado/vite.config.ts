/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' — GitHub Pages のサブパスでも VPS でもローカルでも動く相対パス構成
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: '../../docs/otomado',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    css: false,
  },
})
