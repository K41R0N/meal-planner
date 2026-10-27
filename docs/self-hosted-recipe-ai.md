For this Android-first personal recipe app, use an **optional, self-hosted decision service based on Ollaya with the Apache-2.0 Laya model family** for the first prototype. Put a small application-owned adapter in front of it and give the model only a closed, user-editable recipe taxonomy. This is the closest practical self-hosted analogue to TypeSafe Jev: a request contains a state plus typed questions, and it returns choices, scores, booleans, probabilities, and confidence rather than generated prose. [1] [3] It is a better fit for organization and lightweight planning decisions than a chat model forced to emit JSON.

Treat this as an assistive labeling layer, not the source of recipe facts. Recipe viewing, search, manual tagging, and meal planning must work directly from the local app database when the service is unavailable. AI suggestions should be asynchronous and never block those flows.

## Name resolution: likely Ollaya, not Ollama

I found no primary project or documentation named `openllaya` or `OpenLaya`. The evidence points to a conflation of **Ollaya** and **open Laya**:

- **Ollaya** is a real Apache-2.0 local runtime that pulls and serves multiple open decision-model families through a TypeSafe/Jev-compatible HTTP API. It is infrastructure, not a model. [3] [4]
- **Laya** is a real Apache-2.0, open decision-model project. It makes `choice`, ordinal `score`, and boolean `noul` decisions over text or JSON. [6]
- **Jev** is TypeSafe's hosted flagship System One model. It is designed for state-plus-typed-question decisions and does not generate text; its official announcement describes early access, not released open weights. [1] [2]
- **Ollama** is separate. Its structured-output feature constrains a general text-generating model to JSON Schema through its chat API. Ollaya's own current documentation also reports that Ollama 0.40 can serve a smaller decision-model catalogue through the TypeSafe wire format. The runtimes therefore overlap in some protocol support, but they are not the same project, model catalogue, or operating model; do not treat generic Ollama JSON output as synonymous with an Ollaya/Laya decision service. [3] [16]

So, if “openllaya” was meant as a self-hosted Jev replacement, the most likely intended term is **Ollaya**, with **Laya** as the default small open model to begin evaluating.

## Viable choices

### 1. Ollaya plus Laya — recommended decision layer

