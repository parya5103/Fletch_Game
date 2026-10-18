# Local reminder replacement — PR #8, 2026-10-18

This is evidence for the additional notification request on `adsense-readiness-pages`, following the public-page review checkpoint `676f654f62721d39a6ee0289debd6de5e769e425`. [README](../README.md) remains the canonical knowledge file. No merge, main push or deployment is part of this work.

## Old flow and observed failure

Inspected current merged main `bc6af03745dda5402b18d5bb2ecf97fe3257dcd9`, actual source and scheduled Actions results:

| Stage in old implementation | Evidence / limitation |
|---|---|
| Settings enable | `js/main.js` saved `settings.notifications` before permission/subscription/roster operations; success meant roster POST succeeded, not delivery. |
| Permission | `js/pwa.js` requested browser permission from the toggle. `navigator.serviceWorker.ready`/PushManager created a VAPID subscription; a missing active worker could leave readiness pending. |
| Persistence | Public Supabase client POST-upserted `{endpoint,subscription}`; opt-out attempted roster DELETE plus browser unsubscribe. Client code cannot establish actual deployed RLS/grants or delivery. |
| Scheduling | `.github/workflows/notify.yml` had five fixed daily IST slots, not configurable inactivity. GitHub cron can drift. It required private VAPID/service-role secrets and a working roster. |
| Delivery | [Run 39113568999](https://github.com/parya5103/Fletch_Game/actions/runs/39113568999), main, 2026-10-18: **failure**, runtime output `Push failed (status unknown).` and `done: 0 sent, 1 failed.` Eight latest listed scheduled runs failed; an older success conclusion alone does not prove any notification was delivered. |
| Worker/click | `sw.js` consumed remote push payloads and validated click destinations; no independent local inactivity scheduler existed. |

**Diagnosis:** the directly observed failing boundary is the scheduled sender's Web Push send, after obtaining a nonempty roster; the UI could not observe or prove that delivery. Its sanitized logs do **not** expose the underlying exception/provider response. An exact credential, malformed-subscription, network or provider root cause cannot be established from available evidence. No live roster/user identifiers or private keys were inspected, and no test send targeted real subscribers. Do not turn a likely explanation into a documented fact.

The replacement removes that external sender/roster dependency and provides the explicitly supported local fallback. It does not claim to repair or certify the old provider deployment.

## Options checked before choosing

Official pages retrieved successfully (HTTP200) on 2026-10-18:

| Option | Free/static compatibility | Decision |
|---|---|---|
| A: Notifications API + worker display | Native APIs have no service charge. HTTPS/permission/browser support required; worker display is not a durable scheduler. Page timers are throttled and may stop entirely. | Use only as optional display while the page can execute. |
| B: genuine remote Web Push / FCM | [Firebase pricing](https://firebase.google.com/pricing) lists Cloud Messaging among no-cost products and Spark without a payment method. [FCM Web client](https://firebase.google.com/docs/cloud-messaging/js/client) requires HTTPS, a worker, project/VAPID configuration and token lifecycle. [Sending](https://firebase.google.com/docs/cloud-messaging/server) needs a trusted server environment; static GitHub Pages cannot itself execute secret-bearing timed sends. | Not selected. A messaging transport's free price does not establish a configured, reliable, permanently free personalized inactivity scheduler/backend. No Firebase project/SDK/backend/card was introduced. |
| C: in-game fallback + optional local system display | Uses the existing static host/worker, no external account, keys, subscription roster, server, cron, SDK or billing. | **Selected.** Honest 60/90/120-minute inactivity checks in an executing page; no closed/suspended-browser guarantee. |

Restrictions checked against [MDN Notifications](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API), [inactive-tab timers](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout#timeouts_in_inactive_tabs) and [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API). Mobile display uses `registration.showNotification`, not the desktop-only Notification constructor. No worker timers or periodic-background-sync promise was added.

## Final architecture and compatibility

- `js/reminders.js` is the **one** reminder scheduler. Main initializes it once and opens its screen from Home → Settings → Notification & reminder settings; UI delegates status. Default off, existing `settings.notifications` retained as the in-game preference.
- User chooses60/90/120 minutes (default90). Elapsed timestamps, a30s page check and focus/visibility checks handle delays; pointer/keyboard activity starts another period. Reload starts a fresh inactivity period. Nothing schedules after the page stops executing.
- Visible page: non-modal, silent in-game banner. Hidden but executing page: optional native display with explicit system opt-in and granted permission. Browser/OS suspension, battery restrictions and notification suppression remain outside this implementation's guarantee. Returning visible uses an in-game fallback when system display was unavailable/rejected.
- Web Locks serialize per-origin system requests; a persisted per-period claim prevents reload/tab duplicates. Without locks or local storage, only in-game display is supported. Explicit tests share the lock and a60s persisted cooldown. Disabling stops future requests and closes local notifications; pending lookup/permission/display results cannot re-enable the setting. Already handed requests may need asynchronous closure.
- Permission is never requested on load/status/timing. Only the Allow button invokes it, once per saved prompt marker. Dismissed/denied permission is not re-prompted automatically; browser site settings can change it. Unsupported/insecure/missing-worker cases retain usable in-game controls and explanatory status.
- Save key/schema remain `arrowOut.v2`, `v:2`. Additive sanitized settings: `reminderMinutes`, `systemNotifications:false`, `notificationPrompted:false`. Original coins/levels/purchases/settings/snapshot geometry remain intact. `arrowOut.reminders.v1` stores activity and `arrowOut.reminderClaims.v1` separately stores delivery/test claims; only code holding the Web Lock writes claims, preventing stale activity flushes from erasing another tab’s marker; enabled activity writes are throttled to15s. Reset clears both records; no migration or progress reset is required.
- Existing browser push subscriptions are looked up **only to unsubscribe** at startup/controller changes. No new PushManager subscription or Supabase request exists. Cleanup failures expose Retry and browser-settings guidance. Historical server records cannot be deleted by local storage clearing or browser unsubscribe.
- Worker/display versions both **v38**, with `js/reminders.js` and Contact in the precache. Cache/update/save behavior remains intact. No remote push handler survives. Click URL validation remains; reminder clicks focus an existing game window, including `index.html`, without resetting its puzzle. External/malformed destinations fall back safely.

### Components removed and exact changed files

Notification replacement after the page checkpoint:

- Deleted `.github/workflows/notify.yml` (scheduled sender and its `web-push` dependency install).
- Added `js/reminders.js`, `scripts/reminders-test.js`, `scripts/browser-reminders-test.js`, and this dated audit.
- Changed `js/pwa.js` (remove remote push/Supabase/VAPID configuration and methods; version), `js/main.js` (remove old toggle orchestration, initialize/open/reset local module), `js/ui.js` (delegate status), `js/storage.js` (additive preferences), `sw.js` (precache/version, remove remote push, preserve safe click/focus).
- Changed `index.html` (settings screen/banner, new script, self-only connect CSP) and `css/styles.css` (responsive controls/banner).
- Changed `scripts/ci-test.js`, `scripts/regression-test.js`, `scripts/audit-test.js` (replace obsolete push-specific assertions, retain click/save/PWA coverage), `scripts/cosmetics-test.js`, `scripts/browser-update-test.js` (assert old settings individually plus additive defaults), `scripts/pages-test.js` and `.github/workflows/ci.yml` (new privacy expectations/reminder gate).
- Changed canonical `README.md`, `about.html`, `privacy.html` and the earlier `audit/pages-review-2026-10-18.md` (explicit historical checkpoint marker). Contact's reviewed implementation is unchanged by this replacement.

The page-checkpoint's additional files/changes are listed in [its report](pages-review-2026-10-18.md) and commit676f654.

## Actual verification

Environment: Ubuntu26.04, Node24.21.0, shared Preview Chromium140. QA-only Playwright1.64.1 lives outside the checkout; application dependencies remain zero. Synthetic local data/origins only. Browser reports/screenshots are under the task's `output/pr8-review/`.

| Check actually run from repository | Final observed result |
|---|---|
| `node scripts/ci-test.js` | Passed, exit0; game/security/save/click/catalogue smoke checks |
| `node scripts/regression-test.js` | 15/15 passed, exit0; caught manifest-mock warning remains |
| `node scripts/audit-test.js` | 12/12 passed, exit0; obsolete sender cases replaced/removed because sender was removed |
| `node scripts/reminders-test.js` | **18/18 passed**, exit0; exact60/90/120-minute boundaries, enabled/Off, default/granted/denied/dismissed, no startup/repeated prompt, missing APIs/insecure/locks/storage, simultaneous tabs, rejected display/fallback, scope mismatch, pending permission/lookup/display, legacy cleanup/retry, reset, stale cross-tab activity writes and save compatibility |
| `node scripts/density-test.js` | 6/6 passed, exit0 |
| `node scripts/cosmetics-test.js` | 6/6 passed, exit0; original settings retained plus safe new defaults |
| `node scripts/pages-test.js` | 10/10 passed, exit0; updated privacy expectations plus Contact/navigation/cache invariants |
| `NODE_PATH=/tmp/pr8-qa/node_modules node scripts/browser-reminders-test.js <output>` | **7/7 groups passed**, exit0 on final v38 (`reminders-final-v38`); responsive320/390/1280px UI, actual default/denied/granted values (grant via CDP), simulated prompt dismissal, actual native showNotification/getNotifications, rate limit, clock-advanced90-minute visible/simulated-hidden behavior, synthetic click through actual worker focusing existing puzzle, Off/close/reload save equality, missing Notification fallback; zero page exceptions/external page requests |
| `NODE_PATH=/tmp/pr8-qa/node_modules node scripts/browser-update-test.js <output>/update-final-v38 0446bd293f48348dcd42a85250584470d0692a13` | **3/3 passed**, exit0; real v37→v38 after claim-write hardening, update/cache cleanup, save/offline/fallback checks |
| `NODE_PATH=/tmp/pr8-qa/node_modules node scripts/browser-update-test.js <output>/update-final-v34 bc6af03745dda5402b18d5bb2ecf97fe3257dcd9` | 3/3 passed, exit0; real v34→v37 with10-minute HTTP cache, all old settings/progress preserved plus additive defaults, offline pages/new module, blocked-storage/missing-API gameplay |
| Same update command, `<output>/update-final-v36 676f654` | 3/3 passed, exit0; real v36→v37, same save/offline/fallback checks |
| `NODE_PATH=/tmp/pr8-qa/node_modules node scripts/browser-pages-test.js <output>/pages-final` | 6/6 groups passed, exit0 against final v37 pages; native/no-JS Contact, keyboard/encoding, layouts and navigation; zero page exceptions |
| `python3 /tmp/pr8-qa/check-docs.py` | Passed, exit0;19 local documentation links/fragments, referenced source paths and v38 synchronization. Deleted workflow references are explicitly historical. No configured Markdown linter. |
| `for f in js/*.js sw.js scripts/*.js; do node --check "$f" || exit; done` and `git diff --check` | Passed, exit0 |

The v34/v36→v37 checks precede final claim-write hardening; the fresh v37→v38 check covers its update. Earlier v34/v35→v36 checks and page-review results remain historical; final page/browser and syntax/documentation outcomes are also recorded in the task validation record. Full1000×3/366-daily solver evidence from original PR CI is reusable for unchanged generation/rules; the final required PR CI reruns the complete validator against the final commit. Check that commit's CI before merging.

Initial QA failures were retained in the task validation record: fixture syntax, strict old-settings object equality incompatible with additive defaults, and browser clock advance before an asynchronous manual-test action released its Web Lock. The last was corrected by awaiting the test's completed status before advancing the clock; final native browser groups pass. The first v38 browser attempt also hit a test-clock rollback on reload; the QA clock now persists monotonically through reload and all seven groups passed on rerun. No background delivery was inferred from a mocked permission or a successful request.

### Final claim-write hardening

After CI39115515298 passed on0446bd2, manual inspection identified that a stale activity/pagehide write outside the delivery lock could erase the shared delivery/test marker. Activity and claims now use separate records; only lock-holding delivery/test code writes claims. The added18th regression forces stale reads during pagehide and verifies both delivery and cooldown claims survive. Worker/display v38 replaces cached v37 preview bytes. This is a fixed implementation finding, distinct from the unavailable underlying exception in the old remote sender.

## Remaining limits and operator steps

1. **No closed-browser scheduler.** A browser that is closed/suspended/unloaded cannot run these checks. Android background/installed-PWA OS display, real OS notification clicks, native permission-prompt UX and physical Android/iOS behavior are unverified. Only the documented Chromium automation ran; current Chrome/Edge/Safari/Samsung and device release tests remain outstanding.
2. **Historical failure cause remains partly unknown.** The scheduled sender's0/1 failure is proven; its underlying provider/credential/transport exception is not available. No secret provisioning, Supabase RLS/retention or old delivery was certified.
3. **After owner-approved merge/release:** verify the old workflow is absent/disabled on main; remove unused `PUSH_VAPID_PRIVATE_KEY` / `SUPABASE_SERVICE_KEY` secrets and delete the old Supabase send roster under the operator's policy. Local unsubscribe does not erase provider backups/logs. These remote deletions were not performed here. Until merge/update, old main/installed copies can retain old behavior.
4. Browser-local game progress still has no multi-tab reconciliation. Web Locks prevent duplicate system reminder requests; they do not make game save writes transactional across tabs. Public-only support remains; never post private notification identifiers in GitHub issues.

**Recommendation:** Safe to merge the corrected PR when required CI is green, with the local-only scheduling limit disclosed and historical provider cleanup handled by the owner. No legal/AdSense/device certification is implied.
