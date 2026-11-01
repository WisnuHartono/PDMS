import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' agar hasil build bisa dibuka dari Electron (protokol app://) maupun di subfolder web server.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
} as never)
