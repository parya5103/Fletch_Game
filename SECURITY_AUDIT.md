# Fletch_Game (Arrow Out!) Security Audit

Date: 2026-11-06. Scope: parya5103/Fletch_Game (Arrow Out!, published
at gogocompany.in/arrowout/ and synced into gogo-website). Part of the
GoGo Company cross-repo security hardening audit. Severity scale:
Critical / High / Medium / Low / Informational.

## Findings

### FL-01 (High) - Contact form routed visitors to public GitHub issues
- Files: contact.html (form action, fallback link, noscript text),
  about.html (FAQ), privacy.html (contact description, security and
  requests sections).
- Behavior: the entire contact flow submitted to
  https://github.com/parya5103/Fletch_Game/issues/new. Issue text,
  and the visitor's GitHub username, would become public on submit.
  The page itself disclosed this, but it is the wrong support channel:
  the official GoGo Company contact channel is email.
- Impact: visitors were pushed to publish support requests publicly;
  privacy questions had no non-public route; the repo URL was exposed
  to every visitor, inviting spam and abuse of the tracker.
- Fix: the form now prepares an email draft for
  officialgogocompany@gmail.com (mailto link built locally with the
  same validation: subject maxlength 100, message maxlength 5000,
  whitespace rejection, 7000-char encoded-URL cap). The noscript
  fallback is a native GET mailto form. All issue links and
  issues-as-support text were removed from contact.html, about.html
  and privacy.html.
- Test: scripts/pages-test.js - contact flow tests rewritten for the
  mailto draft; new regression test asserts no visitor-facing GitHub
  links remain on about/contact/privacy.

### FL-02 (Medium) - GitHub-privacy-statement links tied visitors to the GitHub flow
- File: contact.html, privacy.html.
- Behavior: docs.github.com privacy-statement links were presented to
  visitors to explain the (removed) issue submission flow.
- Fix: removed with the flow they described. Kept: the honest
  infrastructure disclosures - GitHub Pages hosting, the GitHub
  Actions daily-push sender, and provider-side retention (Supabase
  backups or GitHub logs) - which describe how the game actually
  runs and contain no account/repository links.

### FL-03 (Low) - Search-engine description advertised the issue tracker
- File: contact.html meta description ("The form opens a pre-filled
  GitHub issue").
- Fix: description updated to the email draft flow.

## What was intentionally retained

- privacy.html's plain-text mentions of GitHub Pages hosting and the
  scheduled GitHub Actions push sender: these are factual
  infrastructure disclosures required for honest privacy reporting,
  not visitor-facing repository links.
- README, developer documentation, workflows and CI (not scanned by
  the visitor-facing link test).

## Posture notes (no change needed)

- The contact page collects no name or email field and never sends
  data anywhere without the visitor opening their own email app -
  the "nothing is sent until you press send" property is now
  regression-tested.
- The inline script uses URLSearchParams encoding, blocks oversized
  drafts, and never calls fetch or window.open.
- Remaining risk: email is not end-to-end encrypted; the page already
  tells visitors not to include passwords or payment details.
