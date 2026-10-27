import type { IncomingMessage, ServerResponse } from 'node:http';

import { parseYouTubeReference } from '../packages/meal-domain/src/youtube.ts';
import type { ImportCapabilities, RecipeImportDraft } from '../packages/meal-domain/src/import-types.ts';
import {
  ManagedRecipeExtractor,
  RecipeExtractionError,
  normalizeRecipeDraft,
  type RecipeExtractor,
} from './recipe-extractor.ts';
import {
  SourceProviderError,
  YtDlpYouTubeProvider,
  type CaptionStatus,
  type YouTubeMetadata,
  type YouTubeSourceProvider,
} from './youtube-provider.ts';

const BODY_LIMIT_BYTES = 100 * 1024;
const MANUAL_SOURCE_LIMIT = 80_000;
const REQUEST_DEADLINE_MS = 95_000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 5;
const MAX_ACTIVE_IMPORTS = 2;

export interface AppDependencies {
  sourceProvider?: YouTubeSourceProvider;
  extractor?: RecipeExtractor;
  importEnabled?: () => boolean;
  now?: () => Date;
  maxConcurrentImports?: number;
  rateLimit?: { windowMs: number; maxRequests: number };
}

export type ApiRequestHandler = (request: IncomingMessage, response: ServerResponse) => Promise<boolean>;

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly message: string,
    public readonly recoverable = true,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class SourceInsufficientError extends ApiError {
  constructor(message = 'The available source text does not contain enough recipe detail to create a review draft.') {
    super(422, 'SOURCE_INSUFFICIENT', message, true, {
      pasteHint: 'Paste the written recipe, ingredients, or creator-provided instructions to continue.',
    });
  }
}

const json = (response: ServerResponse, status: number, payload: unknown): void => {
  if (response.writableEnded || response.destroyed) return;
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
};

const errorResponse = (response: ServerResponse, error: ApiError): void => {
  json(response, error.status, {
    error: {
      code: error.code,
      message: error.message,
      recoverable: error.recoverable,
    },
    ...error.extra,
  });
};

const codepointLength = (value: string): number => Array.from(value).length;

const readJsonBody = (request: IncomingMessage, signal:AbortSignal): Promise<unknown> => new Promise((resolve, reject) => {
  const length = request.headers['content-length'];
  if (length && (!/^\d+$/.test(length) || Number(length) > BODY_LIMIT_BYTES)) {
    reject(new ApiError(413, 'REQUEST_TOO_LARGE', 'The import request is too large.'));
    request.resume();
    return;
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  let settled=false;
  const cleanup=()=>{request.off('data',onData);request.off('error',onError);request.off('end',onEnd);signal.removeEventListener('abort',onAbort);};
  const rejectBody=(error:ApiError)=>{if(settled)return;settled=true;cleanup();chunks.length=0;request.once('error',()=>{});request.resume();reject(error);};
  const onAbort=()=>rejectBody(new ApiError(504,'IMPORT_TIMEOUT','Recipe preview took too long. Your link and source text can be retried.'));
  const onError=()=>rejectBody(new ApiError(400,'INVALID_REQUEST','The request body could not be read.'));
  const onData=(chunk: Buffer | string) => {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += data.length;
    if (bytes > BODY_LIMIT_BYTES) {
      rejectBody(new ApiError(413,'REQUEST_TOO_LARGE','The import request is too large.'));
      return;
    }
    chunks.push(data);
  };
  const onEnd=() => {
    if(settled)return;
    settled=true;cleanup();
    try {
      const raw = Buffer.concat(chunks).toString('utf8');
      resolve(JSON.parse(raw));
    } catch {
      reject(new ApiError(400, 'INVALID_JSON', 'Send a JSON object containing a YouTube URL.'));
    }
  };
  request.on('data',onData);request.once('error',onError);request.once('end',onEnd);
  signal.addEventListener('abort',onAbort,{once:true});if(signal.aborted)onAbort();
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requestPayload = (value: unknown): { url: string; sourceText: string | null } => {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== 'url' && key !== 'sourceText')) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Send only a YouTube URL and optional source text.');
  }
  if (typeof value.url !== 'string' || !value.url.trim()) {
    throw new ApiError(400, 'INVALID_YOUTUBE_URL', 'Paste a YouTube video URL.');
  }
  if (value.sourceText !== undefined && typeof value.sourceText !== 'string') {
    throw new ApiError(400, 'INVALID_SOURCE_TEXT', 'Source text must be plain text.');
  }
  const sourceText = typeof value.sourceText === 'string' ? value.sourceText.trim() : null;
  if (sourceText && codepointLength(sourceText) > MANUAL_SOURCE_LIMIT) {
    throw new ApiError(413, 'SOURCE_TEXT_TOO_LARGE', 'Paste no more than 80,000 characters of source text.');
  }
  return { url: value.url.trim(), sourceText: sourceText || null };
};

