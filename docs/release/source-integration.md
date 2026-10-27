# Source integration and deployment separation

Updated October 27, 2026. The user explicitly directed: **“Just push to main”**, after reviewing the prepared app, documentation and the assistant's proposed holds. This instruction authorizes pushing the **complete existing source bundle** to `K41R0N/meal-planner` main and supersedes the earlier access/asset conditions imposed for this source integration. No additional confirmation is required for this push.

Source publication is not a commercial app release. No account, billing, model hosting, deployment-settings change or manual app publication is authorized by this instruction. Preserve remote history and concurrent changes; never force-push.

## Repository and existing deployment

- Central source: public GitHub repository `K41R0N/meal-planner`.
- Remote main before integration: `01eacc21110e39f438a904f328debd57bbd3207f`.
- Prepared application commits: `258cc74`, `c7e867d`, `39d4abe`.
- Prepared documentation commit: `d9b2f67`; final authorization/status corrections follow it.
- Connected legacy Netlify site: `healthy-meal-planning`, ID `63e3c8ee-25d8-4c2a-ae91-2e71ea460b3c`.
- Last observed published deploy: `67b282be2b5c04000874b707`, state `ready`, source SHA `01eacc21110e39f438a904f328debd57bbd3207f`.

The existing public Netlify prototype and the unreleased Mealbook replacement/commercial service are distinct. The source bundle preserves the full working app, research recipe bank, cards/design references, research and commercial-release documentation without adding private purchased deck content, credentials, personal records or restricted raw font binaries.

## Integration method

Fetch remote main; verify ancestry; integrate normally if it changed; run affected checks; fast-forward local main to the complete approved source and perform a normal non-force push. Include **`[skip ci]`** in the final commit message, Netlify's documented Git-triggered deployment-skip mechanism. Do not invoke a deploy/publish tool, change Netlify settings or alter repository integrations.

Read back the remote SHA after the push and compare with local main. Read the current Netlify published deploy ID where available and report its observed state accurately. A skip marker addresses the documented Git-triggered flow; it is not a claim that all unknown third-party triggers have been independently audited.

## Historical hold and continuing release work

The earlier documentation pass held the push because the integration could not inspect GitHub webhooks/Netlify build locks and creator-thumbnail redistribution rights were not established. The owner subsequently instructed proceeding with the complete source bundle. These are therefore **not pending source-push blockers**. Do not reopen the superseded hold or convert a historical review note into a new approval requirement.

The owner’s instruction does not establish third-party copyright permissions or license the research seed as a paid public catalog. The rights inventory, source-platform constraints and commercial release gates remain important future product work in [provenance](../reference/provenance-and-licenses.md) and [production readiness](production-readiness.md), not reasons to refuse this authorized source operation.

## Existing verification

The prepared source passed 87 application regression tests, strict TypeScript, production build, 100 repository-local documentation targets and fresh SQLite export integrity. No new runtime feature is added by the final authorization/status correction. The [documentation review](documentation-review.md) preserves the earlier findings chronologically; this document records the later controlling instruction.

## References

- [Netlify commit-message deployment skipping](https://www.netlify.com/blog/2018/10/08/get-more-control-over-netlify-continuous-deployment-with-deploy-skipping/)
- [Netlify ignored builds and build-hook limitations](https://docs.netlify.com/build/configure-builds/ignore-builds/)
