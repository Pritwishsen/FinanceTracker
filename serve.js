const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const ROOT = __dirname;
const CACHE_BUST = Date.now().toString();

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  try {
    console.log('REQUEST:', req.url);
    const parsedUrl = new URL(req.url, 'http://localhost');
    let urlPath = parsedUrl.pathname;

    if (urlPath === '/') {
      res.writeHead(302, {
        'Location': '/app-v3.html',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      res.end();
      return;
    }

    const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const filePath = path.join(ROOT, safePath);

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(data);
    });
  } catch (err) {
    console.error('Request error:', err);
    try { res.writeHead(500); res.end('Internal Server Error'); } catch (e) {}
  }
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port ' + PORT);
});

server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

setInterval(() => {}, 30000);
