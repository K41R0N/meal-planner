# How we build Mealbook

Updated October 28, 2026. This is the operating system for turning the [commercial roadmap](../roadmap/commercial-release.md) into shipped, verified work. It decides **where work is tracked, what "done" means, which loops catch wrong turns and what evidence a decision needs**. It does not approve deployment, billing, outreach or providers; those stay with the owner under [the decision registry](../decisions/README.md).

**What versus how.** The roadmap says what gets built and in which order; GitHub milestones mirror its stages exactly ([mapping](milestones.md)). This file, the [evals register](../evals/README.md) and the [research and growth methods](../growth/README.md) say how the work is run and checked. Methods never add stages or gates to the roadmap.

## The board

GitHub Issues on `K41R0N/meal-planner` is the only tracker. The repository is public, so issues hold product and engineering content only: no personal data, credentials, private reference-repository content or third-party client material.

- **Milestones** are the roadmap's stages: S0, S1, S2, S3, S3A, S4 and S5, each with the roadmap's own gate, mapped to evals in [milestones](milestones.md). They have no dates. A milestone closes only when its gate review passes.
- **Epics** (`type:epic`) are one per milestone. The epic mirrors the gate as a checklist and parents the milestone's issues as sub-issues. Issue titles start with the milestone key, e.g. `[S1] Property test: unknown nutrition never becomes zero`; unscheduled ideas and operating work have no prefix.
- **Labels** carry type, track, status and priority. Labels and milestones are defined in [`.github/pm/board.json`](../../.github/pm/board.json) and created by the `PM board sync` workflow, so the board structure is reviewed like code. The workflow creates and updates; it never deletes. It also assigns any open `[Sx]` issue without a milestone to milestone Sx, on push and whenever an issue is opened or edited.
- **Rolling-wave detail.** The current milestones carry implementation-sized issues. Later milestones carry coarse issues that are split when their milestone becomes current. Planning far ahead in detail produces work nobody reads again.

| Label family | Values | Meaning |
|---|---|---|
| `type:` | `epic`, `feature`, `eval`, `research`, `decision`, `bug`, `chore` | What kind of work. `decision` means the owner must choose; agents prepare options and evidence. |
| `track:` | `product`, `domain`, `design`, `agent`, `platform`, `growth`, `ops` | Which part of the system. Growth issues sit inside Stages 2, 4 and 5 and use [the research and growth methods](../growth/README.md). |
| `status:` | `needs-plan`, `ready`, `in-progress`, `in-review`, `blocked`, `needs-owner` | Where it is. Closed means done with evidence. |
| `priority:` | `now`, `next`, `later` | `now` is this cycle, `next` follows it, `later` is parked with its reason. |
| other | `regression`, `owner-wish` | A capability fell below its eval; an idea the owner stated that no milestone yet covers. |

**Work-in-progress limit:** at most three issues `status:in-progress` at once. Stages run in roadmap order; the only overlap the roadmap allows is S3A's shared-command and local-bridge units alongside S1–S2. Finishing beats starting.

## The issue contract

Every issue states, in its template's sections: the **outcome** a user or the owner can observe, **why** (the strategy, decision or evidence it serves), **acceptance criteria** written as checks, the **evals** it moves or must keep green (IDs from [the evals register](../evals/README.md)), what is **out of scope**, and the **authority** it needs if any step is owner-only.

**Ready** means acceptance criteria are checkable, dependencies are closed or named, and a plan exists when the work spans more than one pull request or changes a shared contract. **Done** means the pull request is merged with `Closes #n`, CI is green, the listed evals were run with results linked in a closing comment, owning documents reflect the change, and the compound step below has been considered.

## The loops

Four loops catch drift at different time scales. Each produces a written artifact; a loop that leaves no artifact did not run.

### L1 — Unit loop (every issue)

The Compound Engineering pipeline, installed per [development plugins](../development-plugins.md):

