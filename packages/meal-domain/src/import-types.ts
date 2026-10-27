import type { Recipe } from './types';

export interface YouTubeReference { videoId: string; url: string; }
export interface RecipeSourceEvidence {
  provider: 'youtube';
  videoId: string;
  url: string;
  title: string;
  creator: string;
  description: string;
  captions: string | null;
  acquiredAt: string;
  method: 'description' | 'captions' | 'manual';
}
export interface RecipeImportDraft {
  recipe: Recipe;
  source: RecipeSourceEvidence;
  warnings: string[];
}
export interface RecipeImportError {
  error: { code: string; message: string; recoverable: boolean; };
}
export interface ImportCapabilities {
  available: boolean;
  captions: boolean;
  reviewRequired: true;
  estimatesNutrition: false;
}
