# MealPrepPro: lifecycle, data, technical and commercial audit

**Audit date:** 2026-10-27
**Evidence standard:** Public first-party site, help centre, linked legal pages and store listings only. No account, trial, purchase, cancellation, restore, sync, import or deletion flow was executed. Behaviors below are vendor-documented claims unless marked **untested**.

MealPrepPro’s public material describes an account-led subscription meal-planning product. Its shared privacy policy says an account is needed and records name, email, encrypted password, account-creation/privacy-consent timestamps, meal-plan type and subscription status. The policy is dated **14 April 2021**, so it is disclosure evidence, not proof that every listed practice remains current in 2026. [1]

## Onboarding, profile and household boundary

The public onboarding path is only partly observable. The website sends “Try For Free” traffic into an app deep link and the 2021 policy says an account is required. This supports an account-first journey; it does **not** verify guest browsing, preregistration screens, mandatory fields or platform differences. A current ongoing free plan is likewise undocumented. [1] [2]

Profile exposes Account, Authentication, subscription management, export and deletion paths. The product documents a “person” model: add a partner/family member, give each an avatar and calorie value, include people in a plan, or add them to a specific meal. This shows per-person calories and meal inclusion, but not per-member diet, allergen, macro, privacy, permissions or independent settings. [3]

The household access model has a meaningful boundary. The January 2025 help article directs an account holder to add an email login, then tells the partner/family member to sign in on another device using the same email and password; after a short sync, both apps “should” show the same plan and shopping. This is a shared-login/shared-plan workflow, not proof of roles or separate household accounts. It conflicts with the older Terms, which say accounts are individual, non-transferable and must not be shared. The public materials do not resolve enforcement. Sync success, conflict handling and revocation are **untested**. [4] [5]

## Subscription, access and recovery

The public offer is a free download followed by a single seven-day full-access trial that converts to auto-renewing subscription if not cancelled. The contact page says cancelling in the first six days avoids a day-seven charge. It describes annual plans as country-variable and its popular plan as about $5/month; this is marketing, not a normalized price card. The earlier dossier remains the source for ambiguous store price mapping. No ongoing free functional tier is evidenced. [6] [7]

Cancellation is routed to the original payment rail. Help directs iPhone/iPad/Mac users to Apple subscriptions or an in-app Manage Subscription shortcut, Android users to Google Play or its shortcut, and web-card buyers to MealPrepPro billing. The restore article documents “Restore Existing Subscription” and an Apple-password prompt, but does not explain Android, card-web restores, cross-store migration, household entitlement sharing, or eligibility conditions. These are entitlement instructions, not confirmation that restoration succeeded in a current app. [8] [9]

Refund responsibility is mixed. A January 2025 help page directs App Store purchasers to Apple’s problem-report process and says web purchases use Stripe, for which support can issue a refund. It omits a decision window, web SLA, Google refund route, pro-rating, chargebacks, trial re-eligibility, grace period, failed-payment handling and post-cancellation/refund access. The 2018 Terms contain older iOS-specific renewal language, including a 24-hour cut-off and no refund for unused iOS term, but should not be treated as a current Android/web contract without reconfirmation. [10] [5]

Deletion and subscription are deliberately separate: the delete-account article asks users to cancel Apple, Google Play or Stripe billing before choosing Profile > Account > Delete Account. The privacy policy similarly says account deletion will not cancel an Apple subscription. No public source specifies whether an expired or cancelled account retains read-only access, what entitlement features are gated, what happens to plans at expiry, or whether deletion blocks a later restore. [11] [1]

## Recipes, nutrition, privacy and data portability

MealPrepPro publicly claims a **My Recipes** area where a person can add or import personal recipes and add them to a plan. Store release notes also refer broadly to imports from social media, websites and cookbooks. This is enough to treat a personal recipe library as a claimed capability, but not to confirm direct YouTube-video parsing, the supported import formats, source attribution, duplicate handling or who owns an imported recipe. The Terms license the company’s recipes, meal plans, video and other product content; they do not publicly define ownership, licensing or deletion rules for a user’s personal/imported recipes. [12] [5]

Nutrition is claimed at recipe and plan level in the store listings, including calories/macros and goal-adapted planning. Neither listing nor legal material discloses the nutrition-data supplier, branded-food database, calculation method, revision policy, tolerance, or whether user imports receive verified nutrition. Treat nutrition accuracy and any database coverage as **unknown**, not as a tested promise. [13] [14]

There is a documented, but narrowly described, data-export control. Users can go to Profile > Account > Export my data. A 2020 help article says the export covers basic account information and “any other information we store”; another says the stored examples include account information, plan type and calories. No format, delivery channel, time limit, recipe completeness, grocery-list coverage, import-source provenance or machine-readable portability is specified. This should not be presented as a proven full recipe export. [15] [16]

The privacy disclosure says age, gender, weight and height used in calorie calculation are stored locally on-device and inaccessible to Nibble Apps, while basic account/plan information is stored through Firebase. It also says it does not collect specific dietary requirements or health/biometric information, a distinction that should be validated against current onboarding before making a production privacy comparison. Deleting an account is available in-app or through support; the policy says it will remove selected newsletter records and support-helpdesk correspondence typically within 30 days. It does not publish an account-record deletion SLA, backup-retention policy, granular recipe deletion behavior, or device-local-data cleanup steps. [1] [11] [16]

