# Personal data and Android boundary

This version has one local profile. It has no workspace/organization switcher, account records, roles, cloud database or multi-user routing. Shared recipe facts are a bundled versioned seed; the active recipe bank and personal edits live in local device storage.

The production web client uses IndexedDB and offline app-asset caching. The shared TypeScript domain has no React, browser database, or network dependency. A future Expo/React Native client can use the same recipe/planning/nutrition contracts with an expo-sqlite repository adapter; it should use structured SQLite tables and migrations, not a single last-position key. No APK or on-device inference support is claimed in this version.

## Recipe facts

Keep stable source IDs and dated source view counts. Display ingredients and instruction gaps. Source-reported nutrition and normalized per-serving nutrition are different fields. Unknown values are null. Establish the basis before using values in calorie/macro totals; do not silently treat whole-recipe or unspecified reported values as one serving. Consumption entries hold historical nutrition snapshots rather than re-reading a mutable recipe.

The original 16 recipe IDs and 3 condiment IDs are namespaced with `legacy:` in the new bank so they cannot collide with `youtube:` IDs. The original source JSON remains intact in `src/data/recipes.json`. Legacy tags are retained as user-source labels, not verified nutrition or medical claims.

## Shopping arithmetic

Planned servings and recipe yield determine the multiplier. Missing yield and ambiguous amounts require review. Aggregate compatible units only; do not infer ingredient-specific cups-to-grams factors, raw-to-cooked equivalence or pack sizes. Keep recipe contributors available to explain each grocery total.

## Optional organization adapter

Ollaya/Laya is the researched candidate for a private decision service. It is not running or installed as part of this version. A future adapter should receive recipe facts and a user-defined taxonomy, propose bounded labels, and return scores, model revision and taxonomy version. Store proposed/accepted/edited/rejected state; user edits win. Core viewing, searching, planning and shopping must continue without the service.

A decision response is not proof of a label's truth. No model may invent nutrition, ingredient weights, allergen guarantees or storage safety. Food storage notes require a reviewed source or explicit user input. A seven-day calendar does not imply seven-day refrigerator storage.

## Backups and publication

Exported personal backups contain recipe edits, plans, targets, shopping state and food logs. They are private documents and must not enter the public Git repository. Moving to another origin or clearing browser data can lose access to local state; export before moving and restore deliberately.

The current GitHub meal-planner repository is public. The private Storyteller Tactics repository contains purchased deck content and remains separate. The Manus project is a Preview/build mirror, not an authorization to overwrite the existing deployment. Native app signing keys and passwords are never source files.
