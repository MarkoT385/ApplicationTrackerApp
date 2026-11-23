import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['app-frontend-27462043200.us-central1.run.app'],
    proxy: {
      '/api': process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3001',
    },
  },
});
