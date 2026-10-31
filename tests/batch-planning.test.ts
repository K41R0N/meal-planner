import assert from 'node:assert/strict';
import test from 'node:test';
import { batchPlanning } from '../packages/meal-domain/src/batch-planner.ts';
import {
  defaultFilters,
  emptyNutrition,
  type AppState,
  type Recipe,
} from '../packages/meal-domain/src/types.ts';
import type {
  BatchPlanRequest,
  ExperienceState,
  RecipeProfile,
} from '../packages/meal-domain/src/experience-types.ts';

const recipe = (id: string, roles: Recipe['roles'] = ['dinner']): Recipe => ({
  id,
  name: id,
  roles,
  tags: [],
  categories: [],
  ingredients: [
    {
      id: `${id}:rice`,
      name: 'Rice',
      quantity: 100,
      unit: 'g',
      quantityText: '100 g',
      aisle: 'Pantry',
    },
  ],
  steps: ['Cook.'],
  baseServings: 2,
  nutrition: emptyNutrition(),
  reportedNutrition: emptyNutrition(),
  nutritionBasis: 'not_stated',
  sourceUrl: null,
  sourceName: 'Test kitchen',
  creatorCredit: null,
  viewCount: null,
  viewCountAt: null,
  image: null,
  prepMinutes: null,
  cookMinutes: null,
  mealPrepRating: null,
  mealPrepNotes: '',
  dataGaps: [],
  favorite: false,
  addedAt: '2026-10-26T00:00:00.000Z',
});

const profile = (overrides: Partial<RecipeProfile> = {}): RecipeProfile => ({
  yieldUnit: 'bowl',
  sourceUnitsPerPortion: 2,
  portionSizeConfirmed: true,
  activeMinutes: 10,
  elapsedMinutes: 25,
  reheatMinutes: null,
  equipment: ['oven'],
  equipmentConfirmed: true,
  reheatNotes: '',
  notes: '',
  ...overrides,
});

const experience = (profiles: Record<string, RecipeProfile>): ExperienceState => ({
  version: 1,
  dailyChoices: [],
  sessions: [],
  batches: [],
  weeks: [],
  activeWeekId: null,
  oneOffs: [],
  recipeProfiles: profiles,
  purchaseMatches: [],
  groceryCoverage: {},
  purchases: [],
  manualItems: [],
  lastPlanRequest: null,
  groceryChanges: {},
  aisleOverrides: {},
  preferredSlot: 'dinner',
});

const state = (recipes: Recipe[], profiles: Record<string, RecipeProfile>): AppState => ({
  version: 1,
  recipes,
  plans: [],
  activePlanId: null,
  logs: [],
  targets: emptyNutrition(),
  shoppingChecks: {},
  manualShopping: {},
  experience: experience(profiles),
});

test('proposeWeek creates an exact, sparse batch draft with profile source-unit scaling and confirmed sequential timing', () => {
  const dinner = recipe('favorite-dinner');
  dinner.favorite = true;
  dinner.baseServings = 6;
  const app = state([dinner], { [dinner.id]: profile() });
  const week = batchPlanning.proposeWeek(
    app,
    {
      weekStart: '2026-10-26',
      days: 2,
      people: 2,
      slots: ['dinner'],
      distinctRecipes: 1,
      targetPortions: 3,
      windows: [{ id: 'sun', date: '2026-10-26', startTime: '18:00', availableMinutes: 30 }],
      filters: { ...defaultFilters(), favoritesOnly: true },
      strictTiming: true,
      reuseReady: false,
      reuseOneOffs: false,
    },
    'week-1',
  );

  assert.equal(week.id, 'week-1');
  assert.equal(week.choices.length, 1);
  assert.equal(
    week.uses.length,
    2,
    'a proposal is editable and sparse rather than a mandatory full calendar',
  );
  assert.deepEqual(
    {
      recipeId: week.choices[0].recipeId,
      portions: week.choices[0].portions,
      sourceServings: week.choices[0].sourceServings,
      timingFit: week.choices[0].timingFit,
      windowId: week.choices[0].windowId,
    },
    {
      recipeId: 'favorite-dinner',
      portions: 3,
      sourceServings: 6,
      timingFit: 'confirmed',
      windowId: 'sun',
    },
  );
  assert.deepEqual(
    week.uses.map((use) => ({ date: use.date, slot: use.slot, portions: use.portions })),
    [
      { date: '2026-10-26', slot: 'dinner', portions: 2 },
      { date: '2026-10-27', slot: 'dinner', portions: 1 },
    ],
  );
});

