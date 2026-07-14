import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Dev: proxy API calls to the local FastAPI backend on :8081.
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
});
