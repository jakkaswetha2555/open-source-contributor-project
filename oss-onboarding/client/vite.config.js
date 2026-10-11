import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API runs on :5000. Proxying /api keeps the browser on one origin, so the session cookie just works.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:5000' } },
});
