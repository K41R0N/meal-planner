# Research and growth methods

Updated October 28, 2026. These are **methods, not roadmap stages**. They come from the owner's audience-research and launch-measurement practice; only the reusable method is carried over, not any other client's material. The [commercial roadmap](../roadmap/commercial-release.md) decides what gets built and when; [STRATEGY.md](../../STRATEGY.md) owns the current customer and positioning hypotheses; [go-to-market](../commercial/go-to-market.md) owns channel and pilot proposals. This file describes how to gather and judge evidence when a stage calls for it. Nothing here authorizes outreach, posting or campaigns; contacting people is owner-only.

## Where the roadmap uses them

| Roadmap stage | What the roadmap asks for | Method used |
|---|---|---|
| Stage 2 | "A supervised pilot demonstrates users can reach a usable second week" | Screener, moderated sessions, evidence tiers (EV-10) |
| Stage 4 | Recruit 30 qualified, permission-based testers; interview dropouts; instrument only consented, minimal events | Recruitment channel map (listening map), screener, interview guide, funnel map as the event plan (EV-11) |
| Stage 5 | Accurate store descriptions and claims; measured acquisition before scaling | Positioning scorecard from pilot evidence; launch measurement rules below |

Outside those stages the methods are optional. An agent may use them to sharpen a question for the owner, but they do not create milestones, gates or dependencies.

## The tools

| Tool | Location when used | Answers |
|---|---|---|
| Listening map | `docs/growth/listening-map.md` | Where the target segment talks, in what words, and where recruitment is permitted |
| Evidence ledger | `docs/growth/evidence-ledger.csv` | What was actually observed, coded to a job, pain and confidence tier |
| Funnel map | [funnel-map.md](funnel-map.md) | For each step from first sight to renewal: belief, trigger, blocker and the event that observes it |
| Positioning scorecard | `docs/growth/positioning.md` | Which angle the evidence supports and the shipped product can honestly deliver |

## Gathering evidence

**Listen before asking.** Public posts and competitor reviews show unprompted language and pain. Record each signal with: date observed, a source reference, source type, a short paraphrase (not a copy), the job it relates to, the pain, whether it supports or contradicts a `STRATEGY.md` hypothesis, and a confidence tier from [the operating rules](../operating/README.md#evidence-and-confidence). The source reference is the place plus a post or review identifier (for example a community name and post ID, or an app listing and review date), never a URL or text that contains a username, profile link or contact detail. The repository is public. If a source cannot be opened or read, say so; do not code it from its title.

**Code against jobs, not features.** The jobs in `STRATEGY.md` are: finding realistic cooking time; turning saved recipes into a week; one shopping list that covers useful meals; hitting calorie and protein targets; fixing imported recipes; reusing prepared food. A signal that names a feature is coded to the job behind it.

**Interview to explain, not to sell.** Ask about the last real week, not hypothetical preferences. The owner runs interviews; agents prepare guides and synthesize notes as `observed` evidence.

**Simulated readers are for drafts only.** An LLM asked to react as "the persona" can catch confusing copy. Its reactions are `simulated`: never evidence, never filed as a finding.

## Choosing an angle (Stage 5)

Score each candidate angle against pilot evidence: how many observed signals it speaks to in the segment's own words; which competitor already owns it ([benchmark](../research/market/commercial-strategy.md)); whether the shipped product can honestly deliver it; and what result would falsify it. Keep the runner-up with its score.

## Measuring growth

**North-star:** repeat useful prep weeks, as defined in [the evals register](../evals/README.md). Imports, sessions, downloads and trials are inputs, never substitutes.

**Instrumentation rules** (Stage 4 onward; no analytics exist today):

1. Event names are versioned and listed in the funnel map with the step they observe.
2. Before any launch or change meant to move a metric: record the baseline and confirm in a test environment that every event it depends on actually fires. An unwired step produces a confident wrong answer.
3. Every reported number carries its window, source, filters and denominator.
4. No recipe text, dietary details, contact details or free text in generic analytics.
5. After a launch beat: a day-9 read sets the adoption baseline; a day-30 report compares against it.

Once a consented analytics source exists, the Compound Engineering `ce-product-pulse` skill can produce dated single-page pulse reports from it.
