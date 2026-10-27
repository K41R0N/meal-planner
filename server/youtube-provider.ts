import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { YouTubeReference } from '../packages/meal-domain/src/import-types.ts';

const REPOSITORY_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const LOCAL_VENV_BIN = join(REPOSITORY_ROOT, '.venv', 'bin');
const DESCRIPTION_LIMIT = 32_000;
const CAPTION_TEXT_LIMIT = 80_000;
const METADATA_STDOUT_LIMIT = 1024 * 1024;
const STDERR_LIMIT = 2 * 1024;
const PROCESS_DEADLINE_MS = 45_000;
const SOCKET_TIMEOUT_SECONDS = '12';
export const minimalProviderEnvironment = (): NodeJS.ProcessEnv => ({
  PATH: `/opt/recipe-tools/bin:${LOCAL_VENV_BIN}:/usr/local/bin:/usr/bin:/bin`,
  LANG: 'C.UTF-8',
  LC_ALL: 'C.UTF-8',
});

export type SourceFailureCategory = 'blocked' | 'not_found' | 'timeout' | 'failed';
export type CaptionStatus = 'available' | 'unavailable' | 'blocked' | 'timed_out' | 'failed';

export class SourceProviderError extends Error {
  constructor(public readonly category: SourceFailureCategory) {
    super(category);
    this.name = 'SourceProviderError';
  }
}

export interface YouTubeMetadata {
  videoId: string;
  canonicalUrl: string;
  title: string | null;
  description: string | null;
  descriptionTruncated: boolean;
  channel: string | null;
  uploader: string | null;
  viewCount: number | null;
  uploadDate: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  manualCaptionLanguages: string[];
  automaticCaptionLanguages: string[];
}

export interface CaptionResult {
  status: CaptionStatus;
  text: string | null;
  kind: 'manual' | 'automatic' | null;
}

export interface YouTubeSourceProvider {
  metadata(reference: YouTubeReference, signal: AbortSignal): Promise<YouTubeMetadata>;
  captions(metadata: YouTubeMetadata, signal: AbortSignal): Promise<CaptionResult>;
}

interface ProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
  outputExceeded: boolean;
  spawnFailed: boolean;
}

