import { Clock3 } from 'lucide-react';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import type { Recipe } from '@domain/types';
import { displayNumber } from '../components/shared';

export const DialogFeedbackContext = createContext({ text: '', isError: false });

export function LabelledButton({
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; className?: string }) {
  return (
    <button type="button" className={`mb-button ${className}`} {...props}>
      {children}
    </button>
  );
}

export function AppDialog({
  open,
  onClose,
  labelledBy,
  children,
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const feedback = useContext(DialogFeedbackContext);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    if (!dialog.open) dialog.showModal();
    const cancel = (event: Event) => {
      event.preventDefault();
      closeRef.current();
    };
    dialog.addEventListener('cancel', cancel);
    return () => {
      dialog.removeEventListener('cancel', cancel);
      if (dialog.open) dialog.close();
    };
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      className={`mb-dialog ${className}`}
      ref={ref}
      aria-labelledby={labelledBy}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          closeRef.current();
      }}
    >
      {feedback.isError && feedback.text && (
        <p className="mb-dialog-feedback" role="alert">
          {feedback.text}
        </p>
      )}
      {children}
    </dialog>
  );
}

export function recipeTime(recipe: Recipe): string | null {
  if (recipe.prepMinutes === null && recipe.cookMinutes === null) return null;
  const bits: string[] = [];
  if (recipe.prepMinutes !== null) bits.push(`Prep ${displayNumber(recipe.prepMinutes, 0)} min`);
  if (recipe.cookMinutes !== null) bits.push(`Cook ${displayNumber(recipe.cookMinutes, 0)} min`);
  return bits.join(' · ');
}

export function macroFacts(recipe: Recipe): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string }> = [];
  if (recipe.nutrition.calories !== null)
    facts.push({ label: 'Calories', value: `${displayNumber(recipe.nutrition.calories, 0)} kcal` });
  if (recipe.nutrition.protein !== null)
    facts.push({ label: 'Protein', value: `${displayNumber(recipe.nutrition.protein)} g` });
  return facts;
}

const covers: Record<string, string> = {
  'youtube:icQDSc0Zj4c': '/images/covers/fajita.webp',
  'youtube:bZfP9amRyl0': '/images/covers/risotto.webp',
  'youtube:GbCJnpkWDV0': '/images/covers/quiche.webp',
};

export function RecipeVisual({ recipe, large = false }: { recipe: Recipe; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const cover = covers[recipe.id];
  const image = cover ?? recipe.image;
  const label = cover ? 'Illustrative cover' : recipe.image ? 'Source thumbnail' : null;
  useEffect(() => setFailed(false), [image]);
  return (
    <div
      className={`mb-recipe-visual ${large ? 'mb-recipe-visual--large' : ''} ${!image || failed ? 'mb-recipe-visual--fallback' : ''}`}
    >
      {image && !failed ? (
        <img
          src={image}
          alt={`${cover ? 'Illustrative cover' : 'Source thumbnail'} for ${recipe.name}`}
          loading={large ? 'eager' : 'lazy'}
          fetchPriority={large ? 'high' : 'auto'}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="mb-fallback-art" aria-hidden="true">
          <span>Saved recipe</span>
        </div>
      )}
      {label && <span className="mb-media-label">{label}</span>}
    </div>
  );
}

export function RecipeCard({
  recipe,
  onOpen,
  state,
  portionText,
  selected = false,
  compact = false,
  action,
}: {
  recipe: Recipe;
  onOpen: () => void;
  state?: string;
  portionText?: string;
  selected?: boolean;
  compact?: boolean;
  action?: ReactNode;
}) {
  const titleId = useId();
  const time = recipeTime(recipe);
  const facts = macroFacts(recipe);
  return (
    <article
      className={`mb-recipe-card ${selected ? 'is-selected' : ''} ${compact ? 'mb-recipe-card--compact' : ''}`}
    >
      <button
        type="button"
        className="mb-recipe-card__open"
        onClick={onOpen}
        aria-labelledby={titleId}
      >
        <RecipeVisual recipe={recipe} />
        {state && (
          <div className="mb-card-state">
            <span>{state}</span>
            {portionText && <b>{portionText}</b>}
          </div>
        )}
        <div className="mb-recipe-card__body">
          <h3 id={titleId}>{recipe.name}</h3>
          {time ? (
            <p className="mb-card-time">
              <Clock3 size={15} aria-hidden="true" /> {time}
            </p>
          ) : (
            <p className="mb-card-time">Time not confirmed</p>
          )}
          {facts.length > 0 && (
            <>
              <div className="mb-facts" aria-label="Nutrition per recipe serving">
                {facts.map((fact) => (
                  <span key={fact.label}>{fact.value}</span>
                ))}
              </div>
              <p className="mb-card-nutrition-basis">Per recipe serving</p>
            </>
          )}
          <p className="mb-card-source">
            {recipe.creatorCredit || recipe.sourceName || 'Personal recipe'}
          </p>
        </div>
      </button>
      {action && <div className="mb-recipe-card__action">{action}</div>}
    </article>
  );
}