test('strict timing never treats missing data as zero and edits preserve immutable unrelated choices', () => {
  const known = recipe('known');
  const unknown = recipe('unknown');
  const app = state([known, unknown], {
    [known.id]: profile(),
    [unknown.id]: profile({ elapsedMinutes: null }),
  });
  assert.throws(
    () =>
      batchPlanning.proposeWeek(
        app,
        {
          weekStart: '2026-10-26',
          days: 2,
          people: 1,
          slots: ['dinner'],
          distinctRecipes: 2,
          targetPortions: 2,
          windows: [{ id: 'w', date: '2026-10-26', startTime: '18:00', availableMinutes: 40 }],
          filters: defaultFilters(),
          strictTiming: true,
          reuseReady: false,
          reuseOneOffs: false,
        },
        'strict',
      ),
    /timing|confirmed|eligible/i,
  );

  const week = batchPlanning.proposeWeek(
    app,
    {
      weekStart: '2026-10-26',
      days: 1,
      people: 1,
      slots: ['dinner'],
      distinctRecipes: 1,
      targetPortions: 2,
      windows: [{ id: 'w', date: '2026-10-26', startTime: '18:00', availableMinutes: 40 }],
      filters: defaultFilters(),
      strictTiming: false,
      reuseReady: false,
      reuseOneOffs: false,
    },
    'editable',
  );
  const changed = batchPlanning.changePortions(app, week, week.choices[0].id, 4);
  assert.equal(changed.choices[0].portions, 4);
  assert.equal(
    changed.choices[0].timingFit,
    'unknown',
    'scaled quantities need a fresh timing confirmation',
  );
  assert.equal(week.choices[0].portions, 2, 'the original saved draft is not mutated');
  assert.throws(
    () => batchPlanning.changeUse(app, week, week.uses[0].id, { date: '2026-11-01' }),
    /range/i,
  );
});

/** A frozen ready batch with 6 portions left and one saved use on 2026-10-27 that reserves a portion. */
const readyReuseFixture = () => {
  const dinner = recipe('ready-dinner');
  const other = recipe('other-dinner');
  const app = state([dinner, other], { [dinner.id]: profile(), [other.id]: profile() });
  app.logs = [
    {
      id: 'ate',
      date: '2026-10-25',
      recipeId: dinner.id,
      name: dinner.name,
      servings: 1,
      nutritionSnapshot: emptyNutrition(),
      createdAt: '2026-10-25T00:00:00.000Z',
      batchId: 'batch-1',
      batchUnits: 2,
    },
  ];
  app.experience!.batches = [
    {
      id: 'batch-1',
      sessionId: 'session-1',
      recipeId: dinner.id,
      recipeSnapshot: dinner,
      preparedSourceServings: 16,
      actualYield: 8,
      yieldUnit: 'bowl',
      nutritionPerUnit: emptyNutrition(),
      madeAt: '2026-10-25T00:00:00.000Z',
      storage: 'freezer',
      storageNotes: '',
      reheatNotes: '',
      weekId: null,
      choiceId: null,
    },
  ];
  app.experience!.weeks = [
    {
      id: 'saved',
      label: 'Saved',
      weekStart: '2026-10-27',
      days: 1,
      people: 1,
      slots: ['dinner'],
      windows: [],
      choices: [
        {
          id: 'saved-choice',
          recipeId: dinner.id,
          sourceServings: 2,
          portions: 1,
          sourceUnitsPerPortion: 2,
          windowId: null,
          locked: false,
          readyBatchId: 'batch-1',
          reuseReady: true,
          shoppingIntentId: null,
          explanations: [],
          timingFit: 'unknown',
        },
      ],
      uses: [
        {
          id: 'saved-use',
          choiceId: 'saved-choice',
          date: '2026-10-27',
          slot: 'dinner',
          portions: 1,
          locked: false,
          skipped: false,
        },
      ],
      confirmed: true,
      createdAt: '2026-10-25T00:00:00.000Z',
      legacyPlanId: null,
    },
  ];
  const request: BatchPlanRequest = {
    weekStart: '2026-10-26',
    days: 1,
    people: 1,
    slots: ['dinner'],
    distinctRecipes: 1,
    targetPortions: 6,
    windows: [],
    filters: { ...defaultFilters(), search: 'ready-dinner' },
    strictTiming: false,
    reuseReady: true,
    reuseOneOffs: false,
  };
  return { app, request, dinner, other };
};

