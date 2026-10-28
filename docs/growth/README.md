# Growth method: evidence, positioning and monitoring

Updated October 28, 2026. How Mealbook learns who it is for, which angle moves them and whether growth is real. Adapted from the owner's audience-research and launch-measurement methods; only the reusable method is carried over, not any other client's material. [STRATEGY.md](../../STRATEGY.md) owns the current hypotheses, [go-to-market](../commercial/go-to-market.md) owns channel and pilot proposals, and this file owns how evidence for both is gathered and judged. Nothing here authorizes outreach, posting or campaigns; contacting people is owner-only.

## The four artifacts

| Artifact | Location | Answers | Created in |
|---|---|---|---|
| Listening map | `docs/growth/listening-map.md` | Where the target segment talks, in what words, and which signal types matter | M1 |
| Evidence ledger | `docs/growth/evidence-ledger.csv` | What we have actually observed, coded to a job, pain and confidence tier | M1, then ongoing |
| Funnel map | [funnel-map.md](funnel-map.md) | For each step from first sight to renewal: the belief needed, the trigger, the blocker and the observable signal | v0 now (inferred), v1 at M1 gate |
| Positioning scorecard | `docs/growth/positioning.md` | Which angle the evidence supports, and how the pilot will test it | M1 |

## Gathering evidence

**Listen before asking.** Public posts and competitor app reviews show unprompted language and pain. Record each signal in the ledger with: date observed, source URL, source type, a short paraphrase (not a copy of the post), the job it relates to, the pain, whether it supports or contradicts a `STRATEGY.md` hypothesis, and a confidence tier from [the operating rules](../operating/README.md#evidence-and-confidence). Never store usernames, profile links or contact details. If a source cannot be opened or read, say so; do not code it from its title.

**Code against jobs, not features.** The jobs under test are: finding realistic cooking time; turning saved recipes into a week; one shopping list that covers useful meals; hitting calorie/protein targets; fixing imported recipes; reusing prepared food. A signal that names a feature ("I want YouTube import") is coded to the job behind it.

**Interview to explain, not to sell.** Problem interviews follow the screener and guide written in M1. The owner runs them; agents prepare the guide and synthesize notes into the ledger as `observed`. Ask about the last real week, not hypothetical preferences.

**Simulated readers are for drafts only.** An LLM asked to react as "the persona" can catch confusing copy before a human sees it. Its reactions are `simulated`: never ledger entries, never gate evidence.

## Choosing the angle

Score each candidate angle against the ledger: how many observed signals it speaks to, in the segment's own words; which competitor already owns it (see [the benchmark](../research/market/commercial-strategy.md)); whether the shipped product can honestly deliver it today; and the pilot test that would falsify it. Choose one. Keep the others with their scores, so a failed pilot has a documented next candidate.

## Monitoring growth

**North-star:** repeat useful prep weeks, as defined in [the evals register](../evals/README.md). Imports, sessions, downloads and trials are inputs, never substitutes.

**Instrumentation rules** (for when consented analytics exist; none exist today):

1. Event names are versioned and listed in the funnel map with the step they observe.
2. Before any launch or change meant to move a metric: record the baseline, and confirm in a test environment that every event the change depends on actually fires. A funnel step that was never wired produces a confident wrong answer.
3. Every reported number carries its window, source, filters and denominator.
4. No recipe text, dietary details, contact details or free text in generic analytics.
5. Review cadence after a launch beat: a day-9 read to set the adoption baseline, a day-30 report against it. Weekly growth notes go in the operating log.

Once a consented analytics source exists, the Compound Engineering `ce-product-pulse` skill can produce dated single-page pulse reports from it; until then, the weekly review uses the evidence ledger and EV-08.

## Kill and revise

The M1 kill/pivot rule in [the milestones](../operating/milestones.md#m1--icp-and-positioning-evidence-growth-track) applies. More generally: if two consecutive weekly reviews add evidence that contradicts a `STRATEGY.md` hypothesis and none that supports it, open a `type:decision` issue to revisit it with `ce-strategy`.
