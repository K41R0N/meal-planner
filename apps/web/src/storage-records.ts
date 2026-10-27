export interface StorageRecord {
  state: unknown;
  savedAt: number;
}
interface Envelope {
  format: 'mealbook-private-v2';
  savedAt: number;
  state: unknown;
}
const record = (input: unknown): StorageRecord => {
  if (
    input &&
    typeof input === 'object' &&
    'format' in input &&
    input.format === 'mealbook-private-v2'
  ) {
    const value = input as Envelope;
    if (!Number.isSafeInteger(value.savedAt) || value.savedAt < 0 || !('state' in value))
      throw new Error('The private book copy is damaged. Restore a backup; it has not been reset.');
    return { state: value.state, savedAt: value.savedAt };
  }
  return { state: input, savedAt: 0 };
};
export function wrapStorageRecord(state: unknown, savedAt: number): Envelope {
  return { format: 'mealbook-private-v2', savedAt, state };
}
export function selectStorageRecord(
  indexed: unknown,
  fallbackText: string | null,
): StorageRecord | null {
  const primary = indexed === null || indexed === undefined ? null : record(indexed);
  let fallback: StorageRecord | null = null;
  if (fallbackText !== null) {
    try {
      fallback = record(JSON.parse(fallbackText));
    } catch {
      if (!primary)
        throw new Error(
          'The saved book copy could not be read. Restore a JSON backup; your data has not been reset.',
        );
    }
  }
  if (!primary) return fallback;
  if (!fallback || primary.savedAt >= fallback.savedAt) return primary;
  return fallback;
}
