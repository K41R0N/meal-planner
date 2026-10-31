import type { AppState, ConsumptionEntry, MealType, Nutrition, Recipe } from './types';
import type {
  BatchPlanRequest,
  CookingSession,
  FoodStorage,
  RecipeProfile,
  SwapRequest,
} from './experience-types';

/**
 * Every durable change to a person's food record, as data. Web, Android, a local
 * assistant bridge and a future sync service send these instead of changing state
 * themselves. IDs of records the caller refers to later are supplied by the caller.
 */
export type ApplicationCommand =
  | { type: 'today.setSlot'; slot: MealType }
  | { type: 'today.choose'; recipeId: string; batchId?: string; useId?: string }
  | { type: 'today.next' }
  | {
      type: 'cook.start';
      sessionId: string;
      recipeId: string;
      sourceServings: number;
      sourceYield?: number;
      weekId?: string;
      choiceId?: string;
      /** Cook an extra batch outside the week; needs `intentId` for its shopping intent. */
      extraBatch?: boolean;
      intentId?: string;
    }
  | {
      type: 'cook.update';
      sessionId: string;
      patch: Partial<Pick<CookingSession, 'stepIndex' | 'checkedIngredientIds' | 'timers'>>;
    }
  | {
      type: 'cook.finish';
      sessionId: string;
      batchId: string;
      actualYield: number;
      yieldUnit: string;
      storage: FoodStorage;
      storageNotes: string;
      reheatNotes: string;
      preparedSourceServings?: number;
      elapsedMinutes?: number | null;
      rememberTiming?: boolean;
    }
  | {
      type: 'food.consume';
      logId: string;
      batchId: string;
      units: number;
      date: string;
      useId?: string | null;
    }
  | { type: 'food.undo'; logId: string }
  | { type: 'recipe.add'; recipe: Recipe }
  | { type: 'recipe.update'; recipe: Recipe; nutritionConfirmed?: boolean }
  | { type: 'recipe.setProfile'; recipeId: string; profile: RecipeProfile }
  /** Adds the recipes, replacing book recipes with the same IDs. Snapshots are never changed. */
  | { type: 'recipe.import'; recipes: Recipe[] }
  | {
      type: 'week.addRecipe';
      /** Used only when there is no active week to add to. */
      newWeekId: string;
      recipeId: string;
      sourceServings: number;
      portions: number;
    }
  | { type: 'week.propose'; weekId: string; request: BatchPlanRequest }
  | { type: 'week.select'; weekId: string }
  | { type: 'week.confirm' }
  | { type: 'week.reroll' }
  | { type: 'week.lockChoice'; choiceId: string; locked: boolean }
  | { type: 'week.changePortions'; choiceId: string; portions: number }
  | { type: 'week.moveUse'; useId: string; date: string; slot: MealType }
  | { type: 'week.skipUse'; useId: string; skipped: boolean }
  | {
      type: 'week.moveWindow';
      windowId: string;
      date: string;
      startTime: string;
      availableMinutes: number;
    }
  | { type: 'week.swap'; request: SwapRequest }
  | {
      type: 'shop.addRecipe';
      intentId: string;
      recipeId: string;
      sourceServings: number;
      sourceYield?: number;
    }
  | { type: 'shop.removeIntent'; intentId: string }
  | {
      type: 'shop.cover';
      purchaseId: string;
      itemKey: string;
      kind: 'owned' | 'bought' | 'clear';
      quantity?: number;
    }
  | {
      type: 'shop.match';
      matchId: string;
      names: string[];
      purchaseName: string;
      prepNote: string;
    }
  | { type: 'shop.setAisle'; itemKey: string; aisle: string }
  | { type: 'shop.addManual'; itemId: string; name: string; quantityText: string }
  | { type: 'shop.toggleManual'; itemId: string }
  | { type: 'shop.removeManual'; itemId: string }
  | { type: 'log.addRecipe'; logId: string; recipeId: string; servings: number; date: string }
  | { type: 'log.addManual'; entry: ConsumptionEntry }
  | { type: 'targets.set'; targets: Nutrition };

export type CommandType = ApplicationCommand['type'];
export type CommandOf<T extends CommandType> = Extract<ApplicationCommand, { type: T }>;

/** What a command tells its caller beyond the new state. Commands not listed return `{}`. */
export interface CommandResults {
  'cook.start': { sessionId: string; resumed: boolean };
  'cook.finish': { batchId: string | null; alreadyFinished: boolean };
  'food.consume': { logId: string };
  'food.undo': { logId: string; linkedToBatch: boolean };
  'recipe.update': { nutritionReset: boolean };
  'recipe.import': { added: number; replaced: number };
  'week.addRecipe': { weekId: string };
  'week.propose': { weekId: string };
  'shop.addRecipe': { alreadyInWeek: boolean };
  'log.addRecipe': { logId: string };
  'log.addManual': { logId: string; duplicate: boolean };
}
export type EmptyResult = Record<string, never>;
export type ResultOf<T extends CommandType> = T extends keyof CommandResults
  ? CommandResults[T]
  : EmptyResult;

export interface CommandContext {
  /** The caller's local calendar date (YYYY-MM-DD); "today" for Today and reservations. */
  date: string;
}

export interface CommandEnvelope<C extends ApplicationCommand = ApplicationCommand> {
  /** Caller-chosen key. Repeating it with the same command returns the first result. */
  operationId: string;
  command: C;
  context: CommandContext;
  /** When set, the command is rejected unless the snapshot is still at this revision. */
  baseRevision?: number;
}

export interface LedgerEntry {
  operationId: string;
  fingerprint: string;
  type: CommandType;
  revision: number;
  result: unknown;
}

/** Recent applied operations, oldest first. Kept beside the state, never inside backups. */
export interface OperationLedger {
  entries: LedgerEntry[];
}

export interface ApplicationSnapshot {
  state: AppState;
  ledger: OperationLedger;
  /** Increases by one for every applied command. */
  revision: number;
}

export interface CommandOutcome<C extends ApplicationCommand = ApplicationCommand> {
  operationId: string;
  status: 'applied' | 'replayed';
  /** Snapshot revision after the operation was first applied. */
  revision: number;
  result: ResultOf<C['type']>;
}

export type ApplicationErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'CONFLICT'
  | 'OPERATION_KEY_REUSED'
  | 'NOT_READY';

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;
  constructor(code: ApplicationErrorCode, message: string) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
  }
}
