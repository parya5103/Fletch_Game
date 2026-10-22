# Security Policy

## Supported Versions

Arrow Out! deploys from the main branch as a single static snapshot; the
hosted site always runs the latest release. Players receive updates
automatically through the in-game service-worker update banner, so only
the latest release receives security fixes.

| Channel | Supported |
| ------- | --------- |
| Latest release on main | Yes |
| Older snapshots / cached versions | No - reopen the game to update |

## Reporting a Vulnerability

Preferred: use GitHub's private vulnerability reporting ("Report a
vulnerability" on this repository's Security tab).

If that is not available, open a regular GitHub issue WITHOUT exploit
details or payloads and note that you have a security report; the
maintainer will follow up privately.

Please include:

- The page or URL involved
- Browser and version, and whether the game was installed (PWA) or a tab
- Step-by-step reproduction instructions
- The impact you observed

What to expect:

- Acknowledgement within a few days
- Confirmed issues are fixed in the next release
- Manual testing is welcome; please do not run automated load or scan
  tools against the hosted site

## Scope

- The game is a client-only static app: no accounts, no server-side
  logic, no payments. Progress and settings live only in the player's own
  browser storage and never leave the device.
- Cheating by editing one's own local save data is possible by design and
  is out of scope - there is no competitive leaderboard or server economy.
- Repository CI secrets are never embedded in client code.