test('ready reuse uses immutable batch yield arithmetic, respects saved allocations, and protected choices survive reroll', (t) => {
  // Saved uses reserve ready food only from today on, so pin the clock to the fixture's dates.
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-27T12:00:00.000Z') });
  const { app, request, dinner, other } = readyReuseFixture();
  const proposed = batchPlanning.proposeWeek(app, request, 'ready-week');
  const ready = proposed.choices[0];
  assert.deepEqual(
    {
      portions: ready.portions,
      sourceServings: ready.sourceServings,
      readyBatchId: ready.readyBatchId,
      reuseReady: ready.reuseReady,
    },
    { portions: 5, sourceServings: 10, readyBatchId: 'batch-1', reuseReady: true },
  );
  assert.match(ready.explanations.join(' '), /uncovered|Frozen/i);
  assert.throws(
    () =>
      batchPlanning.swap(app, proposed, {
        scope: 'batch',
        weekId: proposed.id,
        targetId: ready.id,
        recipeId: other.id,
      }),
    /cooked|ready/i,
  );

  const locked = {
    ...proposed,
    choices: proposed.choices.map((choice) => ({ ...choice, locked: true })),
  };
  const rerolled = batchPlanning.rerollWeek(app, locked, {
    ...request,
    filters: { ...defaultFilters(), search: 'other-dinner' },
  });
  assert.equal(
    rerolled.choices[0].recipeId,
    dinner.id,
    'a locked choice is preserved even if a new reroll filter would exclude it',
  );
});

test('a saved use reserves ready food through the end of the local day, not the UTC day', (t) => {
  const previousTz = process.env.TZ;
  t.after(() => {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  });
  const readyPortions = (timeZone: string, instant: string): number => {
    process.env.TZ = timeZone;
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(instant) });
    const { app, request } = readyReuseFixture();
    const portions = batchPlanning.proposeWeek(app, request, 'boundary-week').choices[0].portions;
    t.mock.timers.reset();
    return portions;
  };
  // 23:30 on 27 October in New York is already 28 October in UTC; tonight's use still reserves.
  assert.equal(readyPortions('America/New_York', '2026-10-28T03:30:00.000Z'), 5);
  // 00:30 on 28 October in Tokyo is still 27 October in UTC; yesterday's use no longer reserves.
  assert.equal(readyPortions('Asia/Tokyo', '2026-10-27T15:30:00.000Z'), 6);
});

test('integral targets are apportioned as whole portions and scheduled in people-sized repeated uses', () => {
  const recipes = ['a', 'b', 'c'].map((id) => recipe(id));
  const app = state(
    recipes,
    Object.fromEntries(
      recipes.map((item) => [item.id, profile({ sourceUnitsPerPortion: 1, elapsedMinutes: null })]),
    ),
  );
  const planned = batchPlanning.proposeWeek(
    app,
    {
      weekStart: '2026-10-26',
      days: 7,
      people: 1,
      slots: ['dinner'],
      distinctRecipes: 3,
      targetPortions: 10,
      windows: [],
      filters: defaultFilters(),
      strictTiming: false,
      reuseReady: false,
      reuseOneOffs: false,
    },
    'whole-target',
  );

  assert.deepEqual(
    planned.choices.map((choice) => choice.portions).sort((left, right) => left - right),
    [3, 3, 4],
  );
  assert.ok(
    planned.uses.every((use) => use.portions <= 1),
    'one person never receives a giant batch as one meal',
  );
  assert.equal(
    new Set(planned.uses.map((use) => `${use.date}|${use.slot}`)).size,
    planned.uses.length,
  );
  assert.equal(
    planned.uses.reduce((sum, use) => sum + use.portions, 0),
    7,
    'the finite dated slots are used before food is left unassigned',
  );
  assert.match(
    planned.choices.map((choice) => choice.explanations.join(' ')).join(' '),
    /unassigned|later allocation/i,
  );
});

