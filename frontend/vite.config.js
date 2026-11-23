import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'https://app-backend-27462043200.us-central1.run.app',
        changeOrigin: true,
      },
    },
  },
  preview: {
    allowedHosts: true,
  },
});