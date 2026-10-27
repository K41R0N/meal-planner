# Agent-friendly web experience

Agent friendliness should make Mealbook easier for humans too. Keep the approved Today-first cards and four main destinations; expose clear state, stable meaning and safe actions rather than turning the app into a chat interface. This is a future usability/API contract, not an assertion that the current DOM or backend already satisfies every requirement.

## The app remains the workspace

Today still offers its recipe whether uncooked, in progress, prepared, eaten or depleted. Recipe cards retain identity across the book, week, shopping contribution and cooking view. Agent-created suggestions enter the same existing review surfaces, labelled with their origin, exact changes and uncertainty. A text conversation is not a parallel source of truth.

Show an obvious **Connect your assistant** setup in secondary settings, not on every recipe card. Explain provider/client eligibility before a user pays or grants data access. The user signs into Mealbook, selects permissions, and connects from their chosen host. No prompt for a model API key. Show the connection account, supported operations, active grants, last action, revoke and help. Ordinary book/cook/shop use must work when the assistant is disconnected.

## Semantics and discoverability

Use real buttons, links, headings, labels and landmark regions. Expose card titles and state-dependent actions through the accessibility tree; do not hide a recipe's identity behind an unlabeled image or hover-only affordance. A modal has a named purpose, focus containment, visible error feedback and a reliable close/return path. Status changes use restrained live announcements rather than clearing context. Keyboard, screen-reader and touch paths must reach the same actions.

Define canonical deep links to owned recipe/version, draft review, week/proposal, grocery scope and cooking session. Validate all identifiers against the signed-in account. A link identifies a destination; it grants no authority. The current hash-page menu does not yet provide every entity-specific deep link, so this is planned work.

Stable machine identifiers support owned records and action semantics, not brittle coordinates or copied visible text. Human labels remain clear and localizable. Automation/test hooks do not expose secrets or private records to unauthenticated pages. Prefer the authenticated API/MCP for data and actions; accessible DOM is a fallback for ordinary navigation, not a mandate to scrape food diaries or bypass approval APIs.

## Review and approval without an embedded agent

Use the existing recipe-review and week/swap comparison grammar. A pending suggestion shows what will change, known/unknown macros, source confidence, affected groceries and the precise commit action. Human approval uses the trusted app/session route under [permissions](permissions-and-trust.md); an assistant-readable approval link is not a permission token. Do not show “Saved” or “Your new week” before the service has committed the change.

Save-and-cook, save-and-plan and source-to-shopping handoffs keep distinct intents. After commit, the app reads the authoritative result and opens the appropriate existing card; interrupted navigation can resume that record. A planned/cooked/consumed quantity has a different label and operation. An agent may suggest actual logging, but the user confirms quantity/date against the correct prepared snapshot.

Offer a concise user action history with origin (app, connected client or local bridge), time, reviewed change, status and reversal where safe. Expose pending actions in a small secondary inbox/banner instead of adding another main destination or a dashboard of agent activity. When the app is offline, show cached authoritative revision and pending local work; reconcile conflicts visibly when it reconnects. Do not say “synced” while the agent's committed server result has not reached the device.

## Connection and failure design

Disconnected assistants leave the existing loop usable. Unsupported clients get accurate read-only/manual options, not a paywall promising writes they cannot use. A blocked video offers source text/manual entry; a revoked connection stops new access and preserves already-saved recipes. A stale plan preview explains the changed meal/quantity and asks for a new comparison rather than losing the week.

The local development bridge explicitly says the browser must stay open. Commercial remote access explicitly says data is synchronized to the user's account. These are different modes; no invisible automatic upload of the owner's current private IndexedDB.

## Required usability evidence

A user can complete capture/review/save, confirm a batch week, see a replacement's shopping delta, resume cooking after interruption and record/undo actual intake without conversational instructions. A connected assistant can identify the same owned records and preview those changes without coordinate clicking. An MCP commit is visible in that UI, and a UI change is visible in tools. Complete the same scenario using keyboard/screen reader and phone-sized touch targets, including stale approval and disconnection. These are future verification requirements, not a claim that a browser screenshot certifies the experience.
