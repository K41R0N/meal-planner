# Evals register

Updated October 28, 2026. An eval answers one question about whether Mealbook is being built right, with a fixed method and a threshold set before results are seen. Checks (CI) keep known behavior from breaking; evals measure whether the product does what [STRATEGY.md](../../STRATEGY.md) and [the milestones](../operating/milestones.md) claim. The [operating loops](../operating/README.md) say when each runs.

## Rules

1. **Predeclare.** Thresholds are written into the eval's plan or epic before the first scored run. Changing one after seeing results needs a dated decision explaining why.
2. **Report denominators.** Every result states the sample size, abstentions or exclusions, the commit SHA, the command or protocol and the date. A percentage without its denominator is not a result.
3. **Append, never rewrite.** Results go to `docs/evals/results/YYYY-MM-DD-<eval-id>.md` (or `.json` from a script). Corrections are new files that reference the old one.
4. **Regressions are bugs.** A result below threshold on a shipped capability opens a `type:bug` + `regression` issue.
5. **Simulations are not evals.** LLM or persona judgments may pre-screen drafts; they never count as evidence for a gate.

## Register

| ID | Question | Kind | How to run | Threshold | Gate | Status |
|---|---|---|---|---|---|---|
| EV-01 | Do domain, storage and import invariants still hold? | Check | `pnpm test` (CI) | 100% pass | Every PR | Active: 87/87 on 2026-10-27 |
| EV-02 | How complete and attributable is the recipe library's data? | Measure | `pnpm eval:coverage` | Descriptive until M2's plan sets targets | M2 | Baseline: [2026-10-28](results/2026-10-28-ev-02-library-coverage.json) |
| EV-03 | Does the core loop work in a real browser? | Check | Browser smoke test in CI | Pass | M0 | Planned |
| EV-04 | Does import reproduce the source faithfully? | Eval | Held-out source set + scorer | Set in M2 plan | M2 | Planned |
| EV-05 | Does the planner behave correctly across hard week scenarios? | Eval | Scenario suite under `tests/` | All scenarios pass | M3 | Partial: existing batch-planning tests |
| EV-06 | Do the app and agent tools change the same records safely? | Eval | AE1–AE5 automated | All pass | M4 | Planned |
| EV-07 | Is the interface accessible and fast enough on a phone? | Measure | Axe + lab LCP on the production build | 0 serious violations; LCP target set in its issue | Each UI milestone | Single lab run on record: 0 serious, phone LCP 3,428 ms |
| EV-08 | Does the owner get a useful week from the real app? | Study (n = 1) | Weekly log in the operating-log issue | Trend, not threshold | M0, M3 | Planned |
| EV-09 | Does public evidence support the target job? | Study | Evidence ledger coding | Set at M1 kickoff | M1 | Planned |
| EV-10 | Can screened people reach a usable first week unaided? | Study | Moderated task sessions | Set at M3 kickoff | M3 | Planned |
| EV-11 | Do pilot participants repeat, pay and renew? | Study | Pilot cohort tracking | 20 / 12 / 8 / 5 of 30 | M6 | Planned |

A *useful week* means a confirmed plan, meaningful shopping activity and at least one completed cooking session. Actual eating is tracked separately and is not required (see [go-to-market](../commercial/go-to-market.md)).

## EV-08 dogfood log format

One entry per week in the weekly review: week start date; useful week (yes/no, and which of plan, shop, cook happened); recipes imported or corrected and minutes spent correcting; the moment of most friction; anything the app got wrong. This is `operator` evidence with n = 1. It finds problems fast; it does not show that anyone else has them.