test('ready reuse translates actual yield through source units, reserves only future active allocations, and needs no new cooking window', () => {
  const dinner = recipe('ready-scaled');
  const app = state([dinner], {
    [dinner.id]: profile({
      sourceUnitsPerPortion: 6,
      elapsedMinutes: null,
      activeMinutes: null,
      equipmentConfirmed: false,
    }),
  });
  app.logs = [
    {
      id: 'already-eaten',
      date: '2026-10-25',
      recipeId: dinner.id,
      name: dinner.name,
      servings: 2,
      nutritionSnapshot: emptyNutrition(),
      createdAt: '2026-10-25T00:00:00.000Z',
      batchId: 'batch-scaled',
      batchUnits: 2,
    },
  ];
  app.experience!.batches = [
    {
      id: 'batch-scaled',
      sessionId: 'session-scaled',
      recipeId: dinner.id,
      recipeSnapshot: dinner,
      preparedSourceServings: 24,
      actualYield: 8,
      yieldUnit: 'bowl',
      nutritionPerUnit: emptyNutrition(),
      madeAt: '2026-10-25T00:00:00.000Z',
      storage: 'fridge',
      storageNotes: '',
      reheatNotes: '',
      weekId: null,
      choiceId: null,
    },
  ];
  app.experience!.weeks = [
    {
      id: 'past',
      label: 'Past',
      weekStart: '2000-01-01',
      days: 1,
      people: 1,
      slots: ['dinner'],
      windows: [],
      choices: [
        {
          id: 'past-choice',
          recipeId: dinner.id,
          sourceServings: 6,
          portions: 1,
          sourceUnitsPerPortion: 6,
          windowId: null,
          locked: false,
          readyBatchId: 'batch-scaled',
          reuseReady: true,
          shoppingIntentId: null,
          explanations: [],
          timingFit: 'unknown',
        },
      ],
      uses: [
        {
          id: 'past-use',
          choiceId: 'past-choice',
          date: '2000-01-01',
          slot: 'dinner',
          portions: 1,
          locked: false,
          skipped: false,
        },
      ],
      confirmed: true,
      createdAt: '2026-10-25T00:00:00.000Z',
      legacyPlanId: null,
    },
    {
      id: 'future',
      label: 'Future',
      weekStart: '2099-01-01',
      days: 1,
      people: 1,
      slots: ['dinner'],
      windows: [],
      choices: [
        {
          id: 'future-choice',
          recipeId: dinner.id,
          sourceServings: 6,
          portions: 1,
          sourceUnitsPerPortion: 6,
          windowId: null,
          locked: false,
          readyBatchId: 'batch-scaled',
          reuseReady: true,
          shoppingIntentId: null,
          explanations: [],
          timingFit: 'unknown',
        },
      ],
      uses: [
        {
          id: 'future-use',
          choiceId: 'future-choice',
          date: '2099-01-01',
          slot: 'dinner',
          portions: 1,
          locked: false,
          skipped: false,
        },
      ],
      confirmed: true,
      createdAt: '2026-10-25T00:00:00.000Z',
      legacyPlanId: null,
    },
  ];
  const planned = batchPlanning.proposeWeek(
    app,
    {
      weekStart: '2026-10-26',
      days: 3,
      people: 1,
      slots: ['dinner'],
      distinctRecipes: 1,
      targetPortions: 2,
      windows: [],
      filters: defaultFilters(),
      strictTiming: true,
      reuseReady: true,
      reuseOneOffs: false,
    },
    'ready-scaled-week',
  );
  const choice = planned.choices[0];
  assert.deepEqual(
    {
      portions: choice.portions,
      sourceServings: choice.sourceServings,
      sourceUnitsPerPortion: choice.sourceUnitsPerPortion,
    },
    { portions: 2, sourceServings: 12, sourceUnitsPerPortion: 6 },
  );
  assert.equal(choice.timingFit, 'unknown');
  assert.ok(choice.reuseReady);
});

test('a future use already represented by a consumption log is not reserved twice from ready food', () => {
  const dinner = recipe('consumed-reservation');
  const app = state([dinner], {
    [dinner.id]: profile({ sourceUnitsPerPortion: 6, elapsedMinutes: null }),
  });
  app.experience!.batches = [
    {
      id: 'reservation-batch',
      sessionId: 'reservation-session',
      recipeId: dinner.id,
      recipeSnapshot: dinner,
      preparedSourceServings: 24,
      actualYield: 8,
      yieldUnit: 'bowl',
      nutritionPerUnit: emptyNutrition(),
      madeAt: '2026-10-25T00:00:00.000Z',
      storage: 'fridge',
      storageNotes: '',
      reheatNotes: '',
      weekId: null,
      choiceId: null,
    },
  ];
  app.experience!.weeks = [
    {
      id: 'confirmed-future',
      label: 'Future',
      weekStart: '2099-01-01',
      days: 1,
      people: 1,
      slots: ['dinner'],
      windows: [],
      choices: [
        {
          id: 'reserved-choice',
          recipeId: dinner.id,
          sourceServings: 6,
          portions: 1,
          sourceUnitsPerPortion: 6,
          windowId: null,
          locked: false,
          readyBatchId: 'reservation-batch',
          reuseReady: true,
          shoppingIntentId: null,
          explanations: [],
          timingFit: 'unknown',
        },
      ],
      uses: [
        {
          id: 'reserved-use',
          choiceId: 'reserved-choice',
          date: '2099-01-01',
          slot: 'dinner',
          portions: 1,
          locked: false,
          skipped: false,
        },
      ],
      confirmed: true,
      createdAt: '2026-10-25T00:00:00.000Z',
      legacyPlanId: null,
    },
  ];
  app.logs = [
    {
      id: 'consumed-reserved-use',
      date: '2026-10-26',
      recipeId: dinner.id,
      name: dinner.name,
      servings: 4,
      nutritionSnapshot: emptyNutrition(),
      createdAt: '2026-10-26T00:00:00.000Z',
      batchId: 'reservation-batch',
      batchUnits: 4,
      useId: 'reserved-use',
    },
  ];
  const proposed = batchPlanning.proposeWeek(
    app,
    {
      weekStart: '2026-10-26',
      days: 2,
      people: 1,
      slots: ['dinner'],
      distinctRecipes: 1,
      targetPortions: 2,
      windows: [],
      filters: defaultFilters(),
      strictTiming: false,
      reuseReady: true,
      reuseOneOffs: false,
    },
    'after-consumption',
  );
  assert.equal(
    proposed.choices[0].portions,
    2,
    'four actual units remaining equal twelve source units or two meal portions',
  );
});

