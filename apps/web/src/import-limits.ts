export const MAX_RECIPE_JSON_BYTES = 32 * 1024 * 1024;
export const RECIPE_JSON_SIZE_MESSAGE = 'Choose a JSON file no larger than 32 MB.';
export function recipeJsonFileFits(size:number):boolean {
  return Number.isFinite(size)&&size>=0&&size<=MAX_RECIPE_JSON_BYTES;
}
