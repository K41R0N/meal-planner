import { createServer, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { createApp } from './app.ts';
import { acceptsGzip, encodeStatic } from './static-compression.ts';

const staticRoot = resolve(process.env.STATIC_ROOT ?? join(process.cwd(), 'dist'));
const api = createApp();
const encodedCache = new Map<string, { stamp: string; body: Buffer; encoding?: 'gzip' }>();
const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};
const safeStaticPath = (pathname: string): string | null => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const candidate = resolve(staticRoot, `.${decoded}`);
  const pathFromRoot = relative(staticRoot, candidate);
  return pathFromRoot &&
    !pathFromRoot.startsWith('..') &&
    !pathFromRoot.includes(`..${process.platform === 'win32' ? '\\' : '/'}`)
    ? candidate
    : null;
};
const sendFile = async (
  response: ServerResponse,
  file: string,
  headOnly: boolean,
  acceptEncoding: string | undefined,
): Promise<boolean> => {
  try {
    const details = await stat(file);
    if (!details.isFile()) return false;
    const type = mimeTypes[extname(file).toLowerCase()] ?? 'application/octet-stream';
    const key = `${file}:${acceptsGzip(acceptEncoding) ? 'gzip' : 'raw'}`;
    const stamp = `${details.mtimeMs}:${details.size}`;
    let encoded = encodedCache.get(key);
    if (!encoded || encoded.stamp !== stamp) {
      encoded = { stamp, ...(await encodeStatic(await readFile(file), type, acceptEncoding)) };
      // Cache small text responses, not a second copy of the entire image bank.
      if (type.startsWith('text/') || type.includes('json') || type.startsWith('image/svg')) {
        if (encodedCache.size >= 64) encodedCache.delete(encodedCache.keys().next().value!);
        encodedCache.set(key, encoded);
      }
    }
    if (response.destroyed) return true;
    const hashed = /[/\\]assets[/\\].+-[A-Za-z0-9_-]+\.(?:js|css)$/.test(file);
    response.writeHead(200, {
      'Content-Type': type,
      'Content-Length': encoded.body.length,
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Accept-Encoding',
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
      ...(encoded.encoding ? { 'Content-Encoding': encoded.encoding } : {}),
    });
    response.end(headOnly ? undefined : encoded.body);
    return true;
  } catch {
    return false;
  }
};
const server = createServer((request, response) => {
  void api(request, response)
    .then(async (handled) => {
      if (handled || response.writableEnded) return;
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        response.end(
          JSON.stringify({
            error: {
              code: 'METHOD_NOT_ALLOWED',
              message: 'Use GET or HEAD for this resource.',
              recoverable: false,
            },
          }),
        );
        return;
      }
      const pathname = new URL(request.url ?? '/', 'http://mealbook.local').pathname;
      const candidate =
        pathname === '/' ? join(staticRoot, 'index.html') : safeStaticPath(pathname);
      const encoding = request.headers['accept-encoding'];
      const sent = candidate
        ? await sendFile(response, candidate, request.method === 'HEAD', encoding)
        : false;
      if (sent) return;
      if (
        !extname(pathname) &&
        (await sendFile(
          response,
          join(staticRoot, 'index.html'),
          request.method === 'HEAD',
          encoding,
        ))
      )
        return;
      if (!response.writableEnded) {
        response.writeHead(404, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        response.end(
          JSON.stringify({
            error: { code: 'NOT_FOUND', message: 'Resource not found.', recoverable: false },
          }),
        );
      }
    })
    .catch(() => {
      if (!response.writableEnded) {
        response.writeHead(500, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        response.end(
          JSON.stringify({
            error: {
              code: 'SERVER_ERROR',
              message: 'The server could not complete the request.',
              recoverable: true,
            },
          }),
        );
      }
    });
});
const suppliedPort = Number(process.env.PORT ?? '3000');
const port =
  Number.isInteger(suppliedPort) && suppliedPort > 0 && suppliedPort < 65_536 ? suppliedPort : 3000;
server.listen(port, '0.0.0.0');
