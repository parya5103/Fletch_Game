# Fletch_Game Security Remediation

Date: 2026-11-06.

## Changes in this PR

1. contact.html: GitHub-issue contact flow replaced with an email
   draft flow to officialgogocompany@gmail.com.
   - Form: method="get" action="mailto:officialgogocompany@gmail.com"
     with subject (maxlength 100) and body (maxlength 5000) fields,
     unchanged required/aria error handling.
   - JavaScript draft preparation identical in strictness to the old
     version: whitespace rejection, per-field errors, focus on first
     invalid field, URLSearchParams encoding, 7000-character encoded
     URL cap, stale-draft hiding on input, no fetch, no window.open.
   - Subject prefixed "[Arrow Out! Contact] " so mailbox filtering is
     possible.
   - Honest status text: the draft is prepared locally; opening the
     link opens the visitor's email app; nothing is sent until the
     visitor presses send there.
2. about.html: bug-report FAQ now points to the Contact page/email;
   offline FAQ reworded (no GitHub-account reference).
3. privacy.html: contact description rewritten for the email flow;
   "keep details out of public issues" advice reworded for email;
   docs.github.com privacy-statement link removed (the GitHub flow it
   described no longer exists). Infrastructure disclosures kept.
4. scripts/pages-test.js: contact tests rewritten for the mailto flow
   with equal strictness (same validation, encoding and error
   assertions, now against a mailto: URL); privacy assertions
   updated to the new text; mailto: added to the link-existence skip
   list; new regression test forbidding visitor-facing GitHub links
   on about/contact/privacy while requiring the GitHub Pages text
   disclosure to remain.
5. SECURITY_AUDIT.md and SECURITY_TEST_RESULTS.md added.

## Not changed

Game code, service worker, push roster, ads integration, page
filenames and the PWA precache list (sw.js still precaches
contact.html/about.html/privacy.html under the same names).

## Owner actions

- Merge this PR after CI passes (never auto-merge by policy).
- After merge, the gogo-website "Sync product apps" workflow copies
  the fixed pages into gogocompany.in/arrowout/ (manual run or 06:15
  IST cron).
- Optional: monitor officialgogocompany@gmail.com for the new
  "[Arrow Out! Contact]" subjects.

## Rollback

Revert the merge commit. The old GitHub-issue contact flow returns
from history; prefer fixing forward, since the rollback restores a
public-issue contact channel.
