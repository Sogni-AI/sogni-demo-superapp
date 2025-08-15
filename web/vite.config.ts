import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Check for API port from environment or default to 3001
const API_PORT = process.env.API_PORT || process.env.PORT || 3001;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('🔄 Proxy error (API server may be starting):', err.message);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log(`🔄 Proxying ${req.method} ${req.url} to ${proxyReq.getHeader('host')}`);
          });
        },
      }
    }
  }
});