test('portion edits reallocate only editable uses and moves cannot collide or rewrite a logged meal', () => {
  const dinner = recipe('editable-dinner');
  const app = state([dinner], {
    [dinner.id]: profile({ sourceUnitsPerPortion: 1, elapsedMinutes: null }),
  });
  const planned = batchPlanning.proposeWeek(
    app,
    {
      weekStart: '2026-10-26',
      days: 2,
      people: 1,
      slots: ['dinner'],
      distinctRecipes: 1,
      targetPortions: 2,
      windows: [],
      filters: defaultFilters(),
      strictTiming: false,
      reuseReady: false,
      reuseOneOffs: false,
    },
    'editable-slots',
  );
  const expanded = batchPlanning.changePortions(app, planned, planned.choices[0].id, 3);
  assert.equal(expanded.choices[0].portions, 3);
  assert.ok(expanded.uses.every((use) => use.portions <= 1));
  assert.equal(
    expanded.uses.reduce((sum, use) => sum + use.portions, 0),
    2,
    'a change does not invent another date-slot collision',
  );
  assert.throws(
    () =>
      batchPlanning.changeUse(app, planned, planned.uses[0].id, {
        date: planned.uses[1].date,
        slot: planned.uses[1].slot,
      }),
    /already uses|collision/i,
  );
  const logged = {
    ...app,
    logs: [
      {
        id: 'logged-use',
        date: '2026-10-26',
        recipeId: dinner.id,
        name: dinner.name,
        servings: 1,
        nutritionSnapshot: emptyNutrition(),
        createdAt: '2026-10-26T00:00:00.000Z',
        useId: planned.uses[0].id,
      },
    ],
  };
  assert.throws(
    () => batchPlanning.changeUse(logged, planned, planned.uses[0].id, { skipped: true }),
    /logged|historical/i,
  );
});

test('strict timing applies only to the exact published source dose and draft add uses a usable seven-day allocation', () => {
  const dinner = recipe('dose-dinner');
  const app = state([dinner], { [dinner.id]: profile({ sourceUnitsPerPortion: 1 }) });
  assert.throws(
    () =>
      batchPlanning.proposeWeek(
        app,
        {
          weekStart: '2026-10-26',
          days: 3,
          people: 1,
          slots: ['dinner'],
          distinctRecipes: 1,
          targetPortions: 3,
          windows: [{ id: 'window', date: '2026-10-26', startTime: '18:00', availableMinutes: 30 }],
          filters: defaultFilters(),
          strictTiming: true,
          reuseReady: false,
          reuseOneOffs: false,
        },
        'scaled-strict',
      ),
    /dose|timing|confirmed/i,
  );

  const direct = batchPlanning.addRecipe(
    app,
    null,
    dinner.id,
    10,
    10,
    'direct-draft',
    '2026-10-26',
  );
  assert.equal(direct.days, 7);
  assert.equal(direct.uses.length, 7);
  assert.ok(direct.uses.every((use) => use.portions === 1));
  const historical = {
    ...direct,
    id: 'historical',
    weekStart: '2020-01-01',
    label: 'Historical',
    choices: [],
    uses: [],
  };
  const added = batchPlanning.addRecipe(app, historical, dinner.id, 2, 2, 'ignored', '2026-10-26');
  assert.equal(
    added.uses[0].date,
    '2020-01-01',
    'an old saved week picks an open date in its own range',
  );
});