## Technical evidence, not inference

The only specific technical stack evidence found is the vendor’s dated privacy policy. It names Firebase Authentication and Firebase Realtime Database for MealPrepPro accounts/login, Google app analytics, and Google sync/storage functionality for Android. For iOS it names Apple Sign-In plus Apple services used to store certain preferences, recipe favourites and plan information across devices/iTunes accounts. It also names Groove for support, Mailchimp for newsletters and Branch for referral measurement/deep links; the current help page separately identifies Stripe for web payments. These are disclosed service relationships, not a penetration-test result or an architecture diagram. [1] [10]

The App Store and Google Play establish iOS/iPadOS and Android distribution/compatibility, respectively. They do **not** establish whether the client is native, cross-platform or which framework, backend runtime, cloud region, API, database schema, nutrition provider, observability system or offline cache it uses. No such implementation claim is made here. A public engineering blog, source repository, current technical job specification and subprocessors list beyond the dated shared policy were not located in this scoped review; each must remain **unknown** rather than inferred from app behavior. [13] [14]

## Upsell and public marketing pattern

The observable conversion moments are the app-directed “Try For Free” CTA, the seven-day full-access trial and day-seven renewal, plus a public web card-payment path. A payment-gated feature screen, trial reminder, conversion email, restore prompt or cancellation save-offer was **not** viewed, so no claim can be made about exact paywall timing, copy, feature gates or funnel completion. [2] [6] [8]

Public growth surfaces are modest but legible: a consumer website with support/FAQ and contact pages, an Instagram link, a public help centre that can capture organic problem-led searches, and Branch deep-link/referral measurement disclosed in the privacy policy. The same policy describes consented, double-opt-in newsletters delivered through Mailchimp and opens/clicks analytics, but this is a Nibble Apps-wide policy rather than confirmation of a current MealPrepPro campaign. It does not substantiate a current creator, affiliate, referral-reward or paid-media program; no ad-spend, CAC or conversion claim is supportable. [1] [6]

## Implications for Mealbook

- Make a useful guest preview explicit. MealPrepPro’s account-first public posture leaves a clear chance to show sample plan, grocery outcome and import result before a trial without implying a free tier.
- Build true household roles: separate profiles, per-person restrictions and macro goals, explicit invite/revoke controls, and a shared-grocery conflict policy avoid the ambiguity of shared credentials.
- Treat paid lifecycle as a product surface. State trial eligibility, price/term/currency, renewal date, cancellation effect, restore rules, refund owner and post-expiry read/export rights in one current place.
- Make recipe trust portable: label imported versus owned recipes, show source provenance and nutrition confidence, support direct YouTube only if it is genuinely parsed, and offer documented export/delete scopes.
- Publish a living security/subprocessor and data-retention record. It is more credible than expecting users to reconcile older legal pages with newer support articles.

**Confidence:** High for the help-centre instructions and dated policy/terms text; medium for product-flow interpretation because it is not hands-on tested; low for current technical architecture and all unlisted entitlement/data-lifecycle behaviors.

**References**

[1]: https://nibbleapps.com/privacy/ "Nibble Apps Privacy Policy"
[2]: https://www.mealpreppro.com/about "MealPrepPro About"
[3]: https://help.mealpreppro.com/help/add-a-partner-to-your-plan "MealPrepPro Add more people to your plan"
[4]: https://help.mealpreppro.com/help/how-to-share-your-meal-plan-with-your-partner "MealPrepPro Sharing your meal plan"
[5]: https://nibbleapps.com/terms/ "Nibble Apps Terms Of Service"
[6]: https://www.mealpreppro.com/contact "MealPrepPro Contact"
[7]: https://help.mealpreppro.com/help/how-does-the-subscription-work "MealPrepPro subscription and free trial help"
[8]: https://help.mealpreppro.com/help/how-do-i-cancel-my-subscription "MealPrepPro cancellation help"
[9]: https://help.mealpreppro.com/help/how-do-i-restore-my-subscription "MealPrepPro restore subscription help"
[10]: https://help.mealpreppro.com/help/how-do-i-get-a-refund "MealPrepPro refund help"
[11]: https://help.mealpreppro.com/help/how-do-i-delete-my-account "MealPrepPro delete account help"
[12]: https://help.mealpreppro.com/help/add-your-own-recipes "MealPrepPro add and import recipes help"
[13]: https://apps.apple.com/us/app/mealpreppro-planner-recipes/id1249805978 "MealPrepPro Planner and Recipes US App Store listing"
[14]: https://play.google.com/store/apps/details?id=com.nibbleapps.meal_prep_pro&hl=en_US "MealPrepPro Meal Planner Google Play listing"
[15]: https://help.mealpreppro.com/help/how-can-i-request-my-information "MealPrepPro request your information help"
[16]: https://help.mealpreppro.com/help/what-information-is-used-or-stored-by-mealpreppro "MealPrepPro information stored help"
