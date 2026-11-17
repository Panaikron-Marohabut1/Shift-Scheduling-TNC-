import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { test } from 'node:test';
import { createPilotGateway } from './pilot-gateway.mjs';

const origin = 'https://pilot.example.test';

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function send(ingress, path, options = {}) {
  return new Promise((resolve, reject) => {
    const call = request(`${ingress}${path}`, {
      ...options, headers: { host: new URL(origin).host, ...options.headers },
    }, async response => {
      try {
        const chunks = [];
        for await (const chunk of response) chunks.push(chunk);
        resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() });
      } catch (error) { reject(error); }
    });
    call.on('error', reject);
    call.end();
  });
}

test('pilot keeps browser routing, proxy headers and session cookies on one origin', async context => {
  function stub(service) {
    return createServer((request, response) => {
      response.setHeader('Content-Type', 'application/json');
      if (request.url === '/auth/sign-in') response.setHeader('Set-Cookie', ['session.0=a; Secure', 'session.1=b; Secure']);
      response.end(JSON.stringify({ service, path: request.url, headers: request.headers }));
    });
  }
  const api = stub('api');
  const auth = stub('auth');
  context.after(() => { api.close(); auth.close(); });
  const [apiPort, authPort] = await Promise.all([listen(api), listen(auth)]);
  const gateway = createPilotGateway({ origin, apiPort, authPort });
  context.after(() => gateway.close());
  const ingress = `http://127.0.0.1:${await listen(gateway)}`;
  const get = (path, options) => send(ingress, path, options);

  for (const [path, service] of [['/', 'api'], ['/api/auth/logout', 'api'], ['/fonts/sarabun.woff2', 'api'],
    ['/login?redirect_to=%2F', 'auth'], ['/_next/static/login.js', 'auth']]) {
    const response = await get(path);
    assert.equal(response.status, 200, path);
    assert.equal(JSON.parse(response.body).service, service);
  }
  assert.equal((await get('/api/auth/session')).status, 404);
  assert.equal((await get('/_next/static/%252e%252e/api/auth/session')).status, 400);
  assert.equal((await get('/login', { headers: { host: 'untrusted.example.test' } })).status, 421);
  const login = await get('/auth/sign-in', { method: 'POST', headers: {
    origin, cookie: 'session.0=old', 'x-forwarded-proto': 'http', 'x-forwarded-host': 'untrusted.example.test',
    'x-middleware-subrequest': 'proxy',
  } });
  assert.deepEqual(login.headers['set-cookie'], ['session.0=a; Secure', 'session.1=b; Secure']);
  assert.equal(login.headers['strict-transport-security'], 'max-age=31536000');
  const proxied = JSON.parse(login.body);
  assert.equal(proxied.service, 'auth');
  assert.equal(proxied.headers.origin, origin);
  assert.equal(proxied.headers.cookie, 'session.0=old');
  assert.equal(proxied.headers['x-forwarded-proto'], 'https');
  assert.equal(proxied.headers['x-forwarded-host'], 'pilot.example.test');
  assert.equal(proxied.headers['x-middleware-subrequest'], undefined);
});

test('hosted shared demo exposes Microsoft login but keeps the session and Auth logout endpoints private', async context => {
  const api = createServer((_, response) => { response.end('api'); });
  const auth = createServer((_, response) => { response.end('auth'); });
  const [apiPort, authPort] = await Promise.all([listen(api), listen(auth)]);
  const gateway = createPilotGateway({ origin, apiPort, authPort, microsoft: true });
  context.after(() => { gateway.closeAllConnections(); gateway.close(); api.close(); auth.close(); });
  const ingress = `http://127.0.0.1:${await listen(gateway)}`;
  for (const [path, method] of [['/auth/microsoft', 'POST'], ['/auth/callback?code=fixture', 'GET'],
    ['/assets/login-plant.webp', 'GET'], ['/assets/login-product.jpg', 'GET']]) {
    const result = await send(ingress, path, { method });
    assert.equal(result.status, 200, path);
    assert.equal(result.body, 'auth', path);
  }
  for (const path of ['/api/auth/session', '/auth/logout']) {
    const result = await send(ingress, path);
    assert.equal(result.status, 404);
  }
  const result = await send(ingress, '/api/auth/logout', { method: 'POST' });
  assert.equal(result.body, 'api');
});