test('a running session linked through its daily choice protects the underlying weekly batch from replacement', () => {
  const dinner = recipe('in-progress');
  const other = recipe('replacement');
  const app = state([dinner, other], { [dinner.id]: profile(), [other.id]: profile() });
  const planned = batchPlanning.proposeWeek(
    app,
    {
      weekStart: '2026-10-26',
      days: 1,
      people: 1,
      slots: ['dinner'],
      distinctRecipes: 1,
      targetPortions: 1,
      windows: [],
      filters: { ...defaultFilters(), search: dinner.name },
      strictTiming: false,
      reuseReady: false,
      reuseOneOffs: false,
    },
    'in-progress-week',
  );
  const choice = planned.choices[0];
  const use = planned.uses[0];
  app.experience!.dailyChoices = [
    {
      id: 'daily-choice',
      date: use.date,
      slot: use.slot,
      recipeId: dinner.id,
      origin: 'week',
      useId: use.id,
      batchId: null,
      sessionId: 'session-running',
      logId: null,
    },
  ];
  app.experience!.sessions = [
    {
      id: 'session-running',
      recipeId: dinner.id,
      recipeSnapshot: dinner,
      sourceServings: 1,
      stepIndex: 0,
      checkedIngredientIds: [],
      timers: [],
      startedAt: '2026-10-26T00:00:00.000Z',
      updatedAt: '2026-10-26T00:00:00.000Z',
      finishedAt: null,
      weekId: planned.id,
      choiceId: 'daily-choice',
    },
  ];
  assert.throws(
    () =>
      batchPlanning.swap(app, planned, {
        scope: 'batch',
        weekId: planned.id,
        targetId: choice.id,
        recipeId: other.id,
      }),
    /cooked|ready|progress/i,
  );
});

test('reroll assigns only the target remainder after retained locked portions', () => {
  const retained = recipe('retained');
  const replaceable = recipe('replaceable');
  const alternative = recipe('alternative');
  const app = state([retained, replaceable, alternative], {
    [retained.id]: profile({ sourceUnitsPerPortion: 1, elapsedMinutes: null }),
    [replaceable.id]: profile({ sourceUnitsPerPortion: 1, elapsedMinutes: null }),
    [alternative.id]: profile({ sourceUnitsPerPortion: 1, elapsedMinutes: null }),
  });
  const saved = {
    id: 'reroll-remainder',
    label: 'Reroll',
    weekStart: '2026-10-26',
    days: 5,
    people: 1,
    slots: ['dinner'] as Recipe['roles'],
    windows: [],
    choices: [
      {
        id: 'retained-choice',
        recipeId: retained.id,
        sourceServings: 7,
        portions: 7,
        sourceUnitsPerPortion: 1,
        windowId: null,
        locked: true,
        readyBatchId: null,
        reuseReady: false,
        shoppingIntentId: null,
        explanations: [],
        timingFit: 'unknown' as const,
      },
      {
        id: 'replaceable-choice',
        recipeId: replaceable.id,
        sourceServings: 3,
        portions: 3,
        sourceUnitsPerPortion: 1,
        windowId: null,
        locked: false,
        readyBatchId: null,
        reuseReady: false,
        shoppingIntentId: null,
        explanations: [],
        timingFit: 'unknown' as const,
      },
    ],
    uses: [
      {
        id: 'retained-use',
        choiceId: 'retained-choice',
        date: '2026-10-26',
        slot: 'dinner' as const,
        portions: 1,
        locked: true,
        skipped: false,
      },
      {
        id: 'replaceable-use',
        choiceId: 'replaceable-choice',
        date: '2026-10-27',
        slot: 'dinner' as const,
        portions: 1,
        locked: false,
        skipped: false,
      },
    ],
    confirmed: false,
    createdAt: '2026-10-26T00:00:00.000Z',
    legacyPlanId: null,
  };
  const rerolled = batchPlanning.rerollWeek(app, saved, {
    weekStart: saved.weekStart,
    days: saved.days,
    people: saved.people,
    slots: ['dinner'],
    distinctRecipes: 2,
    targetPortions: 10,
    windows: [],
    filters: defaultFilters(),
    strictTiming: false,
    reuseReady: false,
    reuseOneOffs: false,
  });
  assert.equal(rerolled.choices.find((choice) => choice.id === 'retained-choice')!.portions, 7);
  assert.equal(
    rerolled.choices.reduce((sum, choice) => sum + choice.portions, 0),
    10,
  );
});

