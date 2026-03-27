#!/usr/bin/env node

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = resolve(__dirname, '..', 'build');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const port = parseInt(process.argv.find((_, i, a) => a[i - 1] === '--port') ?? '3000', 10);

const server = createServer(async (req, res) => {
  let filePath = join(buildDir, req.url === '/' ? 'index.html' : req.url);

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    // SPA fallback — serve index.html for any path without a file extension
    try {
      const index = await readFile(join(buildDir, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(index);
    } catch {
      res.writeHead(404);
      res.end('Not found. Did you run "npm run build" first?');
    }
  }
});

server.listen(port, () => {
  console.log(`edrclient running at http://localhost:${port}`);
});
