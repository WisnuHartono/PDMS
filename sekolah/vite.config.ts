import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' agar hasil build bisa dibuka dari Electron (protokol app://) maupun di subfolder web server.
// SIMAS_SATU=1: satu berkas JS saja (untuk pratinjau yang digabung ke satu HTML).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: process.env.SIMAS_SATU ? { rollupOptions: { output: { inlineDynamicImports: true } } } : undefined,
  test: { environment: 'node' },
} as never)
