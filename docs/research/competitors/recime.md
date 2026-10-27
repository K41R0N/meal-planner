# ReciMe: lifecycle, data, stack, and growth audit

**Evidence date:** 2026-10-27
**Author:** Manus AI

ReciMe is a mature direct comparator for an Android-first meal-prep product because it publicly combines social-recipe capture, an individual recipe library, manual weekly planning, and auto-populated groceries. This audit extends the prior verified market report rather than re-litigating general downloads or headline pricing. It uses public pages only; no account was created, no recipe was imported, no payment was started, and no cancellation or deletion flow was executed. Therefore, behaviour labelled **untested** is not evidence that the capability is absent.

## Account, onboarding, profile, and household boundary

The public funnel is deliberately short: the homepage says “Try now for free” and directs visitors to Google Play. Its Help Center separates **Getting Started** by iOS and Android, alongside Billing & Subscription and Account Management. [2] [10] The public material does not disclose whether an anonymous or guest session can import, plan, or shop before registration. It also does not reveal the registration screen, identity providers, progressive-onboarding sequence, or whether an existing account is required to sync. Those are **untested/undocumented**.

The privacy notice describes both registration and use of the service, and says that collected information *may* include username/password, a social-site authentication token where an integrated third-party account is involved, and profile content such as photographs. It also lists voluntarily supplied food preferences, lifestyle and cuisine choices, nutritional goals/preferences, dietary information, and grocery-shopping patterns. [1] This is useful evidence that the product is designed around an individualized preference profile, but it is not proof that each field is currently requested, used in recommendations, or mandatory in onboarding.

The account boundary looks personal rather than household-centric. The same notice says accounts should not be shared and that each user is expected to have their own account. [1] No public help or marketing page reviewed documents a household, shared pantry, shared meal plan, delegated shopping permissions, family profile, or conflict-handling model. For Mealbook, call this a genuine product opening: use named household roles and clear visibility controls, rather than treating a shared grocery list as sufficient collaboration.

## Subscription lifecycle and entitlement surface

The documented free entitlement is clear enough to design against: free users retain core Meal Plans, Smart Grocery Lists, Cookbooks, and grocery checkout, but can import up to five recipes per week. ReciMe Plus provides unlimited imports, nutrition calculation, measurement conversion, export/print, guided cooking, and cookbook/handwritten-recipe scanning; the official help article says it starts with a seven-day trial. [3] The import cap is the most concrete, high-frequency upgrade trigger. The precise screen, timing, copy, and whether an exhausted import is saved as a draft are **untested**.

The two public store pages add only partial lifecycle detail. Google Play says subscriptions automatically renew monthly or annually at the price displayed on the payment screen. Apple exposes $29.99, $39.99, and $59.99 ReciMe Plus in-app purchases, but the listing does not map those prices to terms. [4] [5] A current term-by-term U.S. price, trial eligibility conditions, trial-end reminder, grace period, downgrade date, and entitlement-expiry behaviour cannot be verified from these sources.

The Help Center explicitly positions its Billing & Subscription section as covering trials, subscriptions, and cancellations, but the public collection page did not expose step-by-step cancellation, refund, restore-purchase, or store-switch instructions. Its Account Management collection describes login, password, and email management, not account erasure. [2] [8] [9] A full purchase funnel was not checked. Refund authority, restoration across Android/iOS, the treatment of unused trial time, and what happens to Plus-only exports or data after lapse should all be treated as **unknown**, not assumed.

For Mealbook, ship this area as a product system rather than support debt: show plan, store, renewal date, and entitlement source in-app; provide restore purchase and a cancellation destination; preserve user data on expiry; and make the free/paid boundary intelligible before an import is consumed. That directly addresses the conversion and trust moment without copying ReciMe’s opaque parts.

## Recipe ownership, privacy, nutrition, sync, offline, and deletion

ReciMe publicly claims mobile import from social sources including YouTube, with ingredients and method steps saved in a personal Cookbook; its official overview also says recipes can be organized with custom tags, edited, cloud-synced, and scaled. [4] [6] The beta browser product documents importing/adding recipes, viewing recipes and Cookbooks, and editing recipes, but says Meal Plans and Grocery Lists are still coming soon on web. [7] This supports a personal, cross-device recipe-library model, not a full responsive-web meal-prep workflow.

The import and nutrition claims are feature claims, not audits of accuracy. ReciMe markets per-recipe calories, protein, carbohydrate, and fat, but its public pages do not identify a nutrition database, ingredient-matching rules, calculation provenance, allergen handling, source-rights policy, or a user-facing ownership/licensing distinction between original and imported third-party recipes. [4] [6] Likewise, no public source establishes offline import, offline planning, cache behaviour, sync latency, edit conflicts, or recovery from duplicate imports. A policy reference to browser/app caches is not proof of a supported offline mode. [1]

The privacy policy says it can collect shopping lists, recipe interactions, grocery transactions, device and usage data, and the preference data described above. It names Google Analytics in connection with a website cookie/tracking tag, allows marketing emails with an unsubscribe route, and says payment-card details are handled directly by third-party payment processors rather than stored or collected by ReciMe. [1] It also permits service-provider, affiliate, partner, legal, and international disclosures; it says data may be stored in Australia, the United States, and the user’s country of residence. [1] These are policy disclosures, not evidence of the app’s live SDK inventory, database, or payment architecture.

