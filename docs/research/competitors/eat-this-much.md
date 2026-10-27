# Eat This Much — public product, lifecycle, data, and monetization audit

**Audit date:** 27 October 2026
**Evidence standard:** public first-party pages only. No account, checkout, purchase, cancellation, refund, restore, deletion, or offline flow was executed. “Documented” means publicly described, not hands-on verified.

## Onboarding, preferences, and household boundaries

The public guide presents an email-led account start, then current physical measurements, diet preferences, and nutrition requirements. It says measurements are saved to a private profile and that preferences can later be edited. This documents account-led personalization, not guest planning. The pages reviewed do not document guest access, signup verification, profile-field validation, or a pre-account generated-plan preview. [2] [6]

Preferences include nutrition profiles, meal-type settings, diet presets, ingredient-keyword exclusions, recurring foods, extra servings, and day-specific targets. Changes apply on the next regeneration, rather than overwriting an existing plan. Enforcement quality is untested. [2]

Household support has two separate models. “Family meal” is a serving scaler: it changes grocery quantities but does not model different nutrition targets for the other people. A newer, explicitly beta, account-linking feature lets separate users link accounts, copy plans, combine premium grocery lists, and switch whom they manage. Its safety boundary is weak by design: the company warns that **all linked accounts have full control over each other’s meals and settings**. Linked free and Premium accounts are supported, but combined groceries require Premium users. The documents do not say whether linked people can see body measurements, credentials, or all personal data, nor do they document unlinking or role-based permissions. [2] [3]

## Subscription lifecycle and entitlements

Free includes the single-day planner, custom foods/recipes, preferences, food logging, and granular targets. Premium unlocks weekly generation, groceries/pantry, leftovers, family scaling, saved plans, and print/email outputs. Public pages frame this as a capability gate. The prior verified subscription page lists a 14-day trial, 30-day guarantee, and recurring monthly/annual plans; store price catalogs are not a current web price card. [1] [2]

The terms say a trial card is not charged until the trial ends, subscriptions then continue automatically, and pre-end cancellation retains the trial. The cancellation article, updated 22 March 2025, says paid cancellation stops renewal at the billing-period end; trial cancellation prevents a charge. This supports end-of-period expiry, not immediate loss of access. Renewal notices, grace, failed-payment, reactivation, offers, and precise entitlement timing are untested. [4] [6]

The company directs billing/refund help to support, and its published plan promises the 30-day guarantee. For online card payments, the terms name Stripe as the current third-party processor and say sensitive card data is not stored by Eat This Much, apart from the last four digits. The deletion article adds an important channel distinction: deleting an account does **not** cancel an iOS or Android store subscription; that must be cancelled separately. There is no first-party restore-purchase instruction, app-store refund procedure, cancellation-screen walkthrough, or data-retention schedule for expired subscriptions in the pages reviewed. Those flows are therefore untested/unknown, not negative capability findings. [1] [5] [6]

## Recipes, imports, nutrition data, sync, export, and deletion

Personal recipe capability is documented, not merely implied. Users can create custom foods and custom recipes; recipe nutrition is calculated from its ingredients; and the generator can use custom recipes. A personalized version of a catalog recipe is used in future generation, but does not automatically replace existing plan instances. The help documentation also describes deleting a custom food or recipe. [2] [11]

The 21 August 2026 Recipe Clipper notice says the extension reads only the opened page locally; nothing is sent until “Review in Eat This Much.” It then sends source/canonical URL, HTML, and an optional selected image for editable import. A saved recipe retains its source URL and becomes account data. Pending data is temporary, expires after two hours, and is removed after save or storage clearing. Captured recipe content is not sent to ad companies, and source-page ownership is unchanged. This supports consent-forward web capture, not direct YouTube extraction. [8]

The terms define uploads broadly as “User Content” and grant Eat This Much a perpetual, irrevocable, worldwide, sublicensable license to it. They do not make an equally explicit statement that a user retains ownership of a saved custom recipe. Treat this as contract language, not evidence that a recipe is publicly shared or reused in production. Separately, the company’s partner-API page claims more than 7,000 curated recipes and aggregated nutrition data. That is a company claim about its API offering, not independent validation of consumer database coverage, nutrient accuracy, or licensing provenance. [6] [9]

Grocery lists sync to selected plan dates when viewed; manual edits stop automatic updates until reset. Premium users can print/email plans and lists, browser-print a PDF, and export groceries to Instacart. The privacy policy describes support-led access, portability, and deletion requests. Cross-device conflicts, offline use, local caching, recipe/plan export, import rollback, and actual saved-content deletion remain unknown. [2] [7]

