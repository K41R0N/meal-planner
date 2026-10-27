import { ChevronDown, Filter, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Filters as FilterModel, MacroKey, MealType, Recipe, SortOrder } from '@domain/types';
import { defaultFilters, mealTypes } from '@domain/types';
import { allMacros, commaList, humanRole, macroLabels, macroUnits } from './shared';

interface FiltersProps {
  filters: FilterModel;
  recipes: Recipe[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (filters: FilterModel) => void;
}

const sortOptions: Array<[SortOrder, string]> = [
  ['popular', 'Most viewed'], ['name', 'Name'], ['calories', 'Calories'], ['protein', 'Protein'],
  ['carbs', 'Carbs'], ['fat', 'Fat'], ['fiber', 'Fiber'], ['sugar', 'Sugar'], ['sodium', 'Sodium'],
  ['mealPrep', 'Meal-prep rating'], ['newest', 'Recently added'],
];

function uniqueValues(recipes: Recipe[], field: 'tags' | 'categories'): string[] {
  return [...new Set(recipes.flatMap(recipe => recipe[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function ToggleValues({ label, values, selected, onChange }: { label: string; values: string[]; selected: string[]; onChange: (values: string[]) => void }) {
  return <fieldset className="filter-fieldset">
    <legend>{label}</legend>
    <div className="chip-row">
      {values.length ? values.map(value => {
        const active = selected.includes(value);
        return <button key={value} type="button" className={`chip ${active ? 'is-active' : ''}`} aria-pressed={active} onClick={() => onChange(active ? selected.filter(item => item !== value) : [...selected, value])}>{value}</button>;
      }) : <p className="quiet">No {label.toLowerCase()} in this book yet.</p>}
    </div>
  </fieldset>;
}

export function Filters({ filters, recipes, open, onOpenChange, onChange }: FiltersProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [includeText,setIncludeText]=useState(filters.includeIngredients.join(', '));
  const [excludeText,setExcludeText]=useState(filters.excludeIngredients.join(', '));
  useEffect(()=>{if(!open){setIncludeText(filters.includeIngredients.join(', '));setExcludeText(filters.excludeIngredients.join(', '));}},[open,filters.includeIngredients.join(', '),filters.excludeIngredients.join(', ')]);
  const tags = uniqueValues(recipes, 'tags');
  const categories = uniqueValues(recipes, 'categories');
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('input, button, select')?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onOpenChange(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => { window.removeEventListener('keydown', onKeyDown); previous?.focus(); };
  }, [open, onOpenChange]);

  const patch = (changes: Partial<FilterModel>) => onChange({ ...filters, ...changes });
  const setRange = (key: MacroKey, edge: 'min' | 'max', value: string) => {
    const parsed = value === '' ? undefined : Number(value);
    const current = { ...(filters.ranges[key] ?? {}) };
    if (parsed === undefined || !Number.isFinite(parsed)) delete current[edge]; else current[edge] = parsed;
    const ranges = { ...filters.ranges };
    if (current.min === undefined && current.max === undefined) delete ranges[key]; else ranges[key] = current;
    patch({ ranges });
  };

  return <>
    <div className="search-row">
      <label className="search-box"><Search size={18} aria-hidden="true" /><span className="sr-only">Search names and ingredients</span><input value={filters.search} onChange={event => patch({ search: event.target.value })} placeholder="Search recipes or ingredients" /></label>
      <button type="button" className="icon-button" aria-label="Open filters" onClick={() => onOpenChange(true)}><SlidersHorizontal size={20} /></button>
    </div>
    <div className="filter-summary-row">
      <label className="select-inline">Sort <select value={filters.sort} onChange={event => patch({ sort: event.target.value as SortOrder })}>{sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <span className="filter-mode-label">{filters.nutritionMode === 'perServing' ? 'Confirmed per serving' : 'Source-reported basis'}</span>
    </div>
    {open && <div className="filter-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onOpenChange(false); }}>
      <section className="filter-sheet" role="dialog" aria-modal="true" aria-labelledby="filter-title" ref={dialogRef}>
        <header className="sheet-header"><div><p className="eyebrow"><Filter size={14} /> Recipe book</p><h2 id="filter-title">Filter recipes</h2></div><button type="button" className="icon-button" onClick={() => onOpenChange(false)} aria-label="Close filters"><X /></button></header>
        <div className="sheet-content">
          <label className="field"><span>Meal role</span><select value={filters.role} onChange={event => patch({ role: event.target.value as FilterModel['role'] })}><option value="all">All meal roles</option>{mealTypes.map((role: MealType) => <option value={role} key={role}>{humanRole(role)}</option>)}</select></label>
          <ToggleValues label="Categories" values={categories} selected={filters.categories} onChange={categories => patch({ categories })} />
          <ToggleValues label="Tags" values={tags} selected={filters.tags} onChange={tags => patch({ tags })} />
          <div className="two-columns"><label className="field"><span>Include ingredients</span><input value={includeText} onChange={event => {setIncludeText(event.target.value);patch({ includeIngredients: commaList(event.target.value) });}} placeholder="e.g. chickpeas, lemon" /></label><label className="field"><span>Exclude ingredients</span><input value={excludeText} onChange={event => {setExcludeText(event.target.value);patch({ excludeIngredients: commaList(event.target.value) });}} placeholder="e.g. peanuts" /></label></div>
          <fieldset className="filter-fieldset"><legend>Nutrition ranges</legend><p className="field-hint">{filters.nutritionMode === 'perServing' ? 'Uses confirmed per-serving values. Unknown values are excluded from ranges and sorted last.' : 'Uses source-reported values only. Bases may differ, so compare with care; unknown values are excluded.'}</p><div className="nutrition-range-grid">{allMacros.map(key => <div className="range-control" key={key}><span>{macroLabels[key]} <small>({macroUnits[key]})</small></span><label><span className="sr-only">Minimum {macroLabels[key]}</span><input type="number" min="0" inputMode="decimal" value={filters.ranges[key]?.min ?? ''} onChange={event => setRange(key, 'min', event.target.value)} placeholder="Min" /></label><span>–</span><label><span className="sr-only">Maximum {macroLabels[key]}</span><input type="number" min="0" inputMode="decimal" value={filters.ranges[key]?.max ?? ''} onChange={event => setRange(key, 'max', event.target.value)} placeholder="Max" /></label></div>)}</div></fieldset>
          <label className="field"><span>Minimum meal-prep rating</span><select value={filters.minMealPrep ?? ''} onChange={event => patch({ minMealPrep: event.target.value === '' ? undefined : Number(event.target.value) })}><option value="">Any rating, including unrated</option>{[0, 1, 2, 3, 4, 5].map(value => <option value={value} key={value}>{value}/5 or higher</option>)}</select></label>
          <label className="toggle-line"><input type="checkbox" checked={filters.favoritesOnly} onChange={event => patch({ favoritesOnly: event.target.checked })} /><span>Favorites only</span></label>
          <fieldset className="filter-fieldset"><legend>Nutrition value type</legend><label className="radio-line"><input type="radio" name="nutrition-mode" checked={filters.nutritionMode === 'perServing'} onChange={() => patch({ nutritionMode: 'perServing' })} /><span><strong>Confirmed per serving</strong><small>Appropriate for per-portion filtering and comparison.</small></span></label><label className="radio-line"><input type="radio" name="nutrition-mode" checked={filters.nutritionMode === 'reported'} onChange={() => patch({ nutritionMode: 'reported' })} /><span><strong>As reported by source</strong><small>May be per recipe or unspecified; it is not presented as comparable per-serving data.</small></span></label></fieldset>
        </div>
        <footer className="sheet-footer"><button type="button" className="button button--quiet" onClick={() => {setIncludeText('');setExcludeText('');onChange(defaultFilters());}}><RotateCcw size={17} /> Reset</button><button type="button" className="button" onClick={() => onOpenChange(false)}>Show recipes <ChevronDown size={17} /></button></footer>
      </section>
    </div>}
  </>;
}
