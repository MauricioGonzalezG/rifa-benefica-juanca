import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from '../api/numbers.js';
const root = fileURLToPath(new URL('../public/', import.meta.url));
const port = Number(process.env.PORT || 3000);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpeg': 'image/jpeg' };
http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/api/numbers') {
    res.status = code => { res.statusCode = code; return res; };
    res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
    const parts = []; let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 4096) { res.status(413).json({ error: 'Solicitud demasiado grande.' }); return; }
      parts.push(chunk);
    }
    req.body = Buffer.concat(parts).toString();
    return handler(req, res);
  }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const data = await fs.readFile(file);
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(data);
  } catch { res.writeHead(404).end('No encontrado'); }
}).listen(port, '127.0.0.1', () => console.log(`App: http://localhost:${port}`));
