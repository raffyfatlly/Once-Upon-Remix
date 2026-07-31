
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Expose env variables starting with VITE_ (default) AND CHIP_
  envPrefix: ['VITE_', 'CHIP_'], 
  server: {
    proxy: {
      '/api/chip': {
        target: 'https://gate.chip-in.asia/api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/chip/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
