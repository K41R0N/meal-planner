# Meal Planner design system

This records the existing interface, not a new visual direction. App surfaces are Operate: completing recipe review, planning and shopping takes precedence over spectacle. Cooking content is Read.

## Visual authority

Warm paper ground `#f6f3eb`, dark herb ink `#25382f`, primary action `#315f49`, cream card `#fffdf8`, restrained rust focus `#b8562d`, and fine linen separators `#ded9ce`. Colors carry hierarchy but never replace labels. Mobile readable cards and a focused recipe viewer are inherited from the approved Storyteller-inspired direction, with independent artwork and icons.

Titles use the incumbent Georgia/Times reading-serif stack; amounts, controls and content use the platform sans-serif stack, offline without external font downloads. Use tabular numerals for quantities and macro values. Fluid page titles do not displace primary actions on a narrow screen.

## Interactions

Four consistent main destinations: This Week, Recipe Book, Shopping and Food Log. Settings and importing are secondary. Recipe search, planner meals and newly saved imports open the same detail. Shopping uses aisle lists rather than decorative metric cards. Touch targets are at least 44px on mobile; keyboard focus is visible and dialogs/sheets restore focus. Input and text selection are themed and high-contrast.

The authored moment is a recipe becoming a usable week: source → review → saved card → selected batch → updated groceries. Progress states identify which step is happening. Cancellation retains the draft, retries are explicit and save feedback offers the next action. Never imply a recipe was saved while validation or persistence failed.

Motion is restrained 120–180ms control feedback, without scroll hijacking, autoplay, WebGL or animation-dependent controls. Respect prefers-reduced-motion. Keep necessary content and controls visible without flipping cards or hidden gestures.

## Data and language

Unknown is not zero. Labels distinguish source-reported macros, confirmed per-serving values and incomplete totals. Warnings say what is uncertain and how to fix it. Suggested tags/roles are editable, not nutritional claims. Show creator credit and a source link. Do not use award badges, fabricated usage metrics, prescribed calorie targets or unsupported storage claims.

Examples: “Review ingredients before saving.” “YouTube blocked this request. Paste the creator’s written recipe instead.” “Recipe saved. Choose where it fits this week.”
