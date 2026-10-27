import { Clock3, Heart, ImageOff, Star } from 'lucide-react';
import { useState } from 'react';
import type { Recipe } from '@domain/types';
import { displayNumber, humanRole, primaryMacros, recipeTime } from './shared';

interface RecipeCardProps {
  recipe: Recipe;
  onOpen: (recipe: Recipe) => void;
  compact?: boolean;
  selected?: boolean;
  action?: React.ReactNode;
}

export function RecipeCard({ recipe, onOpen, compact = false, selected = false, action }: RecipeCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const time = recipeTime(recipe);
  const hasImage = Boolean(recipe.image && !imageFailed);

  return (
    <article className={`recipe-card ${compact ? 'recipe-card--compact' : ''} ${selected ? 'is-selected' : ''}`}>
      <button className="recipe-card__open" type="button" onClick={() => onOpen(recipe)} aria-label={`Open ${recipe.name}`}>
        <div className={`recipe-card__image ${hasImage ? '' : 'recipe-card__image--fallback'}`}>
          {hasImage ? (
            <img src={recipe.image!} alt="" loading="lazy" onError={() => setImageFailed(true)} />
          ) : <ImageOff aria-hidden="true" size={22} />}
          {recipe.favorite && <span className="recipe-card__favorite" aria-label="Favorite"><Heart size={14} fill="currentColor" /></span>}
          {recipe.roles[0] && <span className="recipe-card__role">{humanRole(recipe.roles[0])}</span>}
        </div>
        <div className="recipe-card__body">
          <h3>{recipe.name}</h3>
          <p className="recipe-card__source">{recipe.sourceName || 'Personal recipe'}</p>
          {!compact && (
            <div className="recipe-card__facts">
              {time && <span><Clock3 size={14} aria-hidden="true" /> {time}</span>}
              {recipe.mealPrepRating !== null && <span><Star size={14} aria-hidden="true" /> {displayNumber(recipe.mealPrepRating, 0)}/5</span>}
            </div>
          )}
          <div className="macro-strip" aria-label="Per serving nutrition, where confirmed">
            {primaryMacros.map(key => (
              <span key={key}>{key === 'calories' ? 'Cal' : key.slice(0, 1).toUpperCase()}{recipe.nutrition[key] === null ? ' —' : ` ${displayNumber(recipe.nutrition[key])}`}</span>
            ))}
          </div>
        </div>
      </button>
      {action && <div className="recipe-card__action">{action}</div>}
    </article>
  );
}
