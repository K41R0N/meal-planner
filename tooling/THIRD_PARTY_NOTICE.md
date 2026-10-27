# Development-tool source notices

Native plugin sources are pinned in `agent-tools/plugins.lock.json`. Original authors and source repositories are preserved in plugin manifests and skill frontmatter. These tools are development-only and excluded from the application runtime dependency graph/container.

Awwwards/Jury skill bodies, references and scripts are unchanged copies of juliobsz/skills at add880bd6ec9f5592a1482846fc0dd282c9161bc, distributed under the upstream MIT license included in each native wrapper folder. Only explicit native package metadata has been added. This is a community skill inspired by Awwwards practices, not an official Awwwards product or an award.

The two `.claude/skills/` Vercel directories are from vercel-labs/agent-skills at 063bee94c3f4df8453406c830b0a7df0f2860278. Their original attribution, MIT license declarations and reference structure are preserved.

Compound Engineering (EveryInc) and Impeccable (pbakaus) are installed from their recorded upstream revisions through the native runtime; their full source trees are not vendored into this application.
