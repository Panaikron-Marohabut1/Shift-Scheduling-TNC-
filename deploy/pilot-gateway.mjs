import { createServer, request as proxyRequest } from 'node:http';

const hopHeaders = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade'];

function forwardedHeaders(headers) {
  const omitted = new Set([...hopHeaders, ...String(headers.connection || '').toLowerCase().split(/\s*,\s*/)]);
  return Object.fromEntries(Object.entries(headers).filter(([key]) => !omitted.has(key)));
}

export function createPilotGateway({ origin, apiPort = 3000, authPort = 3001 }) {
  const publicUrl = new URL(origin);
  if (publicUrl.protocol !== 'https:' || publicUrl.origin !== origin || publicUrl.port) {
    throw new Error('Pilot ingress requires an HTTPS origin without a port.');
  }

  return createServer({ requestTimeout: 30_000, headersTimeout: 10_000 }, (request, response) => {
    const reply = status => { response.writeHead(status, { 'Cache-Control': 'no-store' }); response.end(); };
    if (request.headers.host !== publicUrl.host) return reply(421);
    if (!request.url?.startsWith('/') || request.url.startsWith('//')) return reply(400);
    const pathname = request.url.split('?', 1)[0];
    if (/\\|%(?:2e|2f|5c|25)|(?:^|\/)\.{1,2}(?:\/|$)/i.test(pathname)) return reply(400);
    if (pathname === '/api/auth/session' || pathname.startsWith('/api/auth/session/')) return reply(404);
    const auth = pathname === '/login' || pathname === '/login/' || pathname === '/auth/sign-in' || pathname.startsWith('/_next/static/');
    const headers = forwardedHeaders(request.headers);
    for (const name of Object.keys(headers)) {
      if (name === 'forwarded' || name.startsWith('x-forwarded-') || name.startsWith('x-middleware-') || name.startsWith('x-nextjs-')) delete headers[name];
    }
    headers.host = publicUrl.host;
    headers['x-forwarded-host'] = publicUrl.host;
    headers['x-forwarded-proto'] = 'https';
    const upstream = proxyRequest({
      hostname: '127.0.0.1', port: auth ? authPort : apiPort, path: request.url,
      method: request.method, headers, timeout: 25_000,
    }, result => {
      const outgoing = forwardedHeaders(result.headers);
      outgoing['strict-transport-security'] = 'max-age=31536000';
      response.writeHead(result.statusCode, outgoing);
      result.on('error', () => response.destroy());
      result.pipe(response);
    });
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => { if (response.headersSent) response.destroy(); else reply(502); });
    response.on('close', () => { if (!response.writableEnded) upstream.destroy(); });
    request.pipe(upstream);
  });
}
