import { openDB } from 'idb';
import { validateState, validateRecipes } from '@domain/index';
import { emptyNutrition, type AppState } from '@domain/types';
import { selectStorageRecord, wrapStorageRecord } from './storage-records';

const KEY = 'personal-meal-planner-v1';
const dbPromise = Promise.resolve().then(() =>
  openDB('meal-planner-personal', 1, {
    upgrade(database) {
      database.createObjectStore('state');
    },
  }),
);
dbPromise.catch(() => undefined);
let latestStamp = 0;
let saveQueue: Promise<void> = Promise.resolve();

export async function loadState(): Promise<AppState> {
  let indexed: unknown;
  try {
    indexed = await (await dbPromise).get('state', KEY);
  } catch {
    /* Same-device fallback below. */
  }
  let fallback: string | null = null;
  try {
    fallback = localStorage.getItem(KEY);
  } catch {
    /* Unavailable storage is surfaced on save. */
  }
  const cached = selectStorageRecord(indexed, fallback);
  if (cached) {
    latestStamp = Math.max(latestStamp, cached.savedAt);
    return validateState(cached.state);
  }
  const response = await fetch('/data/recipe-bank.json');
  if (!response.ok)
    throw new Error(
      'The recipe bank could not be loaded. Reconnect once to finish the first download.',
    );
  const recipes = validateRecipes(await response.json());
  const state: AppState = {
    version: 1,
    recipes,
    plans: [],
    activePlanId: null,
    logs: [],
    targets: emptyNutrition(),
    shoppingChecks: {},
    manualShopping: {},
  };
  try {
    await saveState(state);
  } catch {
    /* The UI shows the persistent-storage warning. */
  }
  return state;
}

export function saveState(state: AppState): Promise<void> {
  const snapshot = structuredClone(state);
  latestStamp = Math.max(Date.now(), latestStamp + 1);
  const envelope = wrapStorageRecord(snapshot, latestStamp);
  let fallbackSaved = false;
  try {
    localStorage.setItem(KEY, JSON.stringify(envelope));
    fallbackSaved = true;
  } catch {
    // Large books may exceed localStorage. IndexedDB remains the primary store.
  }
  const write = saveQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        await (await dbPromise).put('state', envelope, KEY);
        return;
      } catch {
        /* Fallback remains private on this device. */
      }
      if (fallbackSaved) return;
      try {
        localStorage.setItem(KEY, JSON.stringify(envelope));
      } catch {
        throw new Error(
          'This browser is blocking device storage. Changes are temporary; export a backup before closing.',
        );
      }
    });
  saveQueue = write;
  return write;
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
