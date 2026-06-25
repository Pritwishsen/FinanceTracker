const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveFile(filePath, res) {
  fs.readFile(filePath, function(err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    var ext = path.extname(filePath);
    var contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(data);
  });
}

function serveAppHtml(res) {
  var firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || ''
  };
  var oauthConfig = {
    googleClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    msClientId: process.env.MICROSOFT_CLIENT_ID || ''
  };
  var configScript = '<script>window.FIREBASE_CONFIG = ' + JSON.stringify(firebaseConfig) + '; window.__OAUTH_CONFIG = ' + JSON.stringify(oauthConfig) + ';</script>\n    ';
  fs.readFile(path.join(ROOT, 'app-v3.html'), function(err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    var html = data.toString().replace('<head>', '<head>\n    ' + configScript);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(html);
  });
}

var server = http.createServer(function(req, res) {
  var urlPath = req.url.split('?')[0];

  if (urlPath === '/' || urlPath === '/index.html' || urlPath === '/app-v3.html') {
    serveAppHtml(res);
    return;
  }

  if (urlPath === '/__health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  var safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  var filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  serveFile(filePath, res);
});

server.on('error', function(err) {
  console.error('Server error:', err.message);
});

server.listen(PORT, '0.0.0.0', function() {
  console.log('Server listening on port ' + PORT);
  var firebaseConfigured = !!(process.env.FIREBASE_API_KEY);
  console.log('Firebase configured:', firebaseConfigured);
});

process.on('SIGTERM', function() {
  console.log('SIGTERM received');
  server.close();
});

process.on('uncaughtException', function(err) {
  console.error('Uncaught:', err.message);
});

process.on('unhandledRejection', function(err) {
  console.error('Unhandled:', err);
});
