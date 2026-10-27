import { openDB } from 'idb';
import { validateState, validateRecipes } from '@domain/index';
import { emptyNutrition, type AppState } from '@domain/types';

const KEY = 'personal-meal-planner-v1';
const dbPromise = openDB('meal-planner-personal', 1, {
  upgrade(database) { database.createObjectStore('state'); },
});
// The browser may deny IndexedDB in private/embedded contexts. A same-device
// localStorage fallback is used only if available; failure is surfaced to the UI.
dbPromise.catch(() => undefined);

export async function loadState(): Promise<AppState> {
  let cached: unknown;
  try { cached = await (await dbPromise).get('state', KEY); } catch { /* fallback below */ }
  if (!cached) {
    try { const text=localStorage.getItem(KEY); if(text) cached=JSON.parse(text); } catch { /* seed below */ }
  }
  if (cached) return validateState(cached);
  const response = await fetch('/data/recipe-bank.json');
  if (!response.ok) throw new Error('The recipe bank could not be loaded. Reconnect once to finish the first download.');
  const recipes = validateRecipes(await response.json());
  const state: AppState = {
    version:1, recipes, plans:[], activePlanId:null, logs:[],
    targets:emptyNutrition(), shoppingChecks:{}, manualShopping:{},
  };
  // Seed loading must not fail just because persistent storage is unavailable.
  // The next UI save reports such a failure instead of claiming data is saved.
  try { await saveState(state); } catch { /* UI persistence effect displays warning */ }
  return state;
}

export async function saveState(state: AppState): Promise<void> {
  try { await (await dbPromise).put('state', state, KEY); return; } catch { /* fallback below */ }
  try { localStorage.setItem(KEY, JSON.stringify(state)); return; } catch {
    throw new Error('This browser is blocking device storage. Changes are temporary; export a backup before closing.');
  }
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data,null,2)+'\n'], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href=url; link.download=filename; document.body.appendChild(link);
  link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
