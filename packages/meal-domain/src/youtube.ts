import type { YouTubeReference } from './import-types';

const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
const supportedHosts = new Set(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be','www.youtu.be']);

export function parseYouTubeReference(input: string): YouTubeReference {
  if (typeof input !== 'string' || input.length > 4096) throw new Error('Paste a valid YouTube video link.');
  const value = input.trim();
  if (videoIdPattern.test(value)) return {videoId:value,url:`https://www.youtube.com/watch?v=${value}`};
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new Error('Paste a complete YouTube video URL.'); }
  if (parsed.protocol !== 'https:' || !supportedHosts.has(parsed.hostname.toLowerCase()) || parsed.username || parsed.password || parsed.port || value.includes('\\')) {
    throw new Error('Only secure YouTube video links are supported.');
  }
  const parts = parsed.pathname.split('/').filter(Boolean);
  let id: string | null = null;
  if (parsed.hostname.endsWith('youtu.be') && parts.length === 1) id = parts[0];
  else if (parsed.pathname === '/watch') id = parsed.searchParams.get('v');
  else if (parts.length === 2 && ['shorts','live','embed'].includes(parts[0])) id = parts[1];
  if (!id || !videoIdPattern.test(id)) throw new Error('Choose one video, not a channel or playlist link.');
  return {videoId:id,url:`https://www.youtube.com/watch?v=${id}`};
}

export function extractYouTubeReference(text:string):YouTubeReference|null {
  for(const match of text.matchAll(/https:\/\/[^\s<>"']+/g)) {
    try {return parseYouTubeReference(match[0].replace(/[),.;]+$/,''));} catch { /* A shared text can contain unrelated links. */ }
  }
  try{return parseYouTubeReference(text);}catch{return null;}
}