On control, the policy promises working functionality to download and delete information in an account at no charge, while saying other records can be retained for disputes, agreements, security, technical, or legal reasons. It says personal information is retained only as long as necessary or legally required. [1] This is a meaningful public commitment, but the exact export format, scope of an “account” deletion, completion timeline, backup retention, subscription-record treatment, and effect on imported recipes were not tested. Mealbook should make export format and account-deletion consequences explicit, with a human-readable retention schedule and a deletion receipt.

## Technical evidence: what is known, and what is not

Platform compatibility is not a framework disclosure. ReciMe’s live store listings establish Android availability and iPhone/iPad compatibility; Apple also lists Apple-silicon Mac compatibility. [4] [5] They do not establish React Native, Flutter, Kotlin Multiplatform, native Android architecture, or a shared-code strategy.

The only concrete implementation lead located is a now-expired public job-board reproduction dated 2026-02-12 of a ReciMe iOS Developer posting. It describes iOS/iPadOS development with Swift and predominantly SwiftUI, and lists Xcode Cloud, CI/CD pipelines, automated-testing frameworks, RESTful APIs, Firebase, Alamofire, Git, and MVC/MVP/MVVM among its technical skills. [11] This is credible directional evidence for an iOS hiring requirement, but not proof that every listed tool is deployed in production, its version, its Android equivalent, or the server-side stack. There is no basis here to name ReciMe’s private database, runtime, cloud provider, recipe-parsing pipeline, analytics SDKs, or purchase vendor.

For implementation benchmarking, the useful conclusion is restrained: ReciMe has explicit public evidence of native iOS/SwiftUI hiring and public device compatibility. Everything else remains **unknown**. Mealbook should independently select an Android-first architecture and capture the operational evidence ReciMe does not expose: import observability, deterministic nutrition provenance, background-sync conflict handling, encrypted local data, and reproducible entitlement state.

## Upsell and public growth pattern

ReciMe’s public upsell pattern starts with a “Try now for free” homepage CTA and the five-import weekly free limit, then names a broad Plus bundle. [3] [10] The website robots file disallows crawl access to `/subscribe/`, `/paywalls/`, `/signup/`, and `/quiz/`; that indicates protected or intentionally unindexed funnel routes, not that a particular paywall journey or quiz is shown to every user. [12] No paywall screen was viewed.

Creator acquisition is explicit. The Ambassador Program says applicants receive a link and code, can track referrals in a dashboard, and are paid monthly for as long as a referred audience member remains subscribed. It welcomes creators in social, recipe-development, nutrition/wellness, family-cooking, podcast, writer/blogger, and video categories, including YouTube; its “1,000+ affiliates” figure is a company claim, not independently validated. [13] This is a referral/affiliate channel with recurring-revenue framing, not evidence of paid-media spend or CAC. The privacy policy permits promotional/newsletter contact and opt-out, but no ReciMe email sequence was observed. [1]

For Mealbook, recruit creators around demonstrable creator credit and usable recipe provenance, not just a generic affiliate code. Add referral attribution that survives web-to-Android handoff, a creator-facing import-quality feedback loop, and transparent commission terms. Separately, build indexable public recipe and planning education pages while keeping private user libraries, account data, and payment routes out of search.

## Lessons and gaps for Mealbook

1. Match the baseline: fast YouTube/social import, editable personal recipes, a reliable weekly calendar, and a grocery list that updates from the plan.
2. Beat the documented gap: pair macro targets with explainable portions, recipe selection, batch-prep sessions, leftover carry-forward, and ingredient-overlap logic. ReciMe only publicly proves per-recipe nutrition and manual planning, not goal-constrained planning. [3] [6]
3. Make responsive web a first-class meal-prep surface. ReciMe’s web beta supports library work, but public documentation still puts plans and groceries on mobile. [7]
4. Treat privacy as a product feature. Show what dietary and grocery data are used for, offer downloadable structured exports, and separate delete-recipe, delete-profile, and delete-account outcomes.
5. Build subscription reliability into the Android-first release: visible limits, purchase restoration, simple cancellation guidance, expiry-safe data retention, and no ambiguity about price term or trial renewal.

**References**

[1]: https://www.recime.app/privacy-policy "ReciMe Privacy Policy"
[2]: https://recime.app/help/en "ReciMe Help and Support Center"
[3]: https://recime.app/help/en/articles/11596201-is-there-a-free-version-of-the-app "Is there a free version of the app"
[4]: https://play.google.com/store/apps/details?id=com.recime.app&hl=en_US&gl=US "ReciMe Recipes and Meal Planner on Google Play US"
[5]: https://apps.apple.com/us/app/recime-recipes-meal-planner/id1593779280 "ReciMe Recipes and Meal Planner on the US App Store"
[6]: https://recime.app/help/en/articles/11594896-what-is-recime "What is ReciMe"
[7]: https://recime.app/help/en/articles/11626084-can-i-access-recime-using-a-computer "Can I access ReciMe using a computer"
[8]: https://recime.app/help/en/collections/13466075-billing-and-subscription "Billing and Subscription Help Collection"
[9]: https://recime.app/help/en/collections/13466074-account-management "Account Management Help Collection"
[10]: https://www.recime.app/ "ReciMe Home"
[11]: https://jaabz.com/jobs/163230-ios-developer-swiftui "iOS Developer SwiftUI Full-time Remote at ReciMe"
[12]: https://www.recime.app/robots.txt "ReciMe Robots File"
[13]: https://recime.app/ambassador-program "ReciMe Ambassador Program"
