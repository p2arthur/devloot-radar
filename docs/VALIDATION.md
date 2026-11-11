# Monorepo validation

Verified locally November 10, 2026, using Node 24.22.2.

| Check | Actual result |
| --- | --- |
| Clean install | `npm ci` passed; no reported audit vulnerabilities at this run |
| Client/server typecheck | `npm run check` passed |
| Behavior/integration tests | `npm test`: 90 passed across 12 files |
| Production client build | `npm run build` passed; initial JS approximately 128 KB gzip |
| Built browser journeys | 10 primary/regression plus 6 voting/chart scenario groups passed |
| Responsive layout | 390/768/1440px, both DevLoot themes, no horizontal page overflow |
| Local collector integration | Temporary SQLite, mocked ingestion, actual loopback authenticated collector → public adapter reads; exact daily/weekly points preserved |
| Mutation boundary | No scan/pause/save/dismiss HTTP routes on either consolidated service |
| Standalone runtime | Archive extracted into a temporary directory; `npm ci --omit=dev`, API/static/deep links/404, weekly demo points, avatar/fonts, and collector factory/SQLite checks passed |
| Studio exclusion | No studio UI, video generation/editing/publishing modules, media dependencies or sibling runtime imports |
| Production operations | No deployment, production variable edits, live ingestion process, retention change or data reset |

The local preview can read the existing authenticated live catalog without running the engine. Live collector history deployment, the required hourly coverage evidence, and a measured daily cohort remain public-product launch gates. Passing mocked/temporary-database integration tests does not close them.

Generated screenshots, detailed JSON results, release archives, and old incremental sibling patches stay in ignored `artifacts/`; they are local build products. The source includes reproducible scripts and CI. The packaged collector changes are directly included under `server/src/collector` and need no sibling patches at runtime.
