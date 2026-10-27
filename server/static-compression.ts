import { gzip } from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(gzip);
export const acceptsGzip = (header: string | undefined): boolean =>
  Boolean(
    header?.split(',').some((part) => {
      const [encoding, ...parameters] = part.trim().toLowerCase().split(';');
      if (encoding !== 'gzip' && encoding !== '*') return false;
      const quality = parameters.find((parameter) => parameter.trim().startsWith('q='));
      return quality === undefined || Number(quality.trim().slice(2)) > 0;
    }),
  );

export async function encodeStatic(
  body: Buffer,
  contentType: string,
  acceptEncoding: string | undefined,
): Promise<{ body: Buffer; encoding?: 'gzip' }> {
  const text =
    contentType.startsWith('text/') ||
    contentType.includes('json') ||
    contentType.startsWith('image/svg');
  if (!text || body.length < 1024 || !acceptsGzip(acceptEncoding)) return { body };
  return { body: await gzipAsync(body, { level: 6 }), encoding: 'gzip' };
}