test('partial future consumption reserves only the uneaten actual batch units', () => {
  const dinner = recipe('partial-reservation');
  const app = state([dinner], {
    [dinner.id]: profile({ sourceUnitsPerPortion: 6, elapsedMinutes: null }),
  });
  app.experience!.batches = [
    {
      id: 'partial-batch',
      sessionId: 'partial-session',
      recipeId: dinner.id,
      recipeSnapshot: dinner,
      preparedSourceServings: 24,
      actualYield: 8,
      yieldUnit: 'bowl',
      nutritionPerUnit: emptyNutrition(),
      madeAt: '2026-10-25T00:00:00.000Z',
      storage: 'fridge',
      storageNotes: '',
      reheatNotes: '',
      weekId: null,
      choiceId: null,
    },
  ];
  app.experience!.weeks = [
    {
      id: 'partial-future',
      label: 'Future',
      weekStart: '2099-01-01',
      days: 1,
      people: 1,
      slots: ['dinner'],
      windows: [],
      choices: [
        {
          id: 'partial-choice',
          recipeId: dinner.id,
          sourceServings: 6,
          portions: 1,
          sourceUnitsPerPortion: 6,
          windowId: null,
          locked: false,
          readyBatchId: 'partial-batch',
          reuseReady: true,
          shoppingIntentId: null,
          explanations: [],
          timingFit: 'unknown',
        },
      ],
      uses: [
        {
          id: 'partial-use',
          choiceId: 'partial-choice',
          date: '2099-01-01',
          slot: 'dinner',
          portions: 1,
          locked: false,
          skipped: false,
        },
      ],
      confirmed: true,
      createdAt: '2026-10-25T00:00:00.000Z',
      legacyPlanId: null,
    },
  ];
  app.logs = [
    {
      id: 'partial-log',
      date: '2026-10-26',
      recipeId: dinner.id,
      name: dinner.name,
      servings: 3,
      nutritionSnapshot: emptyNutrition(),
      createdAt: '2026-10-26T00:00:00.000Z',
      batchId: 'partial-batch',
      batchUnits: 1,
      useId: 'partial-use',
    },
  ];
  const proposed = batchPlanning.proposeWeek(
    app,
    {
      weekStart: '2026-10-26',
      days: 4,
      people: 1,
      slots: ['dinner'],
      distinctRecipes: 1,
      targetPortions: 4,
      windows: [],
      filters: defaultFilters(),
      strictTiming: false,
      reuseReady: true,
      reuseOneOffs: false,
    },
    'partial-proposed',
  );
  assert.equal(
    proposed.choices[0].portions,
    3,
    'six actual units remain reusable after reserving the unfinished half-meal',
  );
});

test('ready reuse requires the captured ingredients and source serving basis, but ignores cosmetic book edits', () => {
  const dinner = recipe('snapshot-compatible');
  const snapshot = {
    ...dinner,
    ingredients: dinner.ingredients.map((ingredient) => ({ ...ingredient })),
  };
  const app = state([dinner], { [dinner.id]: profile({ elapsedMinutes: null }) });
  app.experience!.batches = [
    {
      id: 'snapshot-batch',
      sessionId: 'snapshot-session',
      recipeId: dinner.id,
      recipeSnapshot: snapshot,
      preparedSourceServings: 4,
      actualYield: 2,
      yieldUnit: 'bowl',
      nutritionPerUnit: emptyNutrition(),
      madeAt: '2026-10-25T00:00:00.000Z',
      storage: 'fridge',
      storageNotes: '',
      reheatNotes: '',
      weekId: null,
      choiceId: null,
    },
  ];
  const request: BatchPlanRequest = {
    weekStart: '2026-10-26',
    days: 1,
    people: 1,
    slots: ['dinner'],
    distinctRecipes: 1,
    targetPortions: 1,
    windows: [],
    filters: defaultFilters(),
    strictTiming: false,
    reuseReady: true,
    reuseOneOffs: false,
  };
  const cosmetic = {
    ...dinner,
    tags: ['weekday'],
    favorite: true,
    mealPrepNotes: 'Updated note only.',
  };
  app.recipes = [cosmetic];
  const cosmeticsOnly = batchPlanning.proposeWeek(app, request, 'cosmetic-edit');
  assert.equal(
    cosmeticsOnly.choices[0].reuseReady,
    true,
    'non-food metadata must not strand compatible stock',
  );

  app.recipes = [
    {
      ...cosmetic,
      ingredients: [{ ...cosmetic.ingredients[0], quantity: 125, quantityText: '125 g' }],
    },
  ];
  const changedFood = batchPlanning.proposeWeek(app, request, 'ingredient-edit');
  assert.equal(changedFood.choices[0].reuseReady, false);
  assert.equal(
    changedFood.choices[0].readyBatchId,
    null,
    'the original ledger remains intact but is not relabeled as the edited recipe',
  );
});