const sourceLooksLikeRecipe = (value: string | null): value is string => {
  if (!value || codepointLength(value) < 80) return false;
  return /\b(ingredients?|method|instructions?|directions?|recipe)\b/i.test(value)
    && value.split(/\r?\n/).filter((line) => line.trim()).length >= 2;
};

const manualMetadata = (videoId: string, canonicalUrl: string): YouTubeMetadata => ({
  videoId,
  canonicalUrl,
  title: null,
  description: null,
  descriptionTruncated: false,
  channel: null,
  uploader: null,
  viewCount: null,
  uploadDate: null,
  durationSeconds: null,
  thumbnailUrl: null,
  manualCaptionLanguages: [],
  automaticCaptionLanguages: [],
});

const browserRequestIsCrossSite = (request: IncomingMessage): boolean => {
  const fetchSite = request.headers['sec-fetch-site'];
  // Fetch Metadata is set by the browser, not writable by page scripts. Preview
  // forwards a public HTTPS origin to an internal Host, so those hosts may differ.
  if (fetchSite === 'same-origin') return false;
  if (typeof fetchSite === 'string' && fetchSite !== 'same-origin') return true;
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin) return false;
  if (typeof origin !== 'string' || !host) return true;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
};

const sourceFailure = (error: SourceProviderError): ApiError => {
  switch (error.category) {
    case 'not_found':
      return new ApiError(404, 'VIDEO_NOT_FOUND', 'That YouTube video is unavailable, private, or has been removed.');
    case 'blocked':
      return new ApiError(503, 'SOURCE_ACCESS_BLOCKED', 'YouTube blocked anonymous source access. Paste the written recipe text to continue.', true, {
        pasteHint: 'Paste the creator-provided description, ingredients, or instructions; no account or browser cookies are used.',
      });
    case 'timeout':
      return new ApiError(504, 'SOURCE_TIMEOUT', 'YouTube source retrieval took too long. Try again or paste the written recipe text.');
    default:
      return new ApiError(502, 'SOURCE_UNAVAILABLE', 'The YouTube source could not be retrieved. Try again or paste the written recipe text.');
  }
};

const captionFailure = (status: Exclude<CaptionStatus, 'available'>): ApiError => {
  switch (status) {
    case 'blocked':
      return new ApiError(503, 'SOURCE_ACCESS_BLOCKED', 'YouTube blocked anonymous caption access. Paste the written recipe text to continue.', true, {
        pasteHint: 'Paste the creator-provided description, ingredients, or instructions; no account or browser cookies are used.',
      });
    case 'timed_out':
      return new ApiError(504, 'SOURCE_TIMEOUT', 'Caption retrieval took too long. Try again or paste the written recipe text.');
    case 'failed':
      return new ApiError(502, 'CAPTION_UNAVAILABLE', 'Captions could not be retrieved for this video. Paste the written recipe text to continue.');
    case 'unavailable':
      return new SourceInsufficientError('No useful written description or available caption text was found for this video.');
  }
};

const modelFailure = (error: RecipeExtractionError): ApiError => {
  if (error.category === 'unavailable') {
    return new ApiError(503, 'EXTRACTION_UNAVAILABLE', 'Recipe extraction is temporarily unavailable. Keep the source text and try again.');
  }
  if (error.category === 'invalid') {
    return new SourceInsufficientError('The source did not yield a valid recipe draft. Review or paste more complete source text.');
  }
  return new ApiError(502, 'EXTRACTION_FAILED', 'Recipe extraction could not complete. Try again with the source text.');
};

const addressKey = (request: IncomingMessage): string => request.socket.remoteAddress ?? 'unknown';

/**
 * Creates only API routes. Static files are deliberately served by server/index.ts
 * after this handler declines a non-/api request.
 */
