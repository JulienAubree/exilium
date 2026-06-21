// Mini-serveur local : sert le build web STAGING en statique (fallback SPA vers
// index.html) et proxifie /trpc, /sse, /uploads vers l'API staging (:3001).
// But : piloter l'UI React staging en local, sans Caddy ni basic-auth, et
// SANS jamais toucher la prod. Aucune dépendance externe.
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

const PROXY_PREFIXES = ['/trpc', '/sse', '/uploads'];

function isProxied(url) {
  return PROXY_PREFIXES.some((p) => url === p || url.startsWith(p + '/') || url.startsWith(p + '?'));
}

/**
 * @param {{ distDir: string, apiTarget?: string, port?: number }} opts
 * @returns {Promise<{ port: number, url: string, close: () => Promise<void> }>}
 */
export function startStagingServer({ distDir, apiTarget = 'http://localhost:3001', port = 0 } = {}) {
  const target = new URL(apiTarget);
  const root = normalize(distDir);

  const server = http.createServer((req, res) => {
    const url = req.url || '/';

    if (isProxied(url)) {
      const proxyReq = http.request(
        {
          hostname: target.hostname,
          port: target.port || 80,
          path: url,
          method: req.method,
          headers: { ...req.headers, host: target.host },
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
          proxyRes.pipe(res);
        },
      );
      proxyReq.on('error', (e) => {
        res.writeHead(502);
        res.end('proxy error: ' + e.message);
      });
      req.pipe(proxyReq);
      return;
    }

    // Statique avec fallback SPA.
    const clean = decodeURIComponent(url.split('?')[0]);
    let filePath = normalize(join(root, clean));
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
      filePath = join(root, 'index.html');
    }
    const type = MIME[extname(filePath)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type });
    createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const actual = /** @type {{ port: number }} */ (server.address()).port;
      resolve({
        port: actual,
        url: `http://127.0.0.1:${actual}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}
