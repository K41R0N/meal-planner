# Meal Planner product context

This is a personal meal-prepping and recipe-book app, primarily used on Android. The user has approved an offline-first web/PWA client now and native Android later. They want a recipe bank they can keep using, a manageable saved week, groceries calculated from that week, and calories/macros logged from actual consumed portions.

The shortest useful journey is: paste/share a YouTube recipe video, review the extracted recipe and uncertainty, save it, choose it for a weekly prep plan, and shop the derived list. A newly saved recipe must remain readable and usable offline. Online import is explicit and requires network and source access. Captions are not universally available, and this workspace has observed YouTube bot gates; pasted creator text is the fallback. No media downloads or ingredient-based nutrition estimates.

The source foundation is K41R0N/meal-planner. The private Storyteller Tactics repository supplies card-layout and interaction inspiration only; its paid content and illustrations must not be copied. Keep the existing warm, herb-green card identity. This phase is refinement plus a new import surface, not a brand or framework replacement.

All recipes, edits, plans, grocery checks, targets and food logs remain private on the device with JSON backups. Imported source evidence is reviewed and retained locally. Server extraction does not create accounts or cloud synchronization. Nutrition with an unspecified serving basis remains unknown in per-serving totals. Users own tags, categories, meal roles and suitability criteria; no prescribed diet or invented food-storage safety.

The core app must continue working without inference services. The later Ollaya/Laya organization adapter is optional and not hosted yet. Multi-user accounts, Android APK distribution, always-on self-hosted inference, cross-device sync and public release require later work. Do not publish, push to the user's GitHub or replace the existing deployment during this phase.
