# CookBook: product, lifecycle and monetisation audit

**As of 2026-10-27 · Public evidence only · Author: Manus AI**

CookBook is a private, cloud-synced recipe manager that turns personal imports into meal plans and shopping lists. This audit builds on the prior pricing and market baseline but focuses on the decision-critical operating details for an Android-first Mealbook: account boundaries, paid entitlement transitions, recipe-data control, public technical disclosures, and visible growth patterns. All feature and policy statements below are **CookBook-documented, not account-tested**: no login, subscription, app install, restore, cancellation, or deletion was performed.

## Onboarding, profile and household boundaries

CookBook’s public help flows assume a signed-in user with a username and account settings. Its policy also discloses direct registration and several sign-in routes, including Firebase Authentication, Google, Facebook, X, and Sign in with Apple. That establishes public account capabilities, not the actual current onboarding screen sequence or conversion flow. The reviewed public material does not document a guest/offline-only mode, a mandatory-account point, an age model, or a first-run preference questionnaire. Those should be treated as **unknown**, not absent. [9]

The publicly documented personal-preference layer is narrow but useful: a user can set calorie, fat, carbohydrate, and protein targets in Settings, toggle nutrition display, and edit calculated nutrition before saving. Changing nutrition goals does not automatically refresh the daily-percentage values already shown on saved recipes. This is profile-level nutrition configuration, not evidence of allergy handling, dietary restrictions, household roles, or automatic plan personalisation. [2]

The household boundary is unusually explicit. CookBook says it has no account-linking or family profiles. A household can share one credential, but everyone then has full control over recipes, tags, planner slots, shopping lists, account settings, subscription changes, and in-app purchases; the company recommends separate accounts for privacy and to avoid accidental edits. Separate users can exchange individual recipes as a CB file or QR code, but each keeps separate favourites, tags, plans, and lists. This is shared credential access or one-off transfer, **not** collaborative household data, permissions, or a live shared grocery list across accounts. [1]

**Mealbook lesson:** make the first-run choice explicit: private individual, household with roles, or shared planning only. A proper household should allow member-level permissions, independently owned accounts, shared lists, and clear visibility rules. Never require password sharing to achieve household planning.

## Subscription lifecycle and entitlements

CookBook’s main public upsell is a contextual quota gate. The free tier permits 20 stored recipes, 20 smart imports, and two limited lists. At a limit, it presents monthly or yearly plans; selecting yearly begins a 14-day trial, while monthly starts billing immediately. On plan expiry, content above the free allowances becomes read-only until the user selects a new plan. Importantly, the company says recipe export remains available from the free tier and at the limit. This makes the paywall an expansion of collecting and planning capacity, rather than a data-hostage mechanism. Actual prompt copy, order, conversion paths, and enforcement timing are **untested**. [5]

The cancellation article says users must cancel through the originating Apple App Store, Google Play, or Stripe billing route at least 24 hours before the trial or billing period ends. It says deleting the app or CookBook account does not cancel a subscription, cancellation keeps access through the paid period, and CookBook gives no refund or pro-rated credit when a customer cancels. This is CookBook’s published cancellation position, not a finding about any store’s statutory or platform refund process. [3]

A restore action in the app is documented as relinking an App Store or Google Play plan to the currently signed-in CookBook user; CookBook says it can be used after lost access or to move a licence to a different CookBook account. That potentially sensitive cross-account outcome was not tested and should not be assumed to be frictionless. Public policy also names store payments, Stripe, PayPal, and RevenueCat, but does not expose a complete purchase-state model or prove which processors are used for every country or transaction. [4] [9]

**Mealbook lesson:** copy CookBook’s exit-safe export and clear expiry rule, but improve it with an in-product entitlement screen: subscription origin, renewal date, trial end, restore eligibility, what will lock, and a direct cancellation handoff. Keep finance-provider policies distinct from the product’s own cancellation statement.

## Recipe data, privacy, sync and portability

CookBook says collections are private by default, other users cannot browse them, and signing into the same account on another device exposes that collection. It also states that recipe data uses cloud services, so “private” does not mean phone-only. A shared PDF, CB file, link, or code may be viewed by the recipient and passed on. Its guidance asks users to retain creator and source information where available and makes clear that saving a recipe does not transfer copyright. These are privacy and rights positions; the actual access-control implementation, encryption, link expiry, and source-attribution field behavior are **untested**. [8]

For portability, CookBook documents a ZIP export of every recipe in Text, PDF, or its native CB format. It says the files contain recipe content, but export images are not embedded: they point to CookBook image servers. The company warns that account deletion removes those server images permanently, so a destination importer must obtain them before deletion. This is a material lock-in and migration caveat even though text-level export exists. The reviewed documentation does not establish export coverage for meal plans, shopping-list history, imported originals, AI conversations, nutrition targets, or source metadata; those items remain **unknown**. [7]

The account-delete flow requires an explicit typed confirmation and says all recipes and data are permanently erased; active subscriptions must be cancelled separately. The privacy policy gives a general purpose- and legal-obligation-based retention statement, rather than a specific backup-deletion or account-erasure timetable. Thus the user-facing product promise is permanent erasure, but the public evidence does not establish how quickly replicas, logs, payment records, or legally retained data are purged. [6] [9]

