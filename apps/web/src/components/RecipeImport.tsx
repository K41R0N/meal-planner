import {
  AlertCircle,
  ArrowLeft,
  ClipboardPaste,
  ExternalLink,
  FileText,
  LoaderCircle,
  Minus,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { validateRecipes } from '@domain/index';
import type { ImportCapabilities, RecipeImportDraft } from '@domain/import-types';
import { parseYouTubeReference } from '@domain/youtube';
import {
  emptyNutrition,
  mealTypes,
  type IngredientLine,
  type MealType,
  type Recipe,
} from '@domain/types';
import {
  getImportCapabilities,
  previewRecipeImport,
  RecipeImportRequestError,
} from '../import-client';
import { allMacros, commaList, humanRole, macroLabels, macroValue, makeId } from './shared';

interface RecipeImportProps {
  initialUrl?: string | null;
  onBack: () => void;
  onOpenExisting: (videoId: string) => boolean;
  onSaveRecipe: (recipe: Recipe) => boolean;
  onOpenSaved: (recipe: Recipe, intent?: 'cook' | 'week') => void;
}

type ImportStatus = 'ready' | 'extracting' | 'review';

type SavedImportProgress = {
  url: string;
  sourceText: string;
  draft: RecipeImportDraft | null;
  editorText?: { tags: string; categories: string; steps: string };
};

const SESSION_KEY = 'meal-planner-youtube-import-v1';

function restoreProgress(): SavedImportProgress {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { url: '', sourceText: '', draft: null };
    const parsed = JSON.parse(raw) as Partial<SavedImportProgress>;
    return {
      url: typeof parsed.url === 'string' ? parsed.url : '',
      sourceText: typeof parsed.sourceText === 'string' ? parsed.sourceText : '',
      draft: restoreDraft(parsed.draft),
      ...(parsed.editorText &&
      typeof parsed.editorText.tags === 'string' &&
      typeof parsed.editorText.categories === 'string' &&
      typeof parsed.editorText.steps === 'string'
        ? { editorText: parsed.editorText }
        : {}),
    };
  } catch {
    return { url: '', sourceText: '', draft: null };
  }
}

export function restoreDraft(value: unknown): RecipeImportDraft | null {
  try {
    if (!value || typeof value !== 'object') return null;
    const draft = value as RecipeImportDraft;
    if (
      !draft.source ||
      draft.source.provider !== 'youtube' ||
      !['description', 'captions', 'manual'].includes(draft.source.method)
    )
      return null;
    const reference = parseYouTubeReference(draft.source.url);
    if (
      reference.videoId !== draft.source.videoId ||
      typeof draft.source.description !== 'string' ||
      draft.source.description.length > 32000
    )
      return null;
    if (
      typeof draft.source.creator !== 'string' ||
      typeof draft.source.title !== 'string' ||
      typeof draft.source.acquiredAt !== 'string'
    )
      return null;
    if (
      draft.source.captions !== null &&
      (typeof draft.source.captions !== 'string' || draft.source.captions.length > 80000)
    )
      return null;
    if (
      !Array.isArray(draft.warnings) ||
      !draft.warnings.every((warning) => typeof warning === 'string')
    )
      return null;
    const recipe = validateRecipes([
      {
        ...draft.recipe,
        sourceEvidence: {
          method: draft.source.method,
          description: draft.source.description,
          captions: draft.source.captions,
          acquiredAt: draft.source.acquiredAt,
        },
      },
    ])[0];
    if (recipe.id !== `youtube:${reference.videoId}`) return null;
    return { ...draft, recipe };
  } catch {
    return null;
  }
}

export function parseStoredImportDraft(value: unknown): RecipeImportDraft | null {
  return restoreDraft(value);
}

function saveProgress(progress: SavedImportProgress): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(progress));
  } catch {
    // Draft persistence is a convenience; the active page remains usable if storage is blocked.
  }
}

function removeProgress(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* no device storage available */
  }
}

