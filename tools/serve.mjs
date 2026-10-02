// Kleiner statischer HTTP-Server ohne Abhängigkeiten (ES-Module brauchen http:// statt file://).
// Aufruf: node tools/serve.mjs [port]   –   oder in Tests: const srv = await startServer({ port: 0 })
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8'
};

/**
 * Startet den Server.
 * @param {{ port?: number, root?: string, host?: string }} [opts]
 * @returns {Promise<{ server: http.Server, url: string, close: () => Promise<void> }>}
 */
export function startServer({ port = 8080, root = ROOT, host = '127.0.0.1' } = {}){
  const server = http.createServer(async (req, res) => {
    try {
      const u = new URL(req.url || '/', 'http://x');
      let rel = decodeURIComponent(u.pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.resolve(root, '.' + rel);
      if (file !== root && !file.startsWith(root + path.sep)){ res.writeHead(403).end('verboten'); return; }
      const st = await stat(file);
      if (!st.isFile()){ res.writeHead(404).end('nicht gefunden'); return; }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end('nicht gefunden');
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const addr = /** @type {import('node:net').AddressInfo} */ (server.address());
      resolve({ server, url: `http://${host}:${addr.port}/`, close: () => new Promise(r => server.close(() => r())) });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const port = Number(process.argv[2] || process.env.PORT || 8080);
  startServer({ port }).then(({ url }) => console.log(`Einarmiger Bandit läuft auf ${url}  (Strg+C beendet)`));
}
