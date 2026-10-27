import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

// ITF FFL permits a licensee's own app self-hosting; raw font redistribution
// through public source is excluded. Keep output ignored and fetch from ITF.
const directory = path.resolve('apps/web/public/fonts');
await mkdir(directory, { recursive: true });
for (const weight of [400, 500, 600, 700]) {
  const target = path.join(directory, `general-sans-${weight}-normal.woff2`);
  if (existsSync(target)) continue;
  try {
    const cssResponse = await fetch(`https://api.fontshare.com/v2/css?f[]=general-sans@${weight}&display=swap`, { signal: AbortSignal.timeout(12000) });
    if (!cssResponse.ok) throw new Error(`Font stylesheet HTTP ${cssResponse.status}`);
    const css = await cssResponse.text();
    const urls = [...css.matchAll(/url\(['"]?(https:\/\/[^)'"\s]+\.woff2(?:\?[^)'"\s]*)?)['"]?\)/g)].map(match => match[1]);
    if (!urls.length) throw new Error('No official WOFF2 file in stylesheet');
    const fontUrl = new URL(urls[0]);
    if (fontUrl.hostname !== 'cdn.fontshare.com' && fontUrl.hostname !== 'api.fontshare.com') throw new Error('Unexpected font asset host');
    const response = await fetch(fontUrl, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`Font asset HTTP ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > 1024 * 1024 || data.subarray(0, 4).toString('ascii') !== 'wOF2') throw new Error('Invalid font file');
    await writeFile(target, data);
    console.log(`Prepared General Sans ${weight}`);
  } catch (error) {
    // Typography remains usable with the explicit system fallback. Font
    // delivery is not allowed to make the private offline meal app unusable.
    console.warn(`General Sans ${weight} unavailable; using system fallback: ${error.message}`);
  }
}
