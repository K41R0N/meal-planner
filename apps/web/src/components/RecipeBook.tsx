import { BookOpen, ChevronDown, Plus, X } from 'lucide-react';
import { useState } from 'react';
import type { MealType, Recipe } from '@domain/types';
import { emptyNutrition, mealTypes } from '@domain/types';
import { validateRecipes } from '@domain/index';
import { Filters } from './Filters';
import { RecipeCard } from './RecipeCard';
import { commaList, humanRole, makeId, parseIngredientText } from './shared';

interface RecipeBookProps {
  recipes: Recipe[];
  filteredRecipes: Recipe[];
  filters: import('@domain/types').Filters;
  onFiltersChange: (filters: import('@domain/types').Filters) => void;
  onOpenRecipe: (recipe: Recipe) => void;
  onAddRecipe: (recipe: Recipe) => boolean;
  onImportFromYouTube: () => void;
}

function parseIngredient(line: string) {
  return parseIngredientText(line);
}

export function RecipeBook({ recipes, filteredRecipes, filters, onFiltersChange, onOpenRecipe, onAddRecipe, onImportFromYouTube }: RecipeBookProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', ingredients: '', steps: '', baseServings: '', roles: [] as MealType[], tags: '', sourceUrl: '' });
  const patch = (changes: Partial<typeof form>) => setForm({ ...form, ...changes });
  const toggleRole = (role: MealType) => patch({ roles: form.roles.includes(role) ? form.roles.filter(value => value !== role) : [...form.roles, role] });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const ingredients = form.ingredients.split('\n').map(parseIngredient).filter(ingredient => ingredient.name);
    const steps = form.steps.split('\n').map(step => step.trim()).filter(Boolean);
    const baseServings = form.baseServings === '' ? null : Number(form.baseServings);
    if (!form.name.trim() || !ingredients.length || !steps.length) { setError('Add a recipe name, at least one ingredient, and at least one cooking step.'); return; }
    if (baseServings !== null && (!Number.isFinite(baseServings) || baseServings <= 0)) { setError('Base servings must be a positive number, or left empty.'); return; }
    const recipe: Recipe = {
      id: makeId('personal'), name: form.name.trim(), ingredients, steps, baseServings,
      roles: form.roles, tags: commaList(form.tags), categories: [], nutrition: emptyNutrition(), reportedNutrition: emptyNutrition(), nutritionBasis: 'not_stated',
      sourceUrl: form.sourceUrl.trim() || null, sourceName: 'Personal recipe', creatorCredit: null, viewCount: null, viewCountAt: null, image: null,
      prepMinutes: null, cookMinutes: null, mealPrepRating: null, mealPrepNotes: '', dataGaps: [], favorite: false, addedAt: new Date().toISOString(),
    };
    try{const validated=validateRecipes([recipe])[0];if(!onAddRecipe(validated)){setError('This recipe could not be saved. It may already be in your book.');return;}setAdding(false);setError('');setForm({name:'',ingredients:'',steps:'',baseServings:'',roles:[],tags:'',sourceUrl:''});}
    catch(reason){setError(reason instanceof Error?reason.message:'Check the new recipe details.');}
  };

  return <section className="page recipe-book-page" aria-labelledby="book-heading">
    <header className="page-heading"><div><p className="eyebrow">Your private collection</p><h1 id="book-heading">The recipe book</h1><p>Find a source recipe, or add your own notes. Nutrition stays blank until it is known.</p></div><div className="recipe-book-actions"><button type="button" className="button button--quiet" onClick={onImportFromYouTube}><BookOpen size={18} /> Import from YouTube</button><button type="button" className="button" onClick={() => setAdding(value => !value)}><BookOpen size={18} /> Add recipe</button></div></header>
    {adding && <form className="manual-recipe-form" onSubmit={submit}><div className="section-heading"><div><h2>New personal recipe</h2><p className="quiet">Ingredient lines are kept as written unless a simple number and unit are explicit.</p></div><button type="button" className="icon-button" onClick={() => setAdding(false)} aria-label="Close add recipe form"><X /></button></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-grid"><label className="field field--wide"><span>Name</span><input required value={form.name} onChange={event => patch({ name: event.target.value })} /></label><label className="field"><span>Base servings</span><input type="number" min="0.25" step="0.25" value={form.baseServings} onChange={event => patch({ baseServings: event.target.value })} placeholder="Optional" /></label><label className="field"><span>Tags</span><input value={form.tags} onChange={event => patch({ tags: event.target.value })} placeholder="comma separated" /></label><label className="field field--wide"><span>Ingredients, one per line</span><textarea required value={form.ingredients} onChange={event => patch({ ingredients: event.target.value })} placeholder={'2 tomatoes\n1 tbsp olive oil\nSalt to taste'} /></label><label className="field field--wide"><span>Cooking steps, one per line</span><textarea required value={form.steps} onChange={event => patch({ steps: event.target.value })} placeholder={'Chop the tomatoes.\nCook until softened.'} /></label><fieldset className="filter-fieldset field--wide"><legend>Meal roles</legend><div className="chip-row">{mealTypes.map(role => <button type="button" className={`chip ${form.roles.includes(role) ? 'is-active' : ''}`} key={role} aria-pressed={form.roles.includes(role)} onClick={() => toggleRole(role)}>{humanRole(role)}</button>)}</div></fieldset><label className="field field--wide"><span>Original source URL</span><input type="url" value={form.sourceUrl} onChange={event => patch({ sourceUrl: event.target.value })} placeholder="Optional" /></label></div><button type="submit" className="button"><Plus size={18} /> Save personal recipe</button></form>}
    <Filters filters={filters} recipes={recipes} open={filtersOpen} onOpenChange={setFiltersOpen} onChange={onFiltersChange} />
    <div className="result-bar"><p><strong>{filteredRecipes.length}</strong> {filteredRecipes.length === 1 ? 'recipe' : 'recipes'} shown</p>{Boolean(filters.search || filters.role !== 'all' || filters.tags.length || filters.categories.length || filters.includeIngredients.length || filters.excludeIngredients.length || filters.favoritesOnly || Object.keys(filters.ranges).length) && <button type="button" className="text-button" onClick={() => onFiltersChange({ ...filters, search: '', role: 'all', tags: [], categories: [], includeIngredients: [], excludeIngredients: [], ranges: {}, minMealPrep: undefined, favoritesOnly: false })}>Clear filters</button>}</div>
    {filteredRecipes.length ? <div className="recipe-grid">{filteredRecipes.map(recipe => <RecipeCard recipe={recipe} key={recipe.id} onOpen={onOpenRecipe} />)}</div> : <div className="empty-state"><ChevronDown size={28} /><h2>No recipes match these filters</h2><p>Try removing a range or ingredient rule. Unknown nutrition is left out of nutrition ranges by design.</p><button type="button" className="button button--quiet" onClick={() => onFiltersChange({ ...filters, search: '', role: 'all', tags: [], categories: [], includeIngredients: [], excludeIngredients: [], ranges: {}, minMealPrep: undefined, favoritesOnly: false })}>Reset recipe filters</button></div>}
  </section>;
}