**Repository:** [https://github.com/ollaya-dev/ollaya](https://github.com/ollaya-dev/ollaya)  
**Core model repository:** [https://github.com/NandhaKishorM/laya](https://github.com/NandhaKishorM/laya)

Ollaya serves `POST /v1/systemone` and `/v1/decisions` in TypeSafe's request/response shape, as well as a native `/api/decide` endpoint. Its default local base URL is `http://127.0.0.1:11435`; API-key checks are optional unless the operator sets `OLLAYA_API_KEY`. [4] It supports Laya's closed-option decisions and returns probabilities, so the app can record both a proposed tag and the model's confidence rather than pretending every suggestion is certain. [3]

The runtime is Apache-2.0, but its model registry mixes licenses. Select `laya` deliberately because the Laya code and published weights are Apache-2.0; do not assume every Ollaya model shares that permission. [3] [6] Maintenance is active but the runtime is very new: the public repository was created on September 23, 2026 and had 331 commits with a push on October 26, 2026 at the time of review. That is promising activity, not long-term stability evidence. [3] [5]

For recipe organization, represent a bounded taxonomy as independent questions. Use `choice` for one-of-one values such as `primary_meal = breakfast | lunch | dinner | snack`; `score` for a non-safety preference such as low-to-high prep effort; and one `noul` question per independently applicable tag such as `freezer_friendly`, `make_ahead`, or `weeknight_fast`. That produces genuine multi-label behavior without asking a generative model to invent tags. Keep each tag definition clear and store an `unknown / needs review` outcome in application code when confidence does not clear a separately evaluated threshold.

The important limitation is taxonomy scale. Laya's own limits recommend roughly 20 options per `choice`; use several small dimensions or deterministic shortlisting rather than one giant cuisine/tag list. Its maintainers also state that calibration, wording, option order, task transfer, and long input behavior need evaluation on the target data; confidence is not a safe automatic-acceptance threshold until it has been checked on held-out examples. [8]

Hardware facts are incomplete. Ollaya can use ONNX Runtime on CPU and NVIDIA CUDA for applicable models; its GGUF-backed models have broader CPU, CUDA, ROCm/HIP, Vulkan, and Metal paths. Laya itself is listed as a 421M English or 322M multilingual model in Ollaya's registry. [3] A maintained Node Laya runtime reports a 1.7 GB FP32 ONNX download and approximately 2 GB loaded RAM plus batch overhead, but this is a wrapper-specific data point, not a published Ollaya minimum. [9] There is no reliable published minimum RAM/VRAM for the exact recommended Ollaya-plus-Laya configuration, so do not make a hardware promise before a local measurement.

### 2. GLiClass — strongest direct multi-label tagger

**Repository:** [https://github.com/Knowledgator/GLiClass](https://github.com/Knowledgator/GLiClass)  
**Small Apache-2.0 model:** [https://huggingface.co/knowledgator/gliclass-edge-v3.0](https://huggingface.co/knowledgator/gliclass-edge-v3.0)

GLiClass is an Apache-2.0 zero-shot text-classification framework with explicit multi-label classification, hierarchical labels, label scores, and an HTTP serving example. It is a direct fit when a recipe can take several tags at once and the user wants to add or remove taxonomy entries without first retraining a model. [10] The selected `gliclass-edge-v3.0` weights are also Apache-2.0 and are 32.7M parameters / 131 MB. Its card reports an A6000 GPU benchmark of 97.29 examples per second, but not a CPU latency or RAM floor. [11]

GLiClass has a longer public history than Ollaya and was pushed on October 24, 2026, which is useful maintenance evidence. [12] Its limitation is architectural: it is not a drop-in Jev/TypeSafe API and its scores should be treated as ranking signals, not as validated nutrition, dietary, or storage facts. It is the best alternative if flexible multi-label recipe tagging is the dominant need, but it adds a Python serving component where Ollaya provides the more convenient Jev-style decision contract.

### 3. SetFit — later personalization from the user's corrections

**Repository:** [https://github.com/huggingface/setfit](https://github.com/huggingface/setfit)

SetFit is Apache-2.0 and substantially more established. It fine-tunes a Sentence Transformer plus a classification head from a small labeled set, and its official documentation supports multi-label heads through one-vs-rest, multi-output, and classifier-chain strategies. [13] [14] This makes it the right later-stage option when the app has accumulated user-approved and user-rejected labels that clearly express one person's organization habits.

It is not the right starting layer. It requires curated labeled examples, a training/evaluation process, and an application-owned API wrapper; it is not a Jev-compatible decision service or a zero-shot tagger. The repository was created in 2022 and was pushed on October 6, 2026, giving it stronger maturity signals than the newer decision-model ecosystem. [15] Its CPU/GPU requirements depend on the chosen sentence-transformer checkpoint and training configuration; the reviewed primary material does not publish a single minimum device requirement. Use it only after there is enough corrected data to evaluate it against a held-out set of the same user's recipes.

## Recommended stack and boundaries

Use this narrow first path:

1. Keep the Android app's recipe, plan, and preferences database authoritative. The app reads and plans without any model call.
2. Put a private application adapter between the app and Ollaya. The adapter owns the taxonomy, question wording, thresholds, logging policy, and a versioned model selection such as `laya:multilingual`. The mobile client should not depend directly on a model-specific API.
3. Send only the declared recipe title, ingredients, steps, and existing user preferences to the adapter. Ask a limited set of independently evaluable questions. Persist the returned proposal; do not silently mutate the recipe.
4. Make every AI-produced label editable. A useful record contains `recipe_id`, stable `tag_id`, `proposed_value`, `probabilities or score`, `model_name`, model revision, taxonomy/question version, timestamp, and `status = proposed | accepted | edited | rejected`. A user edit becomes the visible value and later evaluation/training data.
5. If broad multi-tag discovery becomes more important than Jev-style decisions, evaluate GLiClass on the same saved, user-corrected examples. Use SetFit only if personalized corrections justify maintaining a trained classifier.

Do **not** ask any of these models to invent nutrition values, infer allergen safety, or declare storage safety. Constrained decision output prevents malformed output and prevents the model from creating a new free-text fact, but it does not make a selected label true. Jev's own documentation separates type safety from decision quality and recommends decomposing decisions; Laya's documentation similarly says calibration and task transfer must be evaluated on the target workflow. [1] [8]

Nutrition should come only from a cited nutrition dataset plus user-entered quantities, with its source and calculation version retained. Storage guidance should come from a reviewed rule set or an explicit user note, and should show `unknown` when inputs are incomplete. Do not infer dietary/allergen claims from a recipe name; require an ingredient-level rule, an explicit source, or user confirmation. Preferences remain user-controlled hard filters and editable soft preferences, never model-owned facts.

## Hardware unknowns and evaluation path

No machine specification was supplied. The reviewed primary documentation does not establish Android deployment support or a reliable minimum CPU, RAM, GPU, or VRAM requirement for the proposed stack. Treat the Android device as the private client; run the service on a separately owned home machine or another user-controlled host connected through a private network. Do not assume on-device inference is part of phase one.

Before any installation or deployment decision, inventory the prospective host's CPU architecture, available RAM, storage, accelerator type and usable VRAM. Then compare the CPU-only Laya path with any available GPU path on a small representative set of recipes. Measure cold load, warm latency, memory, tag precision/recall, false dietary/safety claims, and the proportion routed to `needs review`. Fix the taxonomy and question wording for the test, record the exact model revision, and split user-approved examples into development and held-out evaluation sets. This follows Laya's own warning to evaluate model, question wording, option count, hardware, and confidence thresholds on the real workload. [8]

The decision point is simple: retain Ollaya/Laya if it accurately handles the small, fixed decision taxonomy with acceptable CPU latency; add GLiClass only if multi-label tagging quality or taxonomy flexibility demonstrably improves; defer SetFit until user edits provide a meaningful, evaluated personalization dataset. This keeps the feature private, optional, reversible, and usable without paid services.

**References**

[1]: https://docs.typesafe.ai/introduction "TypeSafe Jev introduction"
[2]: https://typesafe.ai/blog/introducing-system-one-models-and-jev "TypeSafe announcement for System One Models and Jev"
[3]: https://github.com/ollaya-dev/ollaya "Ollaya primary repository"
[4]: https://github.com/ollaya-dev/ollaya/blob/main/docs/api.md "Ollaya HTTP API normative contract"
[5]: https://api.github.com/repos/ollaya-dev/ollaya "Ollaya GitHub repository metadata"
[6]: https://github.com/NandhaKishorM/laya "Laya primary repository"
[7]: https://nandhakishorm.github.io/laya/http-api/ "Laya HTTP API documentation"
[8]: https://nandhakishorm.github.io/laya/benchmarks/ "Laya benchmarks and known limits"
[9]: https://github.com/receptron/laya "Receptron Laya Node runtime"
[10]: https://github.com/Knowledgator/GLiClass "GLiClass primary repository"
[11]: https://huggingface.co/knowledgator/gliclass-edge-v3.0 "GLiClass Edge v3 model card"
[12]: https://api.github.com/repos/knowledgator/GLiClass "GLiClass GitHub repository metadata"
[13]: https://github.com/huggingface/setfit "SetFit primary repository"
[14]: https://huggingface.co/docs/setfit/how_to/multilabel "SetFit multilabel classification documentation"
[15]: https://api.github.com/repos/huggingface/setfit "SetFit GitHub repository metadata"
[16]: https://docs.ollama.com/capabilities/structured-outputs "Ollama structured outputs documentation"
