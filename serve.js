const http = require('http');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const PORT = 5000;
const ROOT = __dirname;

const CONTACT_RATE_LIMIT_MAX = 5;
const CONTACT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const contactRequestLog = new Map();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let mailTransporter = null;

function getMailTransporter() {
  if (!mailTransporter) {
    mailTransporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }
  return mailTransporter;
}

function isContactRateLimited(ip) {
  var now = Date.now();
  var timestamps = (contactRequestLog.get(ip) || []).filter(function(t) { return now - t < CONTACT_RATE_LIMIT_WINDOW_MS; });
  if (timestamps.length >= CONTACT_RATE_LIMIT_MAX) {
    contactRequestLog.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  contactRequestLog.set(ip, timestamps);
  return false;
}

function readJsonBody(req, callback) {
  var chunks = [];
  var size = 0;
  var MAX_BODY_BYTES = 20 * 1024;
  req.on('data', function(chunk) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', function() {
    if (size > MAX_BODY_BYTES) {
      callback(new Error('Payload too large'));
      return;
    }
    try {
      var body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
      callback(null, body);
    } catch (e) {
      callback(new Error('Invalid JSON'));
    }
  });
  req.on('error', function(err) {
    callback(err);
  });
}

function sendJson(res, statusCode, obj) {
  var body = JSON.stringify(obj);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function handleContactRequest(req, res) {
  var ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();

  if (isContactRateLimited(ip)) {
    sendJson(res, 429, { error: 'Too many requests. Please try again later.' });
    return;
  }

  readJsonBody(req, function(err, body) {
    if (err) {
      sendJson(res, 400, { error: err.message });
      return;
    }

    var subject = typeof body.subject === 'string' ? body.subject.replace(/[\r\n]+/g, ' ').trim() : '';
    var details = typeof body.details === 'string' ? body.details.trim() : '';
    var replyTo = typeof body.replyTo === 'string' ? body.replyTo.trim() : '';

    if (!subject || subject.length > 200) {
      sendJson(res, 400, { error: 'Subject is required and must be 200 characters or fewer.' });
      return;
    }
    if (!details || details.length > 5000) {
      sendJson(res, 400, { error: 'Details are required and must be 5000 characters or fewer.' });
      return;
    }
    if (replyTo && !EMAIL_RE.test(replyTo)) {
      sendJson(res, 400, { error: 'Reply-to email address is invalid.' });
      return;
    }

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD || !process.env.SUPPORT_EMAIL) {
      console.error('Contact form submitted but email is not configured (GMAIL_USER/GMAIL_APP_PASSWORD/SUPPORT_EMAIL).');
      sendJson(res, 503, { error: 'Contact support is not configured. Please try again later.' });
      return;
    }

    var mailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.SUPPORT_EMAIL,
      subject: '[FinanceTracker Contact] ' + subject,
      text: details
    };
    if (replyTo) {
      mailOptions.replyTo = replyTo;
    }

    getMailTransporter().sendMail(mailOptions, function(sendErr) {
      if (sendErr) {
        console.error('Contact email send failed:', sendErr.message);
        sendJson(res, 502, { error: 'Failed to send message. Please try again later.' });
        return;
      }
      sendJson(res, 200, { ok: true });
    });
  });
}

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

function serveWithOauthConfig(filePath, res) {
  var oauthConfig = {
    googleClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    msClientId: process.env.MICROSOFT_CLIENT_ID || '',
    isProduction: !!(process.env.REPLIT_DEPLOYMENT)
  };
  var configScript = '<script>window.__OAUTH_CONFIG = ' + JSON.stringify(oauthConfig) + ';</script>\n  ';
  fs.readFile(filePath, function(err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    var html = data.toString().replace('<head>', '<head>\n  ' + configScript);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(html);
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
    msClientId: process.env.MICROSOFT_CLIENT_ID || '',
    isProduction: !!(process.env.REPLIT_DEPLOYMENT)
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

  if (urlPath === '/scripts/cloud-sync-test.html') {
    serveWithOauthConfig(path.join(ROOT, 'scripts', 'cloud-sync-test.html'), res);
    return;
  }

  if (urlPath === '/__health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  if (urlPath === '/api/contact' && req.method === 'POST') {
    handleContactRequest(req, res);
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
