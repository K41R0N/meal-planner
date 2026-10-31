# Evals register

Updated October 28, 2026. An eval answers one question about whether Mealbook is being built right, with a fixed method and a threshold set before results are seen. Checks (CI) keep known behavior from breaking; evals measure whether the product meets the gates of [the roadmap's stages](../operating/milestones.md). The [operating loops](../operating/README.md) say when each runs.

## Rules

1. **Predeclare.** Thresholds are written into the eval's plan or epic before the first scored run. Changing one after seeing results needs a dated decision explaining why.
2. **Report denominators.** Every result states the sample size, abstentions or exclusions, the commit SHA, the command or protocol and the date. A percentage without its denominator is not a result.
3. **Append, never rewrite.** Results go to `docs/evals/results/YYYY-MM-DD-<eval-id>.md` (or `.json` from a script). Corrections are new files that reference the old one.
4. **Regressions are bugs.** A result below threshold on a shipped capability opens a `type:bug` + `regression` issue.
5. **Simulations are not evals.** LLM or persona judgments may pre-screen drafts; they never count as evidence for a gate.

## Register

| ID | Question | Kind | How to run | Threshold | Roadmap stage | Status |
|---|---|---|---|---|---|---|
| EV-01 | Do domain, storage and import invariants still hold? | Check | `pnpm test` (CI) | 100% pass | Every PR | Active: 95/95 on 2026-10-31 |
| EV-02 | How complete and attributable is the recipe library's data? | Measure | `pnpm eval:coverage` | Descriptive until the Stage 1 plan sets targets | S1 | Baseline: [2026-10-28 at `39b1916`](results/2026-10-28-ev-02-library-coverage-r2.json) (corrects [the first file](results/2026-10-28-ev-02-library-coverage.json), which recorded a commit without the script; counts identical) |
| EV-03 | Does the core loop, including backup export and restore, work in a real browser? | Check | `pnpm test:e2e` after `pnpm build` (CI) | Pass | S0 | Active: [8/8 on 2026-10-31 at `aef8360`](results/2026-10-31-ev-03-core-loop.md) |
| EV-04 | Does import reproduce the source faithfully? | Eval | Held-out source set + scorer | Set in the Stage 1 plan | S1 | Planned |
| EV-05 | Does the planner behave correctly across the roadmap's held-out week scenarios? | Eval | Scenario suite under `tests/` | All scenarios pass | S2 | Partial: existing batch-planning tests |
| EV-06 | Do the app and agent tools change the same records safely? | Eval | Agent plan acceptance examples AE1–AE5 | All pass | S3A | Planned |
| EV-07 | Is the interface accessible and fast enough on a phone? | Measure | Axe + lab LCP on the production build | 0 serious violations; LCP target set in its issue | Any UI change | Single lab run on record: 0 serious, phone LCP 3,428 ms |
| EV-08 | Does the owner get a useful week from the real app? | Study (n = 1) | Weekly entry in the operating log | Trend, not threshold | None (weekly loop) | Planned |
| EV-09 | What does public evidence say about the target jobs? | Study | Evidence ledger coding ([methods](../growth/README.md)) | None; informs, never gates | None (optional method) | Not started |
| EV-10 | Can supervised pilot users reach a usable second week? | Study | Moderated sessions with screened participants | Set in the Stage 2 plan | S2 | Planned |
| EV-11 | Do pilot participants repeat, pay and renew? | Study | Pilot cohort tracking | 20 / 12 / 8 / 5 of 30 | S4 | Planned |

A *useful week* means a confirmed plan, meaningful shopping activity and at least one completed cooking session. Actual eating is tracked separately and is not required (see [go-to-market](../commercial/go-to-market.md)).

## EV-08 dogfood log format

One entry per week in the weekly review: week start date; useful week (yes/no, and which of plan, shop, cook happened); number of recipes imported or corrected and minutes spent correcting; a non-personal summary of the moment of most friction; a non-personal summary of anything the app got wrong. The operating log is a public issue: no personal plans, targets, preferences, shopping contents or food and intake logs. This is `operator` evidence with n = 1. It finds problems fast; it does not show that anyone else has them.
