# Working on Mealbook

Read `docs/README.md`, `PRODUCT.md`, `STRATEGY.md`, `DESIGN.md` and `docs/decisions/README.md` before proposing a feature. `PRODUCT.md` describes the delivered personal app; the commercial roadmap and architecture documents contain future proposals, not implemented services or deployment authorization.

## Preserve the actual product

Today is the default opening action. Recipes have a shared cross-platform card identity. Keep planning, cooking, prepared food, shopping and actual eating separate. Historical prepared-food and nutrition snapshots must not change after recipe edits. Preserve unknown nutrition/quantities and version-one backup compatibility. The user controls labels and organization; no invented medical, allergy or storage-safety conclusions.

Use `apps/web/` for the active client and `packages/meal-domain/` for reusable deterministic logic. `src/` and `legacy/` retain the original prototype. Source acquisition and the existing extraction adapter are in `server/`. The private `pip-decks-app` repository is not a dependency and purchased deck content/artwork must not be copied.

The October 27 agent-friendly direction is documented in `docs/architecture/agents/README.md` and `docs/reference/agents/tool-contract.md`. Users' assistants supply reasoning; Mealbook owns evidence, quantities, records and action control. Do not implement a disconnected MCP database, imply remote access to private IndexedDB, collect provider model keys or hide mutations as read tools. Real app/UI/MCP parity, scoped authorization, exact approvals, revisions and idempotency precede agent writes. These documents and their future plan do not authorize code implementation or publication by themselves.

## Keep evidence and approvals distinct

New decisions belong in `docs/decisions/README.md` with date, status, rationale and owning contract. Research belongs in `docs/research/`, with URLs, observation date and clear documented/untested/unknown labels. Do not infer competitors' private stacks or paid adoption from downloads, ratings or pricing.

A user-owned recipe is not a public catalog license. Review `docs/reference/provenance-and-licenses.md` before adding assets, seed content or exports to a release. Keep secrets, cookies, personal state, backups, private deck assets and raw restricted font binaries out of Git. Runtime credentials are server-only; `.env.example` is not loaded automatically.

## Tracker, milestones and loops

GitHub Issues on `K41R0N/meal-planner` is the project tracker. Work happens against an issue in a milestone; read `docs/operating/README.md` for the issue contract, labels, work-in-progress limit and the four loops (unit, weekly review, gate review, strategy check), and `docs/operating/milestones.md` for each milestone's gate and kill/pivot rule. Measure against `docs/evals/README.md`; gather market evidence by `docs/growth/README.md`. Labels and milestones are defined in `.github/pm/board.json`; change them there, not by hand. The repository is public: issues and comments carry no personal data, credentials or private reference-repository content.

## Scope, checks and release

Use the installed Compound Engineering guidance for scoped plans and evidence-based reviews; use Impeccable/Awwwards/Jury and Vercel guidance where relevant. Do not claim a native tool/model run that did not succeed. Retain non-obvious solved lessons only when their owning documents/code do not already preserve the reasoning.

Run `pnpm docs:check`, `pnpm typecheck`, `pnpm test` and `pnpm build` for affected first-party changes. Validate portable exports with the command in `tools/recipe-import/README.md`. Do not reformat vendored tools or preserved legacy sources unnecessarily.

The central repository is `K41R0N/meal-planner`. A main push can trigger Netlify. The owner's October 27 instruction explicitly authorizes pushing the complete existing source bundle to main, superseding the earlier source-integration hold. Use a normal non-force push and the `[skip netlify]` marker in the last commit of the push (D014: `[skip ci]` also suppresses the GitHub Actions checks); read `docs/release/source-integration.md` for the current authority. Do not activate billing, provision providers, initiate app publication, change deployment settings, run campaigns or install/host inference merely because a proposed roadmap mentions them.
