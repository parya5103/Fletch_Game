# PR #8: public pages and project knowledge review — 2026-10-18

## Scope and evidence

This is the page-review checkpoint at commit `676f654`. The later user-requested notification replacement supersedes notification descriptions and final test counts here; see [local reminder audit](local-reminders-2026-10-18.md) and the canonical README for the final architecture.

Reviewed [PR #8](https://github.com/parya5103/Fletch_Game/pull/8), original head `61b1833fcc7056ef848395345107bbaeb350e8b1`, against current merged main `bc6af03745dda5402b18d5bb2ecf97fe3257dcd9`. Main is an ancestor of the PR. Fixes stay on its existing `adsense-readiness-pages` branch; no game generator, controller, renderer, save schema or notification-provider implementation changed.

No tracked `KNOWLEDGE.md`, `knowledge.md`, `AGENTS.md` or separate canonical agent guide was found in main, the PR or repository history. The existing [README](../README.md) is the canonical project overview; it was updated in place. This dated report records review evidence.

Seven merged PRs were listed. Detailed recent inspection covered actual diffs, implementation, audit reports and CI conclusions for:

| PR / commit | Verified current decision |
|---|---|
| #4 `262f8cd`, merge `c942eb2` | Snapshot validation, durable v1 migration, production-code independent solver and state/audio/PWA regressions; worker v31 |
| #5 `eb43f11`, merge `f57374c` | 20→600 real campaign paths, camera/cached drawing, legacy geometry preserved; worker v32 |
| #6 `d2a18fa`, merge `5050142` | Immediate Home saves, interrupted completion, UTC rewards/onboarding, serialized opt-out and sender cleanup/privacy; worker v33 |
| #7 `f326359`, merge `30887b8` | Rectangular viewport, square puzzles, 5 board themes/17 arrow cosmetics, atomic purchases/audio recovery; worker v34 |
| Main `bc6af03` | Screenshot/test-log refresh; recorded browser evidence, not a universal release guarantee |
| Unmerged #8 `61b1833` and review fixes | Public page/navigation changes; Contact precached in v35, review bytes use synchronized v36 |

Earlier #2's account/cloud-sync proposal is not the current implementation: current Supabase use is notification subscriptions only. This is not a claim of complete line-by-line review of every older PR.

## Findings and disposition

Original locations below refer to `61b1833`; linked source locations describe the corrected implementation. No Critical finding was established.

| Severity | Original finding / evidence | Minimal correction |
|---|---|---|
| **High — fixed** | `contact.html:67`, `:81`, `:146`, `:180`: optional name/email were inserted into the issue URL and immediately sent to GitHub by `window.open`, while the page said nothing left the device until final issue submission. A user could disclose an address in a public issue without a specific warning. | Removed name/email collection. [Warnings](../contact.html#L62) describe URL transmission, history/logs, public usernames/issues and lack of private support. Prepare stays local; an explicit same-tab link transfers text. Privacy copy agrees. |
| **Medium — fixed** | `contact.html:119`, `:157`, `:164`, `:168`: missing `aria-invalid`, unbounded encoded URLs/possible `encodeURIComponent` failure, retained stale draft after edits or invalid submissions, and a honeypot path claiming delivery without sending. No-JS GET included an unrelated honeypot and used a new tab. | [Validation](../contact.html#L106) sets associated errors/focus, trims and bounds fields, uses URLSearchParams (including malformed UTF-16), caps the complete URL at 7000, and clears stale links. Removed the honeypot and popup-dependent path. Native required GET fallback has only title/body and an immediate-transfer warning. No delivery claim. |
| **Medium — fixed** | `about.html:42`, `:48`, `:55`, `:59`, `:65`: unsupported every-release/pre-live browser testing assurance; failure-dialog behavior, coin sources and the existing demo hint were described inaccurately. Offline/storage claims lacked prerequisites. | [About](../about.html#L41) describes actual CI and selected historical browser automation, without physical-device certification; corrects failure/rewards/demo behavior and offline/storage prerequisites. Catalogue counts were already correct in original PR #8 and were independently verified. |
| **Medium — fixed** | `privacy.html:40`, `:45`, `:64`, `:78`, `:87`: Contact transmission timing was omitted, “never leaves” ignored explicit Share, future advertising/consent/access promises lacked implementations, and the public issue route could invite sensitive privacy identifiers. Subscription lifetime was unspecified. | [Privacy](../privacy.html#L39) distinguishes local saves from Share/Contact, discloses actual subscription retention/failed deletion, states that no ad/consent system exists, and makes the public-only support limit explicit. No invented private endpoint or legal certification. |
| **Low — fixed** | Public-page long repository URLs overflowed 320px; reproduced in actual Chromium before correction. | Link [wrapping](../about.html#L21) on About/Contact/Privacy; all three now fit 320/390/1280px. |
| **Low — fixed** | README lacked recent operational/save/shop knowledge and retained an obsolete “current” audit pointer. `scripts/browser-update-test.js` assumed a v34 target and would be stale for PR #8. | Canonical [README](../README.md#maintenance-knowledge-canonical-project-notes) updated without removing useful history; release fixture derives versions and accepts an older commit. New page regressions run in CI. |

## Claim and navigation audit

- `js/game.js`, `scripts/density-test.js`, `scripts/validate-levels.js`: 1000 campaign levels, 12×12→65×65, 20→600 actual paths, head-ray collision rule, generation validation and deterministic daily boards. Current PR does not alter them.
- `js/main.js`, `js/ui.js`, `js/storage.js`: 3 hearts/free hints, explicit failure/retry dialog, undo/restart, timed bonuses on levels ending in 5, UTC daily/login rewards, achievements/statistics and conditional local persistence. Shop catalogue/previews/purchases corroborated by cosmetics tests. No account/payment code or advertising SDK exists; `Ads` is a five-second demo plus placeholder interface.
- `index.html`: visible About/Contact/Privacy links from Home and Settings; actual browser navigation exercised all six. How-to-play links to About; public pages cross-link and return to the game. Local link targets and duplicate IDs checked automatically.
- `js/pwa.js`, `.github/workflows/notify.yml`: explicit opt-in subscription, Supabase roster, browser push provider, five fixed IST slots; no age-based expiry. Opt-out attempts deletion/unsubscribe; sender removes HTTP404/410 endpoints. Reset/clear-local-data cannot guarantee roster deletion. No real subscriber traffic was used.
- `sw.js`: Contact was already in PR #8's core precache, and original v35 matched `js/pwa.js`. Both now use v36 to replace already-cached preview pages. The update tests exercise actual cache activation/reload and exact save preservation. No reset or migration was introduced. Standalone pages do not register a worker themselves.

## Checks actually executed

Local environment: Ubuntu 26.04, Node 24.21.0, shared Preview Chromium 140, QA-only Playwright 1.64.1 outside the checkout. No production dependency or lockfile added.

| Command (repository working directory) | Observed result |
|---|---|
| `node scripts/ci-test.js` | Passed, exit 0 (“All CI checks passed”) |
| `node scripts/regression-test.js` | 15/15 passed, exit 0; existing caught manifest-mock fallback warning |
| `node scripts/audit-test.js` | 15/15 passed, exit 0 |
| `node scripts/density-test.js` | 6/6 passed, exit 0 |
| `node scripts/cosmetics-test.js` | 6/6 passed, exit 0 |
| `node scripts/pages-test.js` | 10/10 passed, exit 0; includes inline JS syntax, links and cache/version invariants |
| `PR8_SOURCE_REF=61b1833fcc7056ef848395345107bbaeb350e8b1 node scripts/pages-test.js` | Original PR baseline: 2 passed / 8 failed, exit 1; regression comparison against corrected requirements, not eight separate severity findings |
| `NODE_PATH=/tmp/pr8-qa/node_modules node scripts/browser-pages-test.js <output>` | 6/6 browser groups passed, exit 0, zero page exceptions; keyboard/errors, Unicode/delimiters, local draft, explicit same-tab/no-popup/no-referrer navigation, stale draft/URL bound, scripts-disabled native required GET, mobile layouts and six Home/Settings links |
| `NODE_PATH=/tmp/pr8-qa/node_modules node scripts/browser-update-test.js <output>/update-v34 bc6af03745dda5402b18d5bb2ecf97fe3257dcd9` | 3/3 groups passed, exit 0: real v34→v36, 10-minute HTTP-cache bypass/cache cleanup/save equality; offline three-page navigation and returning save; missing APIs/blocked-storage gameplay |
| Same update command, `<output>/update-v35 61b1833fcc7056ef848395345107bbaeb350e8b1` | Same 3/3 groups passed, exit 0, v35→v36, zero page exceptions |
| `for f in js/*.js sw.js scripts/*.js; do node --check "$f" || exit; done` | Passed, exit 0 |
| `git diff --check` | Passed, exit 0 |

`<output>` was `/home/vercel-sandbox/workspace/output/pr8-review`. Reports, logs, mobile screenshots and the Contact accessibility tree are retained there. GitHub navigation was fulfilled locally before network; no real issue was submitted. Initial browser QA detected the real 320px overflow (fixed); subsequent harness corrections handled standard native CRLF line endings, missing optional favicon responses and the explicit `/index.html` return URL. Final browser run passed.

**Reused evidence:** downloaded actual original PR #8 [CI run 39112708181](https://github.com/parya5103/Fletch_Game/actions/runs/39112708181). Its full validator passed **1000/1000 campaign levels ×3 orders and 366/366 daily seeds**, zero failures, 91.004s. Generator/rules/controller/validator/harness inputs remain byte-identical; this was not a new local full sweep. Current PR CI reruns the mandatory full validator on push. CI success conclusions for PRs #4–#7 were also inspected; previous browser-engine results remain historical.

## Knowledge verification and limitations

README now records architecture, generation/collision invariants, real counts, UI/shop, v2 schema and v1 durable migration, legacy geometry/undo limits, PWA cache/update rules, actual Contact behavior, opt-in notification configuration/privacy, secrets **names only**, testing/CI and agent safety rules. Recent history is dated and separates merged work from unmerged #8. Old changelog versions remain explicitly historical. Relative documentation paths, linked fragments, source-path references, catalogue counts, save fields and current cache versions were checked against files. No dedicated Markdown linter exists.

Unverified or unresolved:

- Current stable Chrome/Edge/Samsung Internet, Safari and physical Android/iOS devices; installed-app/notification permission UX, screen-reader behavior and full accessibility compliance. Selected Chromium form/keyboard checks are narrower evidence. Earlier Firefox/WebKit results were not rerun here.
- Deployed Supabase RLS/grants/ownership/upsert uniqueness, secret provisioning, real push delivery and provider retention/backups. Repository mocks and client source cannot prove these. Failed opt-out can lose the identifier needed to retry cleanup; no automatic age expiry exists.
- Sensitive support still has no private channel. GitHub account/login/issue submission and provider URL-length acceptance were not exercised against the live service. No-JS fallback has native required/maxlength validation, without JS whitespace/encoded-size checks; it offers a blank-issue link for long drafts.
- Full keyboard/screen-reader puzzle play and multi-tab save reconciliation remain prior technical debt. This review does not certify legal compliance or AdSense approval.

**Recommendation:** Safe to merge the corrected patch when its required CI is green. Original PR #8 required the privacy and factual-copy fixes above. Do not merge or deploy as part of this review.