1. **Frame.** Unclear requirement → `ce-brainstorm`. Clear requirement spanning more than one pull request or touching a contract → `ce-plan`, written to `docs/plans/YYYY-MM-DD-HHMM-<type>-<slug>-plan.md` and linked from the issue. Small, clear fixes skip to step 2.
2. **Build.** `ce-work` against the issue's acceptance criteria. Run `pnpm docs:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and the issue's evals locally before pushing.
3. **Review.** `ce-code-review` on the diff; `ce-doc-review` for plans and contracts. Findings are fixed or answered, not deferred silently.
4. **Ship to branch.** Pull request referencing the issue. CI must pass. The traceability check fails a pull request that names no issue.
5. **Close with evidence.** A closing comment lists what was verified, with commands and results. Unverified claims are labeled as such.
6. **Compound.** When the work produced reasoning that the final code, tests and owning documents do not already carry, run `ce-compound` to write a learning under `docs/solutions/`. Most issues need no learning; the step is to ask, not to always write.

### L2 — Weekly review (pinned "Operating log" issue)

Once a week, one comment on the pinned operating-log issue, in this order:

1. **Shipped:** issues closed, with eval movement.
2. **Evals:** current value versus last week for each active eval; any regression gets a `type:bug` + `regression` issue.
3. **Dogfood:** the owner's week from [EV-08](../evals/README.md), as counts and non-personal summaries only (this issue is public).
4. **Strategy signals:** anything observed that challenges [STRATEGY.md](../../STRATEGY.md).
5. **Owner queue:** open `status:needs-owner` issues with the decision each one blocks.
6. **Next:** re-rank `priority:now` and enforce the WIP limit.
7. **Learning:** one line on what this week taught, or "none".

### L3 — Gate review (each milestone)

When every exit-gate item on an epic has linked evidence, an agent assembles a gate packet as an epic comment: each criterion, its evidence link, its confidence tier, the eval results with denominators, and open risks. The owner passes, passes with conditions or fails it. A pass closes the milestone and triggers rolling-wave planning: the next milestone's coarse issues are split and its first plan is written. A fail keeps the milestone open with new issues for the gaps.

### L4 — Strategy check (each gate review, and at least monthly)

Compare eval results and any observed user evidence against the hypotheses in `STRATEGY.md`. If evidence contradicts a hypothesis, raise it with the owner, who decides whether to update `STRATEGY.md` (with `ce-strategy`) or the roadmap. Where the roadmap states a stop rule, it applies as written.

**Demotion.** A shipped capability whose eval falls below its threshold is reopened as a `regression` issue. Shipping is not permanent.

## Evidence and confidence

A method adapted from the owner's audience-research practice. Every claim that supports a gate or a strategy change carries one tier. Gate criteria accept only `measured` or `observed`.

| Tier | Means | Use |
|---|---|---|
| `measured` | Produced by a check or eval in this repository, with command, commit and date | Gates, claims about the app |
| `observed` | A real user session, interview, public post or review, with source and date | Gates, strategy |
| `operator` | The owner said it directly | Decisions; never market evidence (n = 1) |
| `reference` | A cited third-party document, not independently checked | Context; quote and cite if reused |
| `inferred` | An agent's reasoning from other items | Internal planning only |
| `simulated` | An LLM or persona reaction | Pre-review of drafts only; never evidence, never filed as a finding |

If something is unknown, write it down as unknown in the issue or the owning document. Do not fill a gap from memory or from a title, thumbnail or summary of a source that could not be read.

## Authority

Agents may open and refine issues, write plans, implement on branches, open pull requests when asked, run checks and evals, and assemble gate packets. Only the owner may: decide `status:needs-owner` issues, pass a gate, change strategy, approve deployment or publication, contact people, run campaigns, choose providers or prices, and enable billing. These limits restate [AGENTS.md](../../AGENTS.md); where they differ, AGENTS.md wins.
