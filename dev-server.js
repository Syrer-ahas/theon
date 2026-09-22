import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { verifyGoogleJWT } from './api/_auth.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || 'localhost';
const maxBodyBytes = 1024 * 1024;

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.dll': 'application/octet-stream',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': mimeTypes['.json'], 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function handleApi(request, response, pathname) {
  const route = pathname.slice('/api/'.length);
  if (!/^[a-z][a-z0-9-]*$/i.test(route)) return sendJson(response, 404, { error: 'Not found.' });

  let apiModule;
  try {
    apiModule = await import(pathToFileURL(path.join(root, 'api', route + '.js')).href);
  } catch (error) {
    console.error('API route load failed:', error);
    return sendJson(response, 404, { error: 'Not found.' });
  }

  try {
    request.rawBody = request.method === 'GET' || request.method === 'HEAD' ? Buffer.alloc(0) : await readBody(request);
    request.body = request.rawBody.length ? JSON.parse(request.rawBody.toString('utf8')) : {};
  } catch (_) {
    return sendJson(response, 400, { error: 'Invalid request body.' });
  }

  const adapter = {
    setHeader: (name, value) => { response.setHeader(name, value); },
    status(code) { response.statusCode = code; return adapter; },
    json(body) {
      response.setHeader('Content-Type', mimeTypes['.json']);
      response.end(JSON.stringify(body));
      return adapter;
    },
    end(body) { response.end(body); return adapter; }
  };

  try {
    await apiModule.default(request, adapter);
  } catch (error) {
    console.error('API route failed:', error);
    if (!response.headersSent) sendJson(response, 500, { error: 'Service error.' });
    else response.end();
  }
}

async function handleStatic(response, pathname, cookieHeader = '') {
  if (pathname === '/dashboard.html') {
    const cookie = cookieHeader.split(';').map((item) => item.trim()).find((item) => item.startsWith('tactical-admin-session='));
    const token = cookie ? decodeURIComponent(cookie.slice('tactical-admin-session='.length)) : '';
    const admin = token ? await verifyGoogleJWT(token).catch(() => null) : null;
    const adminEmail = 'alkhidirea@gmail.com';
    if (!admin || String(admin.email || '').trim().toLowerCase() !== adminEmail) {
      return sendJson(response, 404, { error: 'Not found.' });
    }
  }
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(root + path.sep)) return sendJson(response, 403, { error: 'Forbidden.' });

  try {
    const data = await fs.readFile(target);
    const extension = path.extname(target).toLowerCase();
    response.writeHead(200, {
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
      'Cache-Control': extension === '.html' || extension === '.js' ? 'no-store' : 'public, max-age=300',
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
    });
    response.end(data);
  } catch (_) {
    const fallback = await fs.readFile(path.join(root, '503.html'));
    response.writeHead(404, { 'Content-Type': mimeTypes['.html'], 'Cache-Control': 'no-store' });
    response.end(fallback);
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/health') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    });
    return response.end();
  }
  if (url.pathname.startsWith('/api/')) return handleApi(request, response, url.pathname);
  return handleStatic(response, url.pathname, request.headers.cookie || '');
});

server.listen(port, host, () => {
  console.log(`Tactical Web is running at http://localhost:${port}`);
  console.log('Open that address in your browser; Google sign-in cannot run from file://.');
});