function hasReportedNutrition(recipe: Recipe): boolean {
  return allMacros.some((key) => recipe.reportedNutrition[key] !== null);
}

function confirmedNutrition(
  recipe: Recipe,
  basis: Recipe['nutritionBasis'],
  baseServings = recipe.baseServings,
): Recipe {
  const nutrition = emptyNutrition();
  if (basis === 'per_serving') Object.assign(nutrition, recipe.reportedNutrition);
  if (basis === 'per_recipe' && baseServings && baseServings > 0) {
    for (const key of allMacros) {
      const value = recipe.reportedNutrition[key];
      nutrition[key] = value === null ? null : value / baseServings;
    }
  }
  return { ...recipe, baseServings, nutritionBasis: basis, nutrition };
}

function prepareDraft(draft: RecipeImportDraft): RecipeImportDraft {
  const reported = hasReportedNutrition(draft.recipe);
  const sourceName = draft.recipe.sourceName.trim() || 'YouTube import';
  const recipe = {
    ...draft.recipe,
    id: `youtube:${draft.source.videoId}`,
    sourceUrl: draft.source.url,
    sourceName,
    creatorCredit: draft.source.creator.trim() || draft.recipe.creatorCredit,
    nutritionBasis: reported ? ('unspecified' as const) : ('not_stated' as const),
    nutrition: emptyNutrition(),
    dataGaps: Array.from(new Set([...draft.recipe.dataGaps, ...draft.warnings])),
    addedAt: new Date().toISOString(),
  };
  return { ...draft, recipe };
}

function sourceMethodLabel(method: RecipeImportDraft['source']['method']): string {
  if (method === 'captions') return 'captions after the description was insufficient';
  if (method === 'manual') return 'the text you pasted';
  return 'the video description';
}

