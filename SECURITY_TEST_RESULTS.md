# Fletch_Game Security Test Results

Date: 2026-11-06. CI results for this PR appear in the GitHub checks
tab; the checks observed at PR creation are recorded in the audit
session's final report.

## scripts/pages-test.js - rewritten and new tests

Contact flow (execute against the page's inline script through the
qa-harness, same strictness as the previous GitHub-issue tests):

1. Contact discloses the email flow and collects no name/email; no
   github.com reference remains anywhere on the page.
2. Empty/whitespace fields expose the associated errors, mark
   aria-invalid, and focus the first invalid field.
3. A Unicode/delimiter/emoji draft is prepared locally, exactly
   URL-encoded into a mailto: URL (protocol mailto:, address
   officialgogocompany@gmail.com, subject prefixed
   "[Arrow Out! Contact] ", exactly two params, no hash), with no
   popup, navigation or network transmission.
4. Editing or invalid resubmission hides any stale prepared link and
   resets it to the form action.
5. Length limits: 101-char subject, 5001-char message and a 650-emoji
   message (oversized once encoded) are rejected; a lone surrogate
   does not crash and encodes as U+FFFD.
6. No-JavaScript fallback is a native required GET mailto form with
   only subject/body fields, a noscript explanation, no-referrer
   meta, and no window.open.

Regression tests:

7. No visitor-facing GitHub links remain on about.html,
   contact.html and privacy.html (no github.com/parya5103 substring,
   no github.com hyperlink) while the "GitHub Pages" hosting
   disclosure stays as text in the privacy policy.
8. Privacy policy describes the email flow ("nothing is sent until
   you press send"), keeps the roster-removal and provider-side
   retention disclosures, and makes no GDPR/DPDP certification claim.
9. Unchanged suites: About catalogue counts, local-link existence
   (now skipping mailto: links), duplicate-ID checks, service-worker
   precache/version checks, inline-JS syntax validation.

## Verification performed during the audit (outside CI)

- The inline contact script was executed against a simulated DOM:
  submit handler behaviour, URL construction, encoding, length caps,
  stale-draft hiding and error states were all exercised and matched
  the assertions above (two cosmetic mismatches in the simulation were
  polyfill artifacts of '+'-encoding, confirmed as correct under
  Node's real URL implementation).
- All new regex assertions were run against the final HTML files:
  50/50 checks passed.
- GitHub-link greps: contact.html and about.html contain zero GitHub
  references; privacy.html retains only infrastructure text mentions
  (GitHub Pages, GitHub Actions sender) with no hyperlinks.

## Not verified (honest gaps)

- No real browser/device test in this environment: the mailto link
  was not opened in an actual email client (Gmail/Apple Mail
  pre-fill behaviour assumed from standard mailto semantics).
- Whether every Android browser's GET-mailto fallback works without
  JavaScript is not testable here; the noscript text also offers the
  direct email address as a manual alternative.
- The gogo-website synced copy updates only after the upstream merge
  plus sync run; the live arrowout/ pages were not checked.
