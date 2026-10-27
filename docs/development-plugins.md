# Development plugins and upgrade workflow

Installed in this cloud workspace on 2026-10-26, for this project only. No changes were made to the user's Android device or local computer.

| Tool | Installed version/source | Use in Meal Planner |
| --- | --- | --- |
| Claude Code | 2.1.311 | Native project plugin runtime and registration |
| Compound Engineering | 3.33.0; EveryInc commit d6f3881f38e9cfa89b17764334b04b7f3841f134 | Scoped implementation, review and retained engineering decisions |
| Impeccable | 4.8.0; pbakaus commit 414603bf14c7a344edb466bb1f85690c77ce8b7d | Operate-mode task clarity, mobile adaptation, edge states and actual mechanical design detection |
| Awwwards and Jury | juliobsz commit add880bd6ec9f5592a1482846fc0dd282c9161bc | Quality guidance for hierarchy, interaction and usable mobile craft, not a claim of an Awwwards award |
| Vercel React Best Practices / Web Design Guidelines | vercel-labs commit 063bee94c3f4df8453406c830b0a7df0f2860278 | Performance and interface guidance, installed as project skills |

Compound Engineering and Impeccable were installed through their native marketplaces. The upstream juliobsz folders were registered successfully but lacked explicit native plugin manifests. Their unchanged skill bodies, references and scripts are now preserved in `tooling/plugin-packages/`, with native manifests declaring `skills: "."` and the upstream MIT license. These were validated and installed through the project's `mealbook-design` marketplace. This is a native packaging adaptation, not a claim that copied prompt files alone activate a plugin. The original source checkout remains unchanged.

`claude plugin list --json` confirms all four plugins are enabled for the mealbook project and reports no loading errors after the marketplace cache correction. The native validator accepts all four manifests; missing marketplace-listing icons are non-blocking metadata warnings, not app defects. `.claude/skills/` contains only the two selected Vercel skills. No native/portable duplicate set is enabled.

The attempted tool-disabled Claude Code model-session check returned **“Credit balance is too low”** from the available Anthropic API account, with a reported cost of zero. Further native model calls were stopped. The restricted session did not expose project plugins, so no successful native model-driven audit is claimed. Installation, registration, manifest validation and the Impeccable CLI/detector are verified independently. The development work proceeds through Manus using the installed guidance. The app importer uses the separate verified Manus-managed model service, not this Anthropic key.

Project hooks, inline skill-shell execution and unrelated Claude.ai connectors are disabled. Cross-model peers, Live mode, autonomous shipping and extra MCP integrations were not enabled. Impeccable telemetry is off. Plugins are development tools; they are excluded from the runtime container and do not run when someone uses the app.

To restore the pinned development setup from an accepted source checkout, run `node scripts/setup-agent-tools.mjs`. It installs the isolated toolchain, checks out recorded plugin revisions and registers project-scoped plugins. It does not start inference, push Git or publish. Re-run model-powered native reviews only after a usable Claude Code account or API balance is available.

Invoke the isolated native runtime from this source checkout with `node scripts/claude.mjs`. For example, `node scripts/claude.mjs plugin list --json` checks registration without inference. An interactive/model-powered command still needs a usable Claude Code account or API balance. The wrapper keeps tool dependencies outside the app dependency graph and does not publish or push.