test('partial ready food keeps the requested target by scheduling a fresh remainder and never claims scaled strict timing', () => {
  const readyRecipe = recipe('ready-one');
  const freshRecipe = recipe('fresh-five');
  const app = state([readyRecipe, freshRecipe], {
    [readyRecipe.id]: profile({ sourceUnitsPerPortion: 1 }),
    [freshRecipe.id]: profile({ sourceUnitsPerPortion: 1 }),
  });
  app.experience!.batches = [
    {
      id: 'one-ready-batch',
      sessionId: 'one-ready-session',
      recipeId: readyRecipe.id,
      recipeSnapshot: readyRecipe,
      preparedSourceServings: 1,
      actualYield: 1,
      yieldUnit: 'bowl',
      nutritionPerUnit: emptyNutrition(),
      madeAt: '2026-10-25T00:00:00.000Z',
      storage: 'fridge',
      storageNotes: '',
      reheatNotes: '',
      weekId: null,
      choiceId: null,
    },
  ];
  const request: BatchPlanRequest = {
    weekStart: '2026-10-26',
    days: 7,
    people: 1,
    slots: ['dinner'],
    distinctRecipes: 2,
    targetPortions: 10,
    windows: [],
    filters: defaultFilters(),
    strictTiming: false,
    reuseReady: true,
    reuseOneOffs: false,
  };
  const planned = batchPlanning.proposeWeek(app, request, 'partial-target');
  const readyChoices = planned.choices.filter((choice) => choice.recipeId === readyRecipe.id);
  assert.deepEqual(
    readyChoices.map((choice) => choice.portions).sort((left, right) => left - right),
    [1, 4],
  );
  assert.equal(readyChoices.filter((choice) => choice.reuseReady).length, 1);
  assert.equal(
    planned.choices.reduce((sum, choice) => sum + choice.portions, 0),
    10,
  );
  assert.equal(
    planned.choices
      .filter((choice) => !choice.reuseReady)
      .reduce((sum, choice) => sum + choice.portions, 0),
    9,
    'one ready portion plus two fresh choices covers all ten requested portions',
  );
  assert.throws(
    () =>
      batchPlanning.proposeWeek(app, { ...request, strictTiming: true }, 'partial-target-strict'),
    /dose|timing|confirmed/i,
  );
});

test('an explicit meal swap may leave saved filters and roles, and reuses sufficient compatible ready food', () => {
  const dinner = recipe('planned-dinner');
  const breakfast = recipe('ready-breakfast', ['breakfast']);
  const app = state([dinner, breakfast], {
    [dinner.id]: profile({ sourceUnitsPerPortion: 1, elapsedMinutes: null }),
    [breakfast.id]: profile({ sourceUnitsPerPortion: 1, elapsedMinutes: null }),
  });
  const week = batchPlanning.proposeWeek(
    app,
    {
      weekStart: '2026-10-26',
      days: 1,
      people: 1,
      slots: ['dinner'],
      distinctRecipes: 1,
      targetPortions: 1,
      windows: [],
      filters: { ...defaultFilters(), search: dinner.name },
      strictTiming: false,
      reuseReady: false,
      reuseOneOffs: false,
    },
    'manual-swap',
  );
  app.experience!.lastPlanRequest = {
    weekStart: week.weekStart,
    days: week.days,
    people: week.people,
    slots: [...week.slots],
    windows: [],
    distinctRecipes: 1,
    targetPortions: 1,
    filters: { ...defaultFilters(), favoritesOnly: true },
    strictTiming: false,
    reuseReady: true,
    reuseOneOffs: false,
  };
  app.experience!.batches = [
    {
      id: 'breakfast-batch',
      sessionId: 'breakfast-session',
      recipeId: breakfast.id,
      recipeSnapshot: breakfast,
      preparedSourceServings: 1,
      actualYield: 1,
      yieldUnit: 'bowl',
      nutritionPerUnit: emptyNutrition(),
      madeAt: '2026-10-25T00:00:00.000Z',
      storage: 'fridge',
      storageNotes: '',
      reheatNotes: '',
      weekId: null,
      choiceId: null,
    },
  ];
  const swapped = batchPlanning.swap(app, week, {
    scope: 'meal',
    weekId: week.id,
    targetId: week.uses[0].id,
    recipeId: breakfast.id,
  });
  const replacement = swapped.choices.find((choice) => choice.recipeId === breakfast.id)!;
  assert.equal(replacement.reuseReady, true);
  assert.equal(replacement.readyBatchId, 'breakfast-batch');
  assert.match(
    replacement.explanations.join(' '),
    /Your explicit choice is outside saved planning filters\./,
  );
  assert.match(
    replacement.explanations.join(' '),
    /explicit choice; saved recipe roles remain unchanged/i,
  );
});
