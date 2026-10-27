import type { ImportCapabilities, RecipeImportDraft, RecipeImportError } from '@domain/import-types';

export class RecipeImportRequestError extends Error {
  readonly code: string;
  readonly recoverable: boolean;

  constructor(code: string, message: string, recoverable = true) {
    super(message);
    this.name = 'RecipeImportRequestError';
    this.code = code;
    this.recoverable = recoverable;
  }
}

function isErrorEnvelope(value: unknown): value is RecipeImportError {
  if (!value || typeof value !== 'object' || !('error' in value)) return false;
  const error = (value as { error?: unknown }).error;
  return Boolean(error && typeof error === 'object'
    && typeof (error as { code?: unknown }).code === 'string'
    && typeof (error as { message?: unknown }).message === 'string'
    && typeof (error as { recoverable?: unknown }).recoverable === 'boolean');
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function requestError(response: Response, body: unknown): RecipeImportRequestError {
  if (isErrorEnvelope(body)) return new RecipeImportRequestError(body.error.code, body.error.message, body.error.recoverable);
  if (response.status === 503) return new RecipeImportRequestError('IMPORT_UNAVAILABLE', 'YouTube import is not available right now. Your link and notes are still here to retry.', true);
  if (response.status >= 500) return new RecipeImportRequestError('IMPORT_FAILED', 'The import service could not finish this preview. Retry, or paste more source text.', true);
  return new RecipeImportRequestError('IMPORT_REJECTED', 'This link could not be imported. Check the YouTube URL or paste the written recipe text.', response.status !== 400);
}

export async function getImportCapabilities(signal?: AbortSignal): Promise<ImportCapabilities> {
  let response: Response;
  try {
    response = await fetch('/api/import/capabilities', { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new RecipeImportRequestError('CAPABILITIES_UNAVAILABLE', 'Import availability could not be checked. You can retry when you are online.', true);
  }
  const body = await readJson(response);
  if (!response.ok) throw requestError(response, body);
  if (!body || typeof body !== 'object'
    || typeof (body as { available?: unknown }).available !== 'boolean'
    || typeof (body as { captions?: unknown }).captions !== 'boolean'
    || (body as { reviewRequired?: unknown }).reviewRequired !== true
    || (body as { estimatesNutrition?: unknown }).estimatesNutrition !== false) {
    throw new RecipeImportRequestError('CAPABILITIES_INVALID', 'The import service returned an unexpected availability response.', true);
  }
  return body as ImportCapabilities;
}

export async function previewRecipeImport(
  input: { url: string; sourceText?: string },
  signal: AbortSignal,
): Promise<RecipeImportDraft> {
  let response: Response;
  try {
    response = await fetch('/api/recipes/preview', {
      method: 'POST',
      signal,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new RecipeImportRequestError('NETWORK_UNAVAILABLE', 'The preview needs an internet connection. Saved recipes, plans, and shopping still work offline.', true);
  }
  const body = await readJson(response);
  if (!response.ok) throw requestError(response, body);
  if (!body || typeof body !== 'object' || !('recipe' in body) || !('source' in body) || !('warnings' in body)) {
    throw new RecipeImportRequestError('PREVIEW_INVALID', 'The import service returned an incomplete recipe preview. Retry or paste the written recipe text.', true);
  }
  return body as RecipeImportDraft;
}
