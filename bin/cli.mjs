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
const cartoApiKey =
  process.argv.find((_, i, a) => a[i - 1] === '--carto-api-key') ??
  process.env.CARTO_API_KEY;

async function serveIndex(res) {
  const html = await readFile(join(buildDir, 'index.html'), 'utf-8');
  const runtimeConfig = `<script>window.__RUNTIME_CONFIG__ = ${JSON.stringify({ VITE_CARTO_API_KEY: cartoApiKey })};</script>`;
  const injected = html.includes('</head>')
    ? html.replace('</head>', `${runtimeConfig}</head>`)
    : runtimeConfig + html;
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(injected);
}

const server = createServer(async (req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    try {
      await serveIndex(res);
    } catch {
      res.writeHead(404);
      res.end('Not found. Did you run "npm run build" first?');
    }
    return;
  }

  const filePath = join(buildDir, req.url);

  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    // SPA fallback — serve index.html for any path without a file extension
    try {
      await serveIndex(res);
    } catch {
      res.writeHead(404);
      res.end('Not found. Did you run "npm run build" first?');
    }
  }
});

server.listen(port, () => {
  console.log(`edrclient running at http://localhost:${port}`);
});
