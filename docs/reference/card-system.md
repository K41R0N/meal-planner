# Mealbook card system reference

## Scope and source of truth

Mealbook uses an Atlantic/oyster/citrus card system for a personal, Today-first recipe book. This reference records the interaction and visual patterns that already exist in the web application; it does not prescribe a redesigned UI or introduce new screens. The approved direction is in `DESIGN.md`. The implemented evidence is primarily in:

- `apps/web/src/experience/controls.tsx` — shared labeled button, dialog, image treatment, and `RecipeCard`.
- `apps/web/src/experience/MealbookUI.tsx` — primary navigation, Today card, cooking surface, support rails, and dialogs.
- `apps/web/src/experience/RecipeWorkspace.tsx` — recipe collection, filters, manual entry, and editable review patterns.
- `apps/web/src/experience/mealbook-ui.css` and `apps/web/src/experience/recipe-workspace.css` — tokens, responsive layouts, state styling, focus, and reduced motion.

A private Storyteller/Pip Decks reference was optional read-only inspiration for abstract behavior only. It is not required to build or use this repository. Do not copy deck text, tactics, artwork, layouts, screenshots, or any private data from `K41R0N/pip-decks-app`. The transferable ideas are intentionally generic: a recognizable card, a focused detail view, an understandable state band, visible selection, and a clear next action. Mealbook’s component code, paired-card mark, copy, and Atlantic/citrus styling are its own implementation.

## Tokens and visual contract

The `.mealbook-ui` scope defines the production tokens. Use the existing variables rather than sampling arbitrary colors from screenshots.

| Role | Token/value | Implemented use |
| --- | --- | --- |
| Structural ink and selected navigation | `--mb-atlantic: #16425a` | Heading text, desktop rail, active controls |
| Quiet page ground | `--mb-oyster: #f2f7f7` | App background and dialog surface |
| Reading/card surface | `--mb-white: #ffffff` | Recipe cards, fields, rails |
| One primary action | `--mb-citrus: #f4b743` | Main `LabelledButton`, focus outline, active mobile nav edge |
| Supporting text | `--mb-muted: #5b7483` | Source, time, hints, secondary explanation |
| Divider/control line | `--mb-line: #c9dce1` | Fields, card edges, lists |
| Positive state | `--mb-ready: #176b52` / `--mb-ready-soft` | Ready portions and confirmed fit |
| Caution state | `--mb-warn: #805817` / `--mb-warn-soft` | Missing source facts and review warnings |

General Sans is used when its permitted self-hosted binaries are available, followed by platform sans-serif fallbacks. Amounts, macro facts, timers, and shopping quantities opt into tabular numerals. The shared radius is `18px`; recipe cards use a slightly tighter `15px` radius. The visual goal is tactile and calm, not skeuomorphic: shallow Atlantic-tinted shadows, restrained border changes on hover, one citrus primary action, and no decorative flipping.

## Card anatomy

### Recipe collection card

`RecipeCard` in `controls.tsx` is a semantic `<article>` whose main open action is a real button. Its reading order is deliberate:

1. **Visual** — an actual source thumbnail, an explicitly labeled illustrative cover, or a typographic fallback; never substitute a stock dish image for a creator’s thumbnail.
2. **Optional state band** — status and portion count only when there is a meaningful state, such as ready food.
3. **Identity** — two-line-clamped recipe title.
4. **Decision facts** — source prep/cook time, or the explicit `Time not confirmed` fallback; up to calories and protein only when known.
5. **Nutrition basis** — displayed as per recipe serving only when the card’s normalized nutrition supports it.
6. **Quiet provenance** — creator credit, source name, or `Personal recipe`.
7. **Optional secondary action** — rendered outside the primary open button so controls do not nest.

A card is a scan-and-open affordance, not a complete recipe editor. Long provenance, full macro tables, ingredients, and evidence belong in the focused detail/review flows. Titles, source wording, unknown values, and evidence must remain readable rather than being hidden behind a gesture.

### Today card

The Today card in `MealbookUI.tsx` is a larger action surface. It keeps the recipe visual, then a `mb-state-band` for statuses such as “To cook,” “Ready to eat,” “Cooking in progress,” or “Eaten today.” The card presents name, source time or its absence, compact facts, and one next meaningful action: Start cooking, Resume cooking, Have a portion, or Choose next meal. Low-emphasis links such as View recipe and Shop this meal follow the primary action.

This pattern distinguishes planned food from prepared food and consumption. A green state is not a generic success decoration; it communicates that portions are ready. A caution callout does not invent a fact: it names missing yield, unknown timing, or a need to consult stored reheat context.

### Supporting cards and lists

Support rails, batch cards, filters, schedule tiles, cooking timers, and empty states use the same white/oyster surfaces, line treatment, clear heading, short explanation, and visible control order. Each surface should advance one job. Advanced organization and full nutrition are disclosures or secondary routes; they are not forced into every scan surface.

## Interaction patterns

### Navigation and responsive layout

There are four primary destinations: Today, My week, Recipe book, and Shop. `PrimaryNav` renders all four with both an icon and a text label. On small screens it becomes a fixed four-item bottom bar (`.mb-mobile-nav`) with safe-area padding and a citrus active edge. At `760px` and above, it becomes a fixed 225px Atlantic rail (`.mb-rail`) with the same labels and current-page state. The information architecture does not change at the breakpoint.

The card geometry adapts rather than stretching a phone mockup. Recipe cards are two columns by default, one below `430px`, three at `760px`, and four at `1160px`. The desktop Today view becomes a card plus support rail, with the large recipe visual spanning the card’s left side. Cooking becomes a work area with a sticky supporting rail. At phone widths, Today constrains the visual height so the action remains in reach above the bottom navigation.

### State, action, and recovery

Use visible standard controls for important work. Buttons have explicit hover, active, disabled, loading, and error behavior; no core operation depends on swipe, drag, flip, or long press. `LabelledButton` supplies a readable text action with a 46px minimum height. Icon-only close buttons remain 44px and have an accessible name. Chips expose `aria-pressed`; tabs use `role="tab"` and `aria-selected`; page navigation uses `aria-current="page"`.

The app treats cancellation and recovery as normal. Import drafts remain in session storage during review, dialogs close through their cancel behavior, and recipe state is not discarded merely because a user navigates away. Cooking and eating use explicit confirmation dialogs because they affect distinct local states.

## Accessibility and evidence rules

- `.mb-skip-link` reaches the main content on first focus. `:focus-visible` uses a 3px citrus outline with offset; focus is not replaced by hover styling.
- Forms use labels, hints, input modes for numeric/url entry, and `role="alert"` for errors. Dialogs use native `<dialog>` with `aria-labelledby`; import and cooking updates use appropriate live regions.
- Tap targets are at least 44px for icon and field controls, while main buttons are 46px. No color alone expresses selection: navigation, chips, source labels, and state bands include text.
- `@media (prefers-reduced-motion: reduce)` reduces transitions, animation duration, and scroll behavior without hiding information.
- Image semantics are explicit. `RecipeVisual` labels generated covers as “Illustrative cover,” external video art as “Source thumbnail,” and no-image states as a neutral saved-recipe fallback. An image is not nutrition evidence or proof that a thumbnail depicts the dish.
- Missing time, yield, source amounts, nutrition, and storage details stay missing. Cards communicate the gap directly; they do not estimate or normalize unsupported values.

When extending an existing card, start with the shared components and the source-evidence rules above. Preserve clear text labels, a single primary decision, familiar responsive behavior, and reviewability before adding visual polish.