function errorMessage(error: unknown): string {
  if (error instanceof RecipeImportRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return 'The recipe preview could not be prepared. Your link and pasted text are still here.';
}

export function RecipeImport({
  initialUrl,
  onBack,
  onOpenExisting,
  onSaveRecipe,
  onOpenSaved,
}: RecipeImportProps) {
  const initial = useRef(restoreProgress());
  const abortRef = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const appliedInitialUrl = useRef(false);
  const [url, setUrl] = useState(initial.current.url);
  const [sourceText, setSourceText] = useState(initial.current.sourceText);
  const [draft, setDraft] = useState<RecipeImportDraft | null>(initial.current.draft);
  const [status, setStatus] = useState<ImportStatus>(initial.current.draft ? 'review' : 'ready');
  const [capabilities, setCapabilities] = useState<ImportCapabilities | null>(null);
  const [tagsText, setTagsText] = useState(
    initial.current.editorText?.tags ?? initial.current.draft?.recipe.tags.join(', ') ?? '',
  );
  const [categoriesText, setCategoriesText] = useState(
    initial.current.editorText?.categories ??
      initial.current.draft?.recipe.categories.join(', ') ??
      '',
  );
  const [stepsText, setStepsText] = useState(
    initial.current.editorText?.steps ?? initial.current.draft?.recipe.steps.join('\n') ?? '',
  );
  const [availabilityError, setAvailabilityError] = useState('');
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savedRecipe, setSavedRecipe] = useState<Recipe | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    restoreFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timeout = window.setTimeout(() => headingRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timeout);
      abortRef.current?.abort();
      if (restoreFocus.current?.isConnected) restoreFocus.current.focus();
    };
  }, []);

  useEffect(() => {
    if (!initialUrl || appliedInitialUrl.current) return;
    appliedInitialUrl.current = true;
    let nextVideoId: string;
    try {
      nextVideoId = parseYouTubeReference(initialUrl).videoId;
    } catch {
      setError('The shared text did not contain a supported YouTube video link.');
      return;
    }
    if (initial.current.draft && initial.current.draft.source.videoId !== nextVideoId) {
      if (
        !window.confirm(
          'You have an unfinished recipe review. Discard that draft and open the newly shared video?',
        )
      ) {
        setError(
          'Your previous review was kept. Finish or save it before opening another shared video.',
        );
        return;
      }
      setDraft(null);
      setStatus('ready');
      setSourceText('');
    } else if (initial.current.url !== initialUrl && !initial.current.draft) setSourceText('');
    setUrl(initialUrl);
    setError('');
  }, [initialUrl]);

  useEffect(() => {
    saveProgress({
      url,
      sourceText,
      draft,
      editorText: { tags: tagsText, categories: categoriesText, steps: stepsText },
    });
  }, [url, sourceText, draft, tagsText, categoriesText, stepsText]);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getImportCapabilities(controller.signal)
      .then((value) => {
        setCapabilities(value);
        setAvailabilityError('');
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setAvailabilityError(errorMessage(reason));
      });
    return () => controller.abort();
  }, []);

  const patchRecipe = (changes: Partial<Recipe>) => {
    setDraft((current) =>
      current ? { ...current, recipe: { ...current.recipe, ...changes } } : current,
    );
    setSaveError('');
  };

  const patchIngredient = (id: string, changes: Partial<IngredientLine>) => {
    if (!draft) return;
    patchRecipe({
      ingredients: draft.recipe.ingredients.map((item) =>
        item.id === id ? { ...item, ...changes } : item,
      ),
    });
  };

  const toggleRole = (role: MealType) => {
    if (!draft) return;
    const roles = draft.recipe.roles.includes(role)
      ? draft.recipe.roles.filter((item) => item !== role)
      : [...draft.recipe.roles, role];
    patchRecipe({ roles });
  };

  const openKnownRecipe = (videoId: string): boolean => onOpenExisting(videoId);

  const preview = async () => {
    if (status === 'extracting') return;
    setError('');
    setSaveError('');
    let reference: ReturnType<typeof parseYouTubeReference>;
    try {
      reference = parseYouTubeReference(url.trim());
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Paste a standard youtube.com or youtu.be video link.',
      );
      return;
    }
    if (openKnownRecipe(reference.videoId)) return;
    if (!navigator.onLine) {
      setError(
        'You’re offline. Your saved recipe book still works; reconnect before asking the online extractor to review this link or pasted source text.',
      );
      return;
    }
    if (capabilities?.available === false) {
      setError(
        'YouTube import is temporarily unavailable. Keep this link here and try again later.',
      );
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('extracting');
    try {
      const response = await previewRecipeImport(
        { url: reference.url, ...(sourceText.trim() ? { sourceText: sourceText.trim() } : {}) },
        controller.signal,
      );
      const next = prepareDraft(response);
      if (openKnownRecipe(next.source.videoId)) return;
      setUrl(next.source.url);
      setDraft(next);
      setTagsText(next.recipe.tags.join(', '));
      setCategoriesText(next.recipe.categories.join(', '));
      setStepsText(next.recipe.steps.join('\n'));
      setStatus('review');
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') {
        setError('Preview cancelled. Your link and source text are still here.');
      } else {
        setError(errorMessage(reason));
      }
      setStatus('ready');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const cancelPreview = () => {
    abortRef.current?.abort();
  };

  const saveRecipe = () => {
    if (!draft) return;
    setSaveError('');
    try {
      const candidate = {
        ...draft.recipe,
        tags: commaList(tagsText),
        categories: commaList(categoriesText),
        steps: stepsText
          .split('\n')
          .map((step) => step.trim())
          .filter(Boolean),
        id: `youtube:${draft.source.videoId}`,
        sourceUrl: draft.source.url,
        creatorCredit: draft.source.creator.trim() || draft.recipe.creatorCredit,
        sourceEvidence: {
          method: draft.source.method,
          description: draft.source.description,
          captions: draft.source.captions,
          acquiredAt: draft.source.acquiredAt,
        },
        addedAt: new Date().toISOString(),
        dataGaps: Array.from(new Set([...draft.recipe.dataGaps, ...draft.warnings])),
      };
      const recipe = validateRecipes([candidate])[0];
      if (!onSaveRecipe(recipe)) {
        setSaveError(
          'This video was saved in another action before this review finished. Opening the saved recipe instead.',
        );
        onOpenExisting(draft.source.videoId);
        return;
      }
      removeProgress();
      setSavedRecipe(recipe);
    } catch (reason) {
      setSaveError(
        reason instanceof Error ? reason.message : 'Check the recipe details before saving.',
      );
    }
  };

  const reported = draft ? hasReportedNutrition(draft.recipe) : false;
  const canPreview = status !== 'extracting' && online && capabilities?.available !== false;

  if (savedRecipe)
    return (
      <section className="page recipe-import-page" aria-labelledby="saved-recipe-heading">
        <header className="page-heading import-page__heading">
          <div>
            <h1 id="saved-recipe-heading" tabIndex={-1} ref={headingRef}>
              Saved to your recipe book
            </h1>
            <p>
              {savedRecipe.name} is ready to use. Choose the next job instead of searching for it
              again.
            </p>
          </div>
          <button type="button" className="button button--quiet" onClick={onBack}>
            <ArrowLeft size={18} /> Recipe book
          </button>
        </header>
        <section className="import-card import-next-actions">
          <h2>What do you want to do next?</h2>
          <p>
            Saving kept the recipe in your personal book. Cooking, weekly planning, and shopping
            remain deliberate next steps.
          </p>
          <div className="import-actions">
            <button
              type="button"
              className="button"
              onClick={() => onOpenSaved(savedRecipe, 'cook')}
            >
              <Save size={18} /> Cook today
            </button>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => onOpenSaved(savedRecipe, 'week')}
            >
              Add to my week
            </button>
            <button type="button" className="button button--quiet" onClick={onBack}>
              Keep in my book
            </button>
          </div>
        </section>
      </section>
    );

  return (
    <section className="page recipe-import-page" aria-labelledby="import-heading">
      <header className="page-heading import-page__heading">
        <div>
          <h1 id="import-heading" tabIndex={-1} ref={headingRef}>
            Import from YouTube
          </h1>
          <p>
            Paste a recipe video link, review the written evidence, then choose what belongs in your
            private book. Nothing is saved until you confirm it.
          </p>
        </div>
        <button type="button" className="button button--quiet" onClick={onBack}>
          <ArrowLeft size={18} /> Recipe book
        </button>
      </header>

      {!online && (
        <p className="import-callout import-callout--warning" role="status">
          <AlertCircle size={18} />
          <span>
            Offline: saved recipes, plans, and shopping remain available. Extracting a link or
            pasted source text requires an internet connection.
          </span>
        </p>
      )}
      {availabilityError && (
        <p className="import-callout import-callout--warning" role="status">
          <AlertCircle size={18} />
          <span>{availabilityError}</span>
        </p>
      )}
      {capabilities && !capabilities.available && (
        <p className="import-callout import-callout--warning" role="status">
          <AlertCircle size={18} />
          <span>
            Import is currently unavailable. Your draft remains on this device for a later retry.
          </span>
        </p>
      )}

      {status !== 'review' && (
        <section className="import-card" aria-labelledby="import-source-heading">
          <div className="import-card__title">
            <span className="import-step">1</span>
            <div>
              <h2 id="import-source-heading">Add the video and any written recipe text</h2>
              <p>
                Meal Planner checks the video description first. If it is not enough, the service
                may use available captions. It never downloads the video.
              </p>
            </div>
          </div>
          <div className="import-source-form">
            <label className="field field--wide">
              <span>YouTube video link</span>
              <input
                type="url"
                inputMode="url"
                autoComplete="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                aria-describedby="youtube-link-help"
                disabled={status === 'extracting'}
              />
              <small id="youtube-link-help" className="field-hint">
                Standard youtube.com and youtu.be links are supported.
              </small>
            </label>
            <label className="field field--wide">
              <span>
                Paste a description or captions if the video text is sparse <em>optional</em>
              </span>
              <textarea
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="Paste the written recipe, description, or captions here. This is sent only when you choose Preview."
                disabled={status === 'extracting'}
              />
              <small className="field-hint">
                This fallback still needs the online extractor. Your pasted text stays in this
                browser while you review it.
              </small>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="import-actions">
              <button type="button" className="button" onClick={preview} disabled={!canPreview}>
                <ClipboardPaste size={18} />{' '}
                {status === 'extracting' ? 'Preparing preview…' : 'Preview recipe'}
              </button>
              {status === 'extracting' && (
                <button type="button" className="button button--quiet" onClick={cancelPreview}>
                  Cancel preview
                </button>
              )}
            </div>
          </div>
          {status === 'extracting' && (
            <div className="import-progress" aria-live="polite">
              <LoaderCircle size={20} aria-hidden="true" />
              <div>
                <strong>Preparing a review draft</strong>
                <span>
                  Reading written source evidence and identifying fields that need your check.
                </span>
              </div>
            </div>
          )}
          <p className="import-privacy-note">
            <FileText size={16} aria-hidden="true" /> This request creates a review draft only. It
            does not change your saved recipes, plans, shopping, or food log.
          </p>
        </section>
      )}

      {status === 'review' && draft && (
        <section className="import-review" aria-labelledby="review-heading">
          <header className="import-review__header">
            <div>
              <h2 id="review-heading">Check the recipe against its source</h2>
              <p>
                Correct uncertain wording, quantities, meal roles, and organization. Empty amounts
                and nutrition stay unknown.
              </p>
            </div>
            <div className="import-review__actions">
              <button
                type="button"
                className="button button--quiet"
                onClick={() => setStatus('ready')}
              >
                <RotateCcw size={17} /> Try another source
              </button>
              <button type="button" className="button" onClick={saveRecipe}>
                <Save size={18} /> Save to recipe book
              </button>
            </div>
          </header>

          <section className="import-evidence" aria-labelledby="evidence-heading">
            <div className="import-evidence__summary">
              <span className="import-step">Evidence</span>
              <div>
                <h3 id="evidence-heading">Source: {sourceMethodLabel(draft.source.method)}</h3>
                <p>
                  {draft.source.title || 'YouTube video'}
                  {draft.source.creator ? ` · ${draft.source.creator}` : ''}
                </p>
                <a
                  className="source-link"
                  href={draft.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open original video <ExternalLink size={15} />
                </a>
              </div>
            </div>
            <details>
              <summary>Show written source evidence</summary>
              <div className="import-evidence__text">
                <h4>Description</h4>
                <p>{draft.source.description || 'No description text was available.'}</p>
                {draft.source.captions && (
                  <>
                    <h4>Captions used for review</h4>
                    <p>{draft.source.captions}</p>
                  </>
                )}
              </div>
            </details>
          </section>

          {(draft.warnings.length > 0 || draft.recipe.dataGaps.length > 0) && (
            <section
              className="import-callout import-callout--warning"
              aria-label="Review warnings"
            >
              <AlertCircle size={18} />
              <div>
                <strong>Needs your review</strong>
                <ul>
                  {Array.from(new Set([...draft.warnings, ...draft.recipe.dataGaps])).map(
                    (warning) => (
                      <li key={warning}>{warning}</li>
                    ),
                  )}
                </ul>
              </div>
            </section>
          )}
          {saveError && (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          )}

          <section className="import-card" aria-labelledby="recipe-basics-heading">
            <div className="import-card__title">
              <span className="import-step">2</span>
              <div>
                <h3 id="recipe-basics-heading">Recipe basics</h3>
                <p>
                  Keep the title, usable ingredients, method, and yield clear enough to cook and
                  shop. Everything else can wait.
                </p>
              </div>
            </div>
            <div className="form-grid">
              <label className="field field--wide">
                <span>Title</span>
                <input
                  value={draft.recipe.name}
                  onChange={(event) => patchRecipe({ name: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Yield / servings</span>
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  inputMode="decimal"
                  value={draft.recipe.baseServings ?? ''}
                  onChange={(event) => {
                    const value = event.target.value === '' ? null : Number(event.target.value);
                    const next = Number.isFinite(value) ? value : null;
                    patchRecipe(
                      confirmedNutrition(draft.recipe, draft.recipe.nutritionBasis, next),
                    );
                  }}
                  placeholder="Unknown"
                />
              </label>
              <fieldset className="filter-fieldset field--wide">
                <legend>
                  Meal roles <em>optional</em>
                </legend>
                <div className="chip-row">
                  {mealTypes.map((role) => (
                    <button
                      type="button"
                      className={`chip ${draft.recipe.roles.includes(role) ? 'is-active' : ''}`}
                      key={role}
                      aria-pressed={draft.recipe.roles.includes(role)}
                      onClick={() => toggleRole(role)}
                    >
                      {humanRole(role)}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>

          <button
            type="button"
            className="disclosure import-advanced-toggle"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((value) => !value)}
          >
            {advancedOpen ? 'Hide nutrition and organization' : 'Nutrition and organization'}{' '}
            {advancedOpen ? <Minus size={16} /> : <Plus size={16} />}
          </button>
          {advancedOpen && (
            <div className="import-review__grid">
              <section className="import-card" aria-labelledby="organization-heading">
                <div className="import-card__title">
                  <span className="import-step">Optional</span>
                  <div>
                    <h3 id="organization-heading">Organization</h3>
                    <p>
                      Tags and categories are saved exactly as you enter them. They are not required
                      to keep this recipe.
                    </p>
                  </div>
                </div>
                <div className="form-grid">
                  <label className="field">
                    <span>Tags</span>
                    <input
                      value={tagsText}
                      onChange={(event) => {
                        setTagsText(event.target.value);
                        patchRecipe({ tags: commaList(event.target.value) });
                      }}
                      placeholder="comma separated"
                    />
                  </label>
                  <label className="field">
                    <span>Categories</span>
                    <input
                      value={categoriesText}
                      onChange={(event) => {
                        setCategoriesText(event.target.value);
                        patchRecipe({ categories: commaList(event.target.value) });
                      }}
                      placeholder="comma separated"
                    />
                  </label>
                </div>
              </section>
              <section className="import-card" aria-labelledby="nutrition-review-heading">
                <div className="import-card__title">
                  <span className="import-step">Optional</span>
                  <h3 id="nutrition-review-heading">Reported nutrition</h3>
                </div>
                {reported ? (
                  <>
                    <p className="field-hint">
                      These values are reported from the source. They are not used as per-serving
                      nutrition until you confirm their basis.
                    </p>
                    <div className="import-nutrition-list">
                      {allMacros.map((key) => (
                        <p key={key}>
                          <span>{macroLabels[key]}</span>
                          <strong>{macroValue(key, draft.recipe.reportedNutrition[key])}</strong>
                        </p>
                      ))}
                    </div>
                    <label className="field">
                      <span>Confirmed basis</span>
                      <select
                        value={draft.recipe.nutritionBasis}
                        onChange={(event) =>
                          patchRecipe(
                            confirmedNutrition(
                              draft.recipe,
                              event.target.value as Recipe['nutritionBasis'],
                            ),
                          )
                        }
                      >
                        <option value="unspecified">
                          Reported, basis unknown — do not use per serving
                        </option>
                        <option value="per_serving">Per serving — confirmed by me</option>
                        <option value="per_recipe">Whole recipe — confirmed by me</option>
                        <option value="not_stated">Do not retain a nutrition basis</option>
                      </select>
                    </label>
                    {draft.recipe.nutritionBasis === 'per_recipe' && !draft.recipe.baseServings && (
                      <p className="field-hint">
                        A whole-recipe basis is confirmed, but yield is still unknown, so no
                        per-serving values are calculated.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="field-hint">
                    No nutrition was reported in the source. Meal Planner will not estimate it from
                    ingredients.
                  </p>
                )}
              </section>
            </div>
          )}

          <section className="import-card" aria-labelledby="ingredients-review-heading">
            <div className="import-card__title">
              <span className="import-step">4</span>
              <div>
                <h3 id="ingredients-review-heading">Ingredients</h3>
                <p>
                  Keep source wording where it is uncertain. An empty amount is intentionally
                  unknown.
                </p>
              </div>
            </div>
            <div className="ingredient-edit-list">
              {draft.recipe.ingredients.map((ingredient) => (
                <fieldset className="ingredient-edit-row" key={ingredient.id}>
                  <label className="field">
                    <span>Ingredient</span>
                    <input
                      value={ingredient.name}
                      onChange={(event) =>
                        patchIngredient(ingredient.id, { name: event.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Amount</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      inputMode="decimal"
                      value={ingredient.quantity ?? ''}
                      onChange={(event) => {
                        const value = event.target.value === '' ? null : Number(event.target.value);
                        patchIngredient(ingredient.id, {
                          quantity: Number.isFinite(value) ? value : null,
                        });
                      }}
                      placeholder="Unknown"
                    />
                  </label>
                  <label className="field">
                    <span>Unit</span>
                    <input
                      value={ingredient.unit ?? ''}
                      onChange={(event) =>
                        patchIngredient(ingredient.id, { unit: event.target.value.trim() || null })
                      }
                      placeholder="g, ml, tbsp…"
                    />
                  </label>
                  <label className="field field--wide">
                    <span>Source wording</span>
                    <input
                      value={ingredient.sourceText ?? ingredient.quantityText}
                      onChange={(event) =>
                        patchIngredient(ingredient.id, {
                          sourceText: event.target.value,
                          quantityText: event.target.value,
                        })
                      }
                      placeholder="As written in the source"
                    />
                  </label>
                  <button
                    type="button"
                    className="icon-button icon-button--small"
                    aria-label={`Remove ${ingredient.name || 'ingredient'}`}
                    disabled={draft.recipe.ingredients.length === 1}
                    onClick={() =>
                      patchRecipe({
                        ingredients: draft.recipe.ingredients.filter(
                          (item) => item.id !== ingredient.id,
                        ),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </fieldset>
              ))}
            </div>
            <button
              type="button"
              className="button button--quiet"
              onClick={() =>
                patchRecipe({
                  ingredients: [
                    ...draft.recipe.ingredients,
                    {
                      id: makeId('ingredient'),
                      name: '',
                      quantity: null,
                      unit: null,
                      quantityText: '',
                      sourceText: '',
                      aisle: 'Review',
                    },
                  ],
                })
              }
            >
              <Plus size={17} /> Add ingredient
            </button>
          </section>

          <section className="import-card" aria-labelledby="steps-review-heading">
            <div className="import-card__title">
              <span className="import-step">5</span>
              <div>
                <h3 id="steps-review-heading">Cooking steps</h3>
                <p>One step per line. Correct anything the source left unclear before saving.</p>
              </div>
            </div>
            <label className="field">
              <span className="sr-only">Cooking steps</span>
              <textarea
                rows={8}
                value={stepsText}
                onChange={(event) => {
                  setStepsText(event.target.value);
                  patchRecipe({
                    steps: event.target.value
                      .split('\n')
                      .map((step) => step.trim())
                      .filter(Boolean),
                  });
                }}
                placeholder="Add clear cooking steps, one per line."
              />
            </label>
          </section>

          <footer className="import-review__footer">
            <button type="button" className="button button--quiet" onClick={onBack}>
              Keep draft for later
            </button>
            <button type="button" className="button" onClick={saveRecipe}>
              <Save size={18} /> Save to recipe book
            </button>
            <p>
              Saving opens the shared recipe detail, where you can use it in your saved week and
              shopping list.
            </p>
          </footer>
        </section>
      )}
    </section>
  );
}
