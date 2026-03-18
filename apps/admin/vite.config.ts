import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

/** Serve game assets from apps/web/public so admin can display thumbnails */
function serveWebAssets(): Plugin {
  const webPublicDir = path.resolve(__dirname, '../web/public');
  return {
    name: 'serve-web-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/assets/')) {
          const cleanUrl = req.url.split('?')[0]; // strip cache-bust query
          const filePath = path.join(webPublicDir, cleanUrl);
          if (fs.existsSync(filePath)) {
            if (cleanUrl.endsWith('.webp')) res.setHeader('Content-Type', 'image/webp');
            else if (cleanUrl.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
            else if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) res.setHeader('Content-Type', 'image/jpeg');
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveWebAssets()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/trpc': 'http://localhost:3000',
      '/admin': 'http://localhost:3000',
    },
  },
});