Deletion is exposed on web and mobile and is described as “complete” and “irreversible”; support can process it too. The older general privacy policy says data can be retained for contractual, legal, and legitimate-business purposes, while the terms say non-identifiable information is not deleted after account termination. It does not disclose backup deletion timing. [5] [6] [7]

## Public technical-stack evidence

Technical claims should be narrow. The privacy policy, updated 3 December 2020, names Cloudflare, Google Analytics, Facebook tracking/remarketing, Amplitude, Stripe, Bugsnag, Crashlytics, Groove, SendGrid, Google Tag Manager, and Apple HealthKit. These are disclosed processing relationships, not confirmation of current deployment or a backend, database, host, event schema, or app framework. It says an updated processor list is available on request. [7]

The public stores demonstrate iOS/iPad and Android availability/compatibility only. They do **not** establish whether the apps are native, hybrid, React Native, Flutter, or otherwise. No official engineering post, public company code repository, or career listing establishing a framework, runtime, database, synchronization protocol, AI model, or offline architecture was identified in this limited public review. The partner API’s seven-day nutrition-data cache limit is a partner contract condition, not evidence about consumer-account storage. [9] [12] [13]

## Upsell moments and observable marketing

The public funnel puts capability comparisons beside use: the guide’s “What’s in premium?” prompt follows free signup, while the free-versus-Premium section contrasts the current-day planner with automated week, groceries, pantry, leftovers, and family functions. This is a high-intent upgrade frame rather than an intrusive hard stop documented at a particular screen. Exact paywall placement, trial checkout copy, localized offers, and upgrade timing are untested. [1] [2]

The public 1,500-calorie page offers a full sample week, calculator and calorie/diet variants, then account and import-plan prompts. This shows a calorie-and-diet landing-page pattern, not rankings, traffic, conversion, ad spend, or CAC. The guide points to a company tutorial video; no public referral, affiliate, creator-payout, or influencer program was identified in the selected sources. [2] [10]

The privacy policy says registration or purchase may add an email address to promotional mailing lists, while administrative messages cannot be opted out of. It also discloses Google/Facebook remarketing and targeting/analytics cookies. That is evidence of email and retargeting capability/disclosure, not evidence of campaign volume, audiences, performance, or spend. [7]

## Implications for Mealbook

- Make guest preview versus account-bound planning and saved health/preference data explicit. Preserve edits without surprise regeneration. [2]
- Treat household collaboration as permissions: separate viewing, edits, groceries, profile visibility, and billing from the documented “full control” model. [3]
- For web or YouTube imports, use per-import consent, source attribution, review-before-save, bounded temporary storage, and a video-specific policy. [8]
- Show billing channel, trial end, renewal, cancellation, restore, refund owner, expiry, and deletion-versus-billing separation before support is needed. [4] [5] [6]
- Sell weekly execution—groceries, leftovers, prep, household coordination—not generic macro tracking. Use calorie/diet content without unsupported performance claims. [1] [10]
- Publish current processors, retention, export, deletion, offline behavior, and technical boundaries without architecture speculation. [7]

## Material unknowns

Unknowns include guest mode, verification, offer eligibility, restoration, per-channel refund/cancellation execution, grace, post-expiry access, backup deletion timing, self-service export, offline/conflict behavior, unlinking, and the client, backend, database, hosting, and model stack. They are not inferred from features or marketing.

**References**

[1]: https://help.eatthismuch.com/help/what-do-i-get-for-subscribing "Eat This Much Premium subscription help"
[2]: https://www.eatthismuch.com/how-to/ "The Complete Guide to Eat This Much"
[3]: https://help.eatthismuch.com/help/family-members-account-linking-beta "Family Members Account Linking"
[4]: https://help.eatthismuch.com/help/can-i-cancel-my-subscription-at-any-time "Can I cancel my subscription at any time?"
[5]: https://help.eatthismuch.com/help/deleting-your-account-4 "Deleting your account"
[6]: https://www.eatthismuch.com/terms "Eat This Much Terms of Service"
[7]: https://www.eatthismuch.com/privacy-policy "Eat This Much Privacy Policy"
[8]: https://www.eatthismuch.com/recipe-clipper-privacy-policy "Recipe Clipper Privacy Notice"
[9]: https://www.eatthismuch.com/partner-api "Eat This Much Partner API"
[10]: https://www.eatthismuch.com/diet-plan/1500-calorie "1500 Calorie Meal Plan"
[11]: https://help.eatthismuch.com/help/how-to-add-custom-foods "How to add/delete Custom Foods and Recipes"
[12]: https://apps.apple.com/us/app/eat-this-much-meal-planner/id981637806 "US Apple App Store listing for Eat This Much"
[13]: https://play.google.com/store/apps/details?id=com.eatthismuch&hl=en_US&gl=US "US Google Play listing for Eat This Much"