For nutrition, CookBook estimates calories, macros, and other values from recipe ingredients, permits manual changes, and bases default daily targets on USDA and FDA recommendations for a 2,000-calorie diet. It does **not** identify the underlying ingredient/nutrition database in the public help page reviewed. Defaults based on public recommendations are not evidence that USDA or FDA supplies CookBook’s recipe-level nutrition data. Offline recipe access and conflict handling are also undocumented in the reviewed public sources, despite the documented cloud sync. [2] [8]

**Mealbook lesson:** export a self-contained, documented archive that includes locally usable images and structured recipes, sources, plans, lists, goals, and audit timestamps. State deletion and backup-retention windows precisely. Make nutrition provenance, confidence, serving assumptions, and manual overrides visible rather than treating an estimate as an opaque fact.

## Technical evidence: disclosed versus unknown

CookBook publicly supports iPhone/iPad, Android, and web access. That is compatibility and distribution evidence only; it does **not** identify the mobile framework or establish that Android and iOS are separately native, Flutter, React Native, or another implementation. The founders’ page describes one co-founder as a software engineer with experience across mobile apps, cloud systems, APIs, and AI, but supplies no architecture detail. [10] [11]

The strongest public stack evidence is CookBook Co.’s privacy policy. Under “hosting and backend infrastructure” it names AWS; Firebase Hosting, Cloud Storage, App Engine, Cloud Firestore, Cloud Functions, Cloud Storage, and Realtime Database. The policy also names Firebase Authentication, Analytics, Performance Monitoring, Crashlytics, Notifications, Dynamic Links, RevenueCat, Cloudflare, Google Tag Manager, Zendesk, and SendinBlue; it lists Stripe, PayPal, Apple, and Google payment handling. These are **publicly disclosed providers or service categories**, not a verified architecture diagram. The policy alone does not prove which product data resides in which database, whether every listed service is enabled today, client-side language/framework, internal APIs, deployment topology, or runtime. [9]

No official engineering post, public CookBook engineering repository, or job page identifying a client framework was located in the six targeted public searches. The appropriate technical conclusion is therefore: cloud and vendor disclosures exist; framework, private database design, runtime, observability configuration, and current per-platform parity are **unknown**. Do not infer them from the presence of Android, web sync, AI, or cloud marketing.

## Upsell and public go-to-market pattern

CookBook places the paywall at moments of demonstrated archive/import/list value, then reinforces it with a yearly trial and read-only overage state. Its public comparison article, published July 7 and updated October 23, 2026, is a long-form search-oriented acquisition asset: it compares six recipe managers, calls CookBook its own top all-in-one choice, acknowledges the 20-recipe and shared-account limitations, and repeatedly directs readers to try the free allowance, app stores, and web app. That is an observable owned-content/SEO pattern, not evidence of organic rankings or performance. [10]

The company also exposes a public roadmap and support contact. Its privacy policy discloses a mailing-list/newsletter category and SendinBlue marketing automation, plus Google/Meta advertising and remarketing-related services. Those disclosures support the existence of email and marketing tooling, but they do **not** prove email cadence, creator campaigns, referral economics, ad delivery, spend, CAC, or conversion. No public affiliate, referral, ambassador, or creator-revenue program was found in the targeted sources. [9] [11]

**Mealbook lessons:**

- Gate convenience and scale only after a user has imported enough value, while preserving full export and a useful free core.
- Use truthful comparison content that admits constraints, but differentiate with household permissions, offline-resilient ownership, and complete video-import provenance rather than unsupported “AI” breadth.
- Treat household collaboration, data portability, deletion transparency, and nutrition provenance as product trust features that CookBook leaves incomplete or undocumented.
- For Android-first execution, publish clear platform and offline guarantees. Do not let framework claims substitute for observable behavior.

**References**

[1]: https://help.cookbookmanager.com/en/article/how-can-i-share-my-whole-cookbook-with-my-partner-or-family-1vynqdy/ "CookBook help: share whole CookBook with partner or family"
[2]: https://help.cookbookmanager.com/en/article/how-do-i-automatically-calculate-nutritional-information-9f49v7/ "CookBook help: automatically calculate nutritional information"
[3]: https://help.cookbookmanager.com/en/article/how-do-i-cancel-my-cookbook-subscription-gwr4e7/ "CookBook help: cancel subscription"
[4]: https://help.cookbookmanager.com/en/article/how-do-i-restore-my-cookbook-purchase-1s6opsg/ "CookBook help: restore purchase"
[5]: https://help.cookbookmanager.com/en/article/what-happens-when-i-reach-the-free-limits-11q03a/ "CookBook help: free limits"
[6]: https://help.cookbookmanager.com/en/article/how-do-i-delete-my-cookbook-account-1kdjx4/ "CookBook help: delete account"
[7]: https://help.cookbookmanager.com/en/article/how-do-i-bulk-export-or-back-up-all-of-my-recipes-1o6k9my/ "CookBook help: bulk export or back up recipes"
[8]: https://cookbookmanager.com/recipes-and-copyright "CookBook recipes privacy and copyright"
[9]: https://www.cookbook.company/policies/privacy "CookBook Co. Services privacy policy"
[10]: https://cookbookmanager.com/post/best-recipe-manager-apps "CookBook: Best 6 Recipe Manager Apps in 2026"
[11]: https://cookbookmanager.com/about "About CookBook"
