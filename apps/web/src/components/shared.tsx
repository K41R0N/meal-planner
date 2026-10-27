import type { MacroKey, Nutrition, Recipe } from '@domain/types';

export const macroLabels: Record<MacroKey, string> = {
  calories: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat',
  fiber: 'Fiber', sugar: 'Sugar', sodium: 'Sodium',
};

export const macroUnits: Record<MacroKey, string> = {
  calories: 'kcal', protein: 'g', carbs: 'g', fat: 'g', fiber: 'g', sugar: 'g', sodium: 'mg',
};

export const primaryMacros: MacroKey[] = ['calories', 'protein', 'carbs', 'fat'];
export const allMacros: MacroKey[] = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'];

export function displayNumber(value: number | null | undefined, maximumFractionDigits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}

export function macroValue(key: MacroKey, value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${displayNumber(value)} ${macroUnits[key]}`;
}

export function dateLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(parsed);
}

export function shortDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(parsed);
}

export function localDate(value = new Date()): string {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

export function localMonday(value = new Date()): string {
  const copy = new Date(value);
  const weekday = copy.getDay() || 7;
  copy.setDate(copy.getDate() - weekday + 1);
  return localDate(copy);
}

export function humanRole(role: string): string {
  return role.slice(0, 1).toUpperCase() + role.slice(1);
}

export function recipeTime(recipe: Recipe): string | null {
  const total = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  return total > 0 ? `${total} min` : null;
}

export function commaList(value: string): string[] {
  return value.split(',').map(part => part.trim()).filter(Boolean);
}

export function nutrientCoverage(entries: Array<{ nutritionSnapshot: Nutrition }>, key: MacroKey): boolean {
  return entries.length > 0 && entries.every(entry => entry.nutritionSnapshot[key] !== null);
}

export function makeId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

export function isPositiveNumber(value: string): boolean {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

export function parseIngredientText(line:string):import('@domain/types').IngredientLine {
  const raw=line.trim();
  const match=/^(\d+(?:\.\d+)?(?:\/\d+)?)(?=\s|[a-zA-Z]|$)\s*(.*)$/.exec(raw);
  let quantity:number|null=null,unit:string|null=null,name=raw;
  if(match){
    const numbers=match[1].split('/').map(Number);
    const value=numbers.length===2?numbers[0]/numbers[1]:numbers[0];
    const rest=match[2].trim();
    const token=/^([a-zA-Z]+)(?:\s+|$)(.*)$/.exec(rest);
    const units=new Set(['g','kg','ml','l','tsp','tbsp','cup','cups','clove','cloves','tin','tins','can','cans','packet','packets','piece','pieces']);
    if(Number.isFinite(value)&&value>=0&&rest){
      quantity=value;
      if(token&&units.has(token[1].toLowerCase())&&token[2].trim()){unit=token[1].toLowerCase();name=token[2].trim();}
      else name=rest;
    }
  }
  return {id:makeId('ingredient'),name,quantity,unit,quantityText:raw,aisle:'Review',sourceText:raw};
}
