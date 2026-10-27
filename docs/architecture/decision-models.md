# Optional decision models: evaluation before differentiation

Updated October 27, 2026. **Proposed experiment; not installed, hosted or integrated.** The existing importer uses a structured extraction service. This document concerns a separate optional organization/ranking service, not a replacement for source acquisition or deterministic goal arithmetic.

## What a decision model can add

Ollaya is an Apache-2.0 runtime serving multiple open decision models through a TypeSafe-compatible interface. Laya is one model family, not the runtime; Jev is a hosted comparator, not assumed open weights. The official Ollaya registry mixes licenses, including non-commercial and revenue-conditioned models, so approving Ollaya does not approve every model. Record the exact runtime, model/checkpoint, license and weight hash before deployment. [1]

Candidate product tasks are suggesting a primary meal role, assigning a closed organization taxonomy, ranking suitable recipes from an already filtered pool, or flagging uncertain input for review. A user should perceive fewer corrections and a better repeated week, not merely the brand of an inference server. Prefer cached asynchronous proposals; manual organization, cooking and planning must continue when the service is absent.

**Do not delegate:** ingredient quantities, source fidelity, serving yield, nutrition numbers, exact calorie/protein fitting, allergy guarantees, storage safety, billing entitlement or account permissions. A typed answer prevents an invalid output shape, not an invalid decision. Deterministic eligibility and arithmetic have final authority. “Make ahead” can be a user preference label; a model must not silently convert it into a refrigerator/freezer-safety instruction.

## Proposed application-owned contract

A request identifies a reviewed recipe revision, taxonomy version and task. It contains the minimum relevant title/ingredients/method and explicit preferences; it excludes names, email, billing data and unrelated dietary history. Keep independent dimensions small. The response is a set of proposals from allowed values, with probabilities/ranking score, abstention reason and provider provenance.

Persist each proposal as a distinct record: stable proposal ID, user/recipe ID and revision, task/tag ID, proposed value, model/checkpoint hash, runtime version, taxonomy/prompt version, score/probability, calibration version, creation time and review state `proposed`, `accepted`, `edited`, `rejected` or `stale`. User corrections own the visible tag. A recipe edit invalidates dependent proposals; accepted user organization is not overwritten by a newer model.

The adapter owns timeout, concurrency, cache key, input/output validation and failure categories. Cache keys include user preference fingerprint and recipe/taxonomy/model revision; do not share private recipe responses across accounts merely because titles match. An unavailable provider returns `no suggestion`, not a fabricated default. Store final user edits independently so the feature is replaceable without migrating the whole recipe book.

## Model choices and real limitations

Evaluate a small Laya configuration first as the known open candidate, with deterministic rules as the baseline. English and multilingual checkpoints must be tested on the actual supported languages. The maintainer's benchmarks report sensitivity to task, option order and calibration, recommend fewer than roughly 20 choice options, and show weak base zero-shot typed decisions. Fine-tuned benchmark results must not be promoted to accuracy on our recipes. [2]

GLiClass is an alternative when multi-label taxonomy flexibility matters more than TypeSafe compatibility. A hosted Jev-style service is an operational comparator, not a consumer requirement. SetFit or personalized fine-tuning becomes relevant only after enough permissioned corrections exist to evaluate a held-out improvement. The previous [self-hosted research](../self-hosted-recipe-ai.md) preserves references and alternatives, but new evaluation—not that recommendation's existence—determines deployment.

## Proposed evaluation and adoption gates

Create a permissioned, reviewed recipe set representing known sources, sparse descriptions, mixed units, missing yield, multilingual text, recipe edits and adversarial source instructions. Split by creator/source family to reduce leakage. Maintain separate development, calibration and frozen test sets; do not train or tune thresholds on the test set. Labels record reviewer agreement and `unknown`, not a forced answer.

Predeclare task metrics: per-tag precision/recall, false automatic acceptance, abstention/coverage, correction burden, option-order robustness and calibration error. Compare the same examples with deterministic rules and existing manual organization. Test stale-revision handling, unavailable service, cross-account caching, malformed output and prompt-injection text. Sensitive/safety facts are excluded from model-generated labels rather than “accepted at high confidence.”

Possible initial engineering targets are under 5% false acceptance on non-safety tags and sub-second warm response for a small question set on the selected host; **these are proposed acceptance targets, not measured results**. Report sample size and confidence intervals, overall and per task/language. If calibration is poor, abstain more or require review; never use a generic probability threshold without target-workload calibration. A small held-out dataset is a pilot, not a safety certificate.

For product adoption, compare review time, accepted useful organization and repeat-week usefulness with and without the service. Adoption requires a material improvement that offsets maintenance and all-in cost. If manual/rule-based behavior is equally useful, omit the model. Consumer marketing should describe the measured benefit, not “self-hosted AI” as proof of superior quality or privacy.

## Hosting, privacy and cost

The Android device remains a private client initially; on-device model packaging is not established. Select a separately controlled service host only after CPU architecture, available memory, accelerator, cold load, warm latency and concurrency are measured on the exact model. Upstream GPU/CPU benchmarks are hardware-specific and are not our service-level promises. [1] [2]

Keep the inference daemon on a private interface behind the app adapter, require service authentication, pin dependencies, isolate workloads, bound payloads and jobs, and retain model weights under their own license. Self-hosting on our server still sends data off the user's device; do not claim “never leaves your device.” Keep telemetry content-free by default and delete cached private inputs under the user-data policy. Bring-your-own-host access would need a separate threat model and is not the launch default.

Measure loaded-host costs, storage/download, warm capacity, retries, free usage, ops time and support per accepted proposal and active subscriber. A model with no per-token bill is not free infrastructure. Keep provider abstraction and a kill switch. Deploy only after the model evaluation, privacy, license and operating-budget gates pass.

## References

[1]: https://github.com/ollaya-dev/ollaya "Ollaya runtime, APIs, registry and model licenses"
[2]: https://github.com/NandhaKishorM/laya/blob/main/BENCHMARKS.md "Laya task transfer, calibration, option limits and hardware-specific benchmarks"
