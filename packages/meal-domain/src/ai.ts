import type { Recipe } from './types';

/** A persisted, reviewable organizational suggestion; not a nutrition or safety claim. */
export interface DecisionSuggestion {
  recipeId: string;
  kind: string;
  label: string;
  score: number;
  modelRevision: string;
  taxonomyVersion: string;
  status: 'proposed' | 'accepted' | 'edited' | 'rejected';
}

/** User-controlled closed labels supplied to an optional local decision adapter. */
export interface DecisionTaxonomy {
  version: string;
  labels: Record<string, string[]>;
}

/**
 * An optional port. The core never calls a network or inference service itself;
 * callers can omit this provider and keep all organization manual.
 */
export interface DecisionProvider {
  labels(recipe: Recipe, taxonomy: DecisionTaxonomy): Promise<DecisionSuggestion[]>;
}