interface RawYtDlpInfo {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  view_count?: unknown;
  upload_date?: unknown;
  duration?: unknown;
  channel?: unknown;
  uploader?: unknown;
  thumbnails?: unknown;
  subtitles?: unknown;
  automatic_captions?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const boundedText = (value: string, limit: number): { text: string; truncated: boolean } => {
  const codepoints = Array.from(value);
  return codepoints.length > limit
    ? { text: codepoints.slice(0, limit).join(''), truncated: true }
    : { text: value, truncated: false };
};

const nullableText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const nullableNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

const captionLanguages = (value: unknown): string[] => {
  if (!isRecord(value)) return [];
  return Object.entries(value)
    .filter(([language, formats]) => language.length <= 32 && Array.isArray(formats) && formats.length > 0)
    .map(([language]) => language)
    .filter((language) => /^[a-z]{2,3}(?:-[a-z0-9]+)?$/i.test(language))
    .sort((left, right) => left.localeCompare(right));
};

const safeThumbnail = (value: unknown): string | null => {
  if (!Array.isArray(value)) return null;
  const candidates = value
    .filter(isRecord)
    .map((item) => ({ url: nullableText(item.url), preference: nullableNumber(item.preference) ?? -1 }))
    .filter((item): item is { url: string; preference: number } => item.url !== null)
    .filter((item) => {
      try {
        const parsed = new URL(item.url);
        return parsed.protocol === 'https:' && /(^|\.)ytimg\.com$/i.test(parsed.hostname);
      } catch {
        return false;
      }
    })
    .sort((left, right) => right.preference - left.preference || right.url.length - left.url.length);
  return candidates[0]?.url ?? null;
};

const classifyFailure = (result: ProcessResult): SourceFailureCategory => {
  if (result.timedOut) return 'timeout';
  const diagnostic = result.stderr.toLocaleLowerCase();
  if (/sign in to confirm|not a bot|captcha|bot check|login required/.test(diagnostic)) return 'blocked';
  if (/video unavailable|this video is unavailable|private video|video is private|has been removed|video not found/.test(diagnostic)) {
    return 'not_found';
  }
  return 'failed';
};

const captionStatusFor = (result: ProcessResult): CaptionStatus => {
  const category = classifyFailure(result);
  if (category === 'blocked') return 'blocked';
  if (category === 'timeout') return 'timed_out';
  return 'failed';
};

const runYtDlp = (
  args: string[],
  signal: AbortSignal,
  stdoutLimit: number,
  deadlineMs = PROCESS_DEADLINE_MS,
): Promise<ProcessResult> => new Promise((resolve) => {
  let settled = false;
  let timedOut = false;
  let aborted = false;
  let outputExceeded = false;
  let spawnFailed = false;
  let forceKillTimer: NodeJS.Timeout | undefined;
  let stdoutSize = 0;
  let stderrSize = 0;
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  const finish = (code: number | null): void => {
    if (settled) return;
    settled = true;
    clearTimeout(deadline);
    if (forceKillTimer) clearTimeout(forceKillTimer);
    signal.removeEventListener('abort', abortChild);
    resolve({
      code,
      stdout: Buffer.concat(stdoutChunks).toString('utf8'),
      stderr: Buffer.concat(stderrChunks).toString('utf8'),
      timedOut,
      aborted,
      outputExceeded,
      spawnFailed,
    });
  };

  const child = spawn('python3', args, {
    cwd: tmpdir(),
    env: minimalProviderEnvironment(),
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const terminate = (): void => {
    if (child.exitCode !== null || child.killed) return;
    child.kill('SIGTERM');
    forceKillTimer = setTimeout(() => child.kill('SIGKILL'), 1_000);
    forceKillTimer.unref();
  };

  const abortChild = (): void => {
    aborted = true;
    terminate();
  };
  const deadline = setTimeout(() => {
    timedOut = true;
    terminate();
  }, deadlineMs);
  deadline.unref();

  if (signal.aborted) abortChild();
  else signal.addEventListener('abort', abortChild, { once: true });

  child.stdout.on('data', (chunk: Buffer | string) => {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const remaining = stdoutLimit - stdoutSize;
    if (remaining > 0) stdoutChunks.push(data.subarray(0, remaining));
    stdoutSize += data.length;
    if (stdoutSize > stdoutLimit) {
      outputExceeded = true;
      terminate();
    }
  });
  child.stderr.on('data', (chunk: Buffer | string) => {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const remaining = STDERR_LIMIT - stderrSize;
    if (remaining > 0) stderrChunks.push(data.subarray(0, remaining));
    stderrSize += data.length;
  });
  child.on('error', () => {
    spawnFailed = true;
    finish(null);
  });
  child.on('close', (code: number | null) => finish(code));
});

const metadataArgs = (canonicalUrl: string): string[] => [
  '-m', 'yt_dlp',
  '--no-config-locations',
  '--ignore-config',
  '--skip-download',
  '--ignore-no-formats-error',
  '--no-playlist',
  '--no-warnings',
  '--socket-timeout', SOCKET_TIMEOUT_SECONDS,
  '--retries', '1',
  '--extractor-retries', '1',
  '--dump-single-json',
  '--', canonicalUrl,
];

const captionArgs = (
  canonicalUrl: string,
  language: string,
  mode: 'manual' | 'automatic',
  template: string,
): string[] => [
  '-m', 'yt_dlp',
  '--no-config-locations',
  '--ignore-config',
  '--skip-download',
  '--ignore-no-formats-error',
  '--no-playlist',
  '--no-warnings',
  '--socket-timeout', SOCKET_TIMEOUT_SECONDS,
  '--retries', '1',
  '--extractor-retries', '1',
  mode === 'manual' ? '--write-subs' : '--write-auto-subs',
  '--sub-langs', language,
  '--sub-format', 'vtt',
  '--output', template,
  '--', canonicalUrl,
];

/** Prefers English captions while retaining a deterministic available-language fallback. */
export const selectCaptionLanguage = (languages: readonly string[]): string | null => {
  const available = [...new Set(languages.filter((language) => language.trim()))]
    .sort((left, right) => {
      const normalizedLeft = left.toLowerCase();
      const normalizedRight = right.toLowerCase();
      return normalizedLeft < normalizedRight ? -1 : normalizedLeft > normalizedRight ? 1 : left < right ? -1 : left > right ? 1 : 0;
    });
  return available.find((language) => language.toLowerCase() === 'en')
    ?? available.find((language) => language.toLowerCase().startsWith('en-'))
    ?? available[0]
    ?? null;
};

const cleanVtt = (raw: string): string => {
  const lines: string[] = [];
  let skipBlock = false;
  for (const rawLine of raw.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (/^(STYLE|NOTE|REGION)(?:\s|$)/i.test(line)) {
      skipBlock = true;
      continue;
    }
    if (skipBlock) {
      if (!line) skipBlock = false;
      continue;
    }
    if (!line
      || /^WEBVTT(?:\s|$)/i.test(line)
      || /^(Kind|Language):/i.test(line)
      || /^\d+$/.test(line)
      || /-->/.test(line)) continue;
    const text = line.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text && lines.at(-1) !== text) lines.push(text);
  }
  return boundedText(lines.join('\n'), CAPTION_TEXT_LIMIT).text;
};

const sourceInfo = (raw: unknown, reference: YouTubeReference): YouTubeMetadata => {
  if (!isRecord(raw) || raw.id !== reference.videoId) throw new SourceProviderError('failed');
  const description = nullableText(raw.description);
  const boundedDescription = description === null
    ? { text: null, truncated: false }
    : boundedText(description, DESCRIPTION_LIMIT);
  return {
    videoId: reference.videoId,
    canonicalUrl: reference.url,
    title: nullableText(raw.title),
    description: boundedDescription.text,
    descriptionTruncated: boundedDescription.truncated,
    channel: nullableText(raw.channel),
    uploader: nullableText(raw.uploader),
    viewCount: nullableNumber(raw.view_count),
    uploadDate: nullableText(raw.upload_date),
    durationSeconds: nullableNumber(raw.duration),
    thumbnailUrl: safeThumbnail(raw.thumbnails),
    manualCaptionLanguages: captionLanguages(raw.subtitles),
    automaticCaptionLanguages: captionLanguages(raw.automatic_captions),
  };
};

const findCaptionFile = async (directory: string): Promise<string | null> => {
  const files = await readdir(directory);
  const candidate = files.find((file) => file.endsWith('.vtt'));
  return candidate ? join(directory, candidate) : null;
};

export class YtDlpYouTubeProvider implements YouTubeSourceProvider {
  async metadata(reference: YouTubeReference, signal: AbortSignal): Promise<YouTubeMetadata> {
    const result = await runYtDlp(metadataArgs(reference.url), signal, METADATA_STDOUT_LIMIT);
    if (result.aborted && !result.timedOut) throw new SourceProviderError('failed');
    if (result.code !== 0 || result.outputExceeded || result.spawnFailed) {
      throw new SourceProviderError(classifyFailure(result));
    }
    try {
      return sourceInfo(JSON.parse(result.stdout) as RawYtDlpInfo, reference);
    } catch (error) {
      if (error instanceof SourceProviderError) throw error;
      throw new SourceProviderError('failed');
    }
  }

  async captions(metadata: YouTubeMetadata, signal: AbortSignal): Promise<CaptionResult> {
    const manualLanguage = selectCaptionLanguage(metadata.manualCaptionLanguages);
    const automaticLanguage = selectCaptionLanguage(metadata.automaticCaptionLanguages);
    if (!manualLanguage && !automaticLanguage) {
      return { status: 'unavailable', text: null, kind: null };
    }

    const captionDeadline = AbortSignal.timeout(PROCESS_DEADLINE_MS);
    const captionSignal = AbortSignal.any([signal, captionDeadline]);
    const directory = await mkdtemp(join(tmpdir(), 'mealbook-ytdlp-'));
    try {
      let manualResult: CaptionResult | null = null;
      if (manualLanguage) {
        const manual = await this.downloadCaption(metadata, manualLanguage, 'manual', directory, captionSignal);
        if (manual.status === 'available' || manual.status === 'blocked' || manual.status === 'timed_out') return manual;
        manualResult = manual;
      }
      if (captionDeadline.aborted) return { status: 'timed_out', text: null, kind: null };
      if (automaticLanguage) {
        const automatic = await this.downloadCaption(metadata, automaticLanguage, 'automatic', directory, captionSignal);
        if (automatic.status === 'available' || automatic.status === 'blocked' || automatic.status === 'timed_out') return automatic;
        return automatic;
      }
      return manualResult ?? { status: 'unavailable', text: null, kind: null };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private async downloadCaption(
    metadata: YouTubeMetadata,
    language: string,
    kind: 'manual' | 'automatic',
    directory: string,
    signal: AbortSignal,
  ): Promise<CaptionResult> {
    const template = join(directory, 'caption.%(ext)s');
    const result = await runYtDlp(captionArgs(metadata.canonicalUrl, language, kind, template), signal, 64 * 1024);
    if (result.code !== 0 || result.outputExceeded || result.spawnFailed || result.aborted) {
      return { status: captionStatusFor(result), text: null, kind: null };
    }
    const file = await findCaptionFile(directory);
    if (!file) return { status: 'unavailable', text: null, kind: null };
    try {
      const details = await stat(file);
      if (details.size > 512 * 1024) return { status: 'failed', text: null, kind: null };
      const text = cleanVtt(await readFile(file, 'utf8'));
      return text ? { status: 'available', text, kind } : { status: 'unavailable', text: null, kind: null };
    } catch {
      return { status: 'failed', text: null, kind: null };
    }
  }
}

export const sourceTextLimits = {
  description: DESCRIPTION_LIMIT,
  captions: CAPTION_TEXT_LIMIT,
};