export const createApp = (dependencies: AppDependencies = {}): ApiRequestHandler => {
  const sourceProvider = dependencies.sourceProvider ?? new YtDlpYouTubeProvider();
  const extractor = dependencies.extractor ?? new ManagedRecipeExtractor();
  const importEnabled = dependencies.importEnabled ?? (() => process.env.IMPORT_API_ENABLED === 'true');
  const now = dependencies.now ?? (() => new Date());
  const maxConcurrentImports = dependencies.maxConcurrentImports ?? MAX_ACTIVE_IMPORTS;
  const rateLimit = dependencies.rateLimit ?? { windowMs: RATE_WINDOW_MS, maxRequests: RATE_MAX_REQUESTS };
  const attempts = new Map<string, number[]>();
  let activeImports = 0;

  const acceptsAttempt = (request: IncomingMessage): boolean => {
    const key = addressKey(request);
    const timestamp = now().getTime();
    const prior = (attempts.get(key) ?? []).filter((item) => timestamp - item < rateLimit.windowMs);
    if (prior.length >= rateLimit.maxRequests) {
      attempts.set(key, prior);
      return false;
    }
    prior.push(timestamp);
    attempts.set(key, prior);
    return true;
  };

  const preview = async (request: IncomingMessage, response: ServerResponse, signal: AbortSignal): Promise<RecipeImportDraft> => {
    if (!importEnabled()) {
      throw new ApiError(503, 'IMPORT_DISABLED', 'Online import is disabled until this deployment enables approved access. You can still add a recipe manually.');
    }
    if (browserRequestIsCrossSite(request)) {
      throw new ApiError(403, 'CROSS_SITE_REQUEST_REJECTED', 'This import request must come from the Mealbook app.');
    }
    if (!acceptsAttempt(request)) {
      throw new ApiError(429, 'IMPORT_RATE_LIMITED', 'Please wait before starting another import.');
    }
    if (activeImports >= maxConcurrentImports) {
      throw new ApiError(429, 'IMPORT_BUSY', 'An import is already running. Try again shortly.');
    }
    activeImports += 1;
    try {
      const payload = requestPayload(await readJsonBody(request,signal));
      let reference;
      try {
        reference = parseYouTubeReference(payload.url);
      } catch {
        throw new ApiError(422, 'INVALID_YOUTUBE_URL', 'Paste one secure YouTube video URL, not a channel or playlist link.');
      }

      let metadata: YouTubeMetadata;
      let sourceText: string;
      let method: 'description' | 'captions' | 'manual';
      let captions: string | null = null;
      if (payload.sourceText) {
        metadata = manualMetadata(reference.videoId, reference.url);
        sourceText = payload.sourceText;
        method = 'manual';
      } else {
        try {
          metadata = await sourceProvider.metadata(reference, signal);
        } catch (error) {
          if (error instanceof SourceProviderError) throw sourceFailure(error);
          throw new ApiError(502, 'SOURCE_UNAVAILABLE', 'The YouTube source could not be retrieved. Try again or paste the written recipe text.');
        }
        if (sourceLooksLikeRecipe(metadata.description)) {
          sourceText = metadata.description;
          method = 'description';
        } else {
          const captionsResult = await sourceProvider.captions(metadata, signal);
          if (captionsResult.status !== 'available' || !captionsResult.text || !captionsResult.kind) {
            if(captionsResult.status==='available')throw new SourceInsufficientError('The available captions were empty. Paste the written recipe text to continue.');
            throw captionFailure(captionsResult.status);
          }
          sourceText = captionsResult.text;
          captions = captionsResult.text;
          method = 'captions';
        }
      }

      let extracted;
      try {
        extracted = await extractor.extract({
          sourceText,
          sourceKind: method,
          title: metadata.title,
          creator: metadata.channel ?? metadata.uploader,
          videoUrl: metadata.canonicalUrl,
        }, signal);
      } catch (error) {
        if (error instanceof RecipeExtractionError) throw modelFailure(error);
        throw new ApiError(502, 'EXTRACTION_FAILED', 'Recipe extraction could not complete. Try again with the source text.');
      }
      const draft = normalizeRecipeDraft({
        extracted,
        metadata,
        sourceText,
        method,
        captions,
        acquiredAt: now().toISOString(),
      });
      if (metadata.descriptionTruncated) {
        const warning = 'The YouTube description was shortened to the safe import limit; review the draft against the original source.';
        draft.warnings = [...new Set([...draft.warnings, warning])];
        draft.recipe.dataGaps = [...new Set([...draft.recipe.dataGaps, warning])];
      }
      return draft;
    } finally {
      activeImports -= 1;
    }
  };

  return async (request, response): Promise<boolean> => {
    const pathname = new URL(request.url ?? '/', 'http://mealbook.local').pathname;
    if (!pathname.startsWith('/api/')) return false;
    if (request.method === 'GET' && pathname === '/api/health') {
      json(response, 200, { ok: true });
      return true;
    }
    if (request.method === 'GET' && pathname === '/api/import/capabilities') {
      const capabilities: ImportCapabilities = {
        available: importEnabled(),
        captions: true,
        reviewRequired: true,
        estimatesNutrition: false,
      };
      json(response, 200, capabilities);
      return true;
    }
    if (request.method !== 'POST' || pathname !== '/api/recipes/preview') {
      errorResponse(response, new ApiError(404, 'NOT_FOUND', 'This API route does not exist.', false));
      return true;
    }

    const responseController = new AbortController();
    const deadline = AbortSignal.timeout(REQUEST_DEADLINE_MS);
    const signal = AbortSignal.any([responseController.signal, deadline]);
    let finished = false;
    const onResponseClose = (): void => {
      if (!finished) responseController.abort();
    };
    response.once('close', onResponseClose);
    try {
      json(response, 200, await preview(request, response, signal));
    } catch (error) {
      if (!responseController.signal.aborted && !response.destroyed) {
        if(deadline.aborted)errorResponse(response,new ApiError(504,'IMPORT_TIMEOUT','Recipe preview took too long. Your link and source text can be retried.'));
        else if (error instanceof ApiError) errorResponse(response, error);
        else if (error instanceof RecipeExtractionError) errorResponse(response, modelFailure(error));
        else errorResponse(response, new ApiError(502, 'IMPORT_FAILED', 'The import could not complete. Try again or paste source text.'));
      }
    } finally {
      finished = true;
      response.off('close', onResponseClose);
    }
    return true;
  };
};
