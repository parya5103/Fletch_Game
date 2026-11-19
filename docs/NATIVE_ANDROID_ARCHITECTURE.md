# Arrow Out Native Android Architecture

## Goals
- Keep the installed application ID stable: `in.gogocompany.arrowout`.
- Make new screens and product features additive; avoid putting progression, rendering, storage, and monetization logic in one Composable.
- Preserve offline play and local-first saves.
- Treat web/PWA save import as a versioned migration boundary.

## Module boundaries (package-level today)
The app currently ships as one Gradle module to keep the Android build inexpensive and simple. Keep these package boundaries even before splitting Gradle modules:

| Package | Responsibility | Must not own |
| --- | --- | --- |
| `core/config` | Feature flags and app-wide configuration | UI state or persistence |
| `domain/model` | Game and player data contracts | Android APIs |
| `domain/engine` | Deterministic puzzle rules | Compose, Room, ads |
| `data/local` | Room, DataStore, save migrations | Rendering and game rules |
| `data` | Catalog/repository orchestration | Screen layout |
| `presentation` | Compose screens, navigation, ViewModels | Direct SQL or ad SDK calls |
| `monetization` | Consent and ad adapters | Puzzle/progression rules |

## Adding a feature
1. Add a named switch to `GameFeatureFlags` if the feature needs staged rollout.
2. Define/extend a plain Kotlin model in `domain/model`.
3. Put deterministic rules in `domain`; add unit tests before implementation.
4. Add storage through a repository/DataStore interface. Version migrations; never silently discard unknown legacy fields.
5. Expose state/actions through a ViewModel.
6. Build a small screen/component under `presentation/features/<feature>`; avoid growing the root game screen.
7. Add accessibility, offline, failure-state, and migration tests.
8. Run Android unit tests, debug build, release bundle, and campaign generator validation.

## Settings and save compatibility
- Player preferences live in `NativeSettings` and `SettingsStore`; UI should not create DataStore keys directly.
- Add a default for every new preference so older installs remain compatible.
- Save payload changes must be backward compatible or include an explicit migration.
- Keep the original imported PWA JSON snapshot until every supported field has a tested mapping.

## Release and monetization
- Keep signing material out of the repository and CI artifacts.
- Use test ad IDs by default. Production ad IDs must be supplied through release configuration only after consent, privacy policy, and store disclosures are verified.
- Feature flags default off for unfinished monetization or cosmetic features.
- Keep the Play Store application ID unchanged.
