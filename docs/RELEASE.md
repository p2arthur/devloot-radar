# DevLoot Radar — internal preview release

Prepared November 10, 2026, America/Vancouver. **The local MVP implementation is complete. Public launch is not approved or ready.** Nothing was provisioned or deployed; no production variables, collector scheduling, database retention, or stored data were changed.

## Monorepo release — client and collector only

Current packaging uses `client`, `server`, and `shared` npm workspaces. `server/src/collector` contains the ingestion engine and authenticated read endpoints, including 24h/7d history. It has no studio UI, video generation/editing/publishing modules, Remotion/FFmpeg/media dependencies, or studio mutation routes. The public API and collector remain independently started processes; production ownership is unchanged. The original studio/core working trees are untouched by this extraction.

`npm ci`, workspace typechecks, 90 tests across 12 files, and production client build passed. All 16 browser scenario groups passed. The isolated runtime package passed production-only dependency install, workspace resolution, client/API/history/deep-link/404 checks, avatar/font license checks, and collector factory/SQLite checks without starting ingestion. GitHub source publication is authorized as public `p2arthur/devloot-radar`; it does not deploy either service. Current runtime archive: `artifacts/devloot-radar-monorepo.tar.gz`, generated locally and ignored by git. Earlier QA evidence/patch references below are historical local artifacts; the collector changes are now included directly in this source repository.

## Correction: demo links and live preview

Publication follow-up: README now leads with clone → `npm ci` → `npm run dev`; [the Railway guide](RAILWAY.md) documents the existing ingestion owner, authorized domain/token lookup, server-only local setup, verification and troubleshooting. A clean staged-source checkout outside the workspace, without `.env` or sibling repositories, passed installation, typecheck, 94 tests and production build. Its actual `npm run dev` served the six-hour discovery page with the explicit demo notice and no page errors. The original workspace was then restored to live mode. Evidence: `artifacts/qa/dev-startup/clean-source-results.json`. No deployment or production setting was changed.

Development startup follow-up: `npm run dev` now supervises the API on loopback 4321 and Vite on 4320, waiting for API readiness. API failure, client failure, startup timeout, and occupied-port behavior have regression coverage. The collector remains separately started. Existing live settings are now persisted only in this machine's ignored root `.env`; no production settings changed. Dependency install, typecheck, 94 tests and production build pass. The combined command was started, gracefully stopped (both listeners released), and restarted successfully. Live browser discovery → `meta/astryx` → save → watchlist → reload → remove passed with no page errors; six screenshots cover 390/768/1440px in both themes. Results: `artifacts/qa/dev-startup/results.json`. The read-only catalog returned 662 repositories, 658 usable six-hour and 640 daily measurements, but zero ranked hourly. Live history and sustained coverage gates remain unresolved. This source change has not regenerated the previously packaged release archive.

Fictional demo repository profiles now state that they have no GitHub page instead of linking to nonexistent repositories. The local preview has been switched to authenticated read-only live catalog data (656 repositories at verification), using server-process-only credentials from the existing local configuration. No credentials were copied into source or frontend variables. Live 24h/7d history still reports unavailable; the UI never substitutes demo charts. Typecheck, 43 app tests and production build pass; targeted mode/link/avatar browser evidence is in `artifacts/qa/data-mode/`. The package includes this correction; default unconfigured startup remains explicitly demo.

## Follow-up: seven-day charts and repository avatars

Repository charts now open at 7d, with shorter windows still available. Up to 2,000 exact stored samples are returned for a week; captions expose actual coverage, dates and preserved gaps. Weekly requests are cached separately from daily list previews. Missing weekly capability is explicit and does not disable shorter views. Demo observations spanning a week are fictional authored fixtures only. The avatar follow-up is included: public GitHub owner images with the existing DevLoot pixel fallback.

Authorized sibling scope: `server/trend-store.ts`, `server/trend-routes.ts`, `tests/unit/trend-history.test.ts`. The separate chart read uses existing eight-day retention and does not change the original 26h scoring read. The incremental `artifacts/collector/history-7d.patch` follows `history-route.patch`; both are already reflected in the local sibling, so do not reapply over it. The accompanying hash manifest records the exact before/after sources. No deployment, retention/scheduling changes, production variable edits, or data reset occurred.

Current app checks: typecheck, 43 behavior tests and production build passed. Collector typecheck plus 24 relevant history/service/trends tests passed. All 16 browser scenario groups passed, including default-week/shorter-window switching and recovery to daily history when weekly capability is unavailable. Screenshots cover 390/768/1440px in both themes. Prior performance and live coverage measurements below are baseline evidence, not new live measurements. The live endpoint deployment and hourly/daily coverage gates still apply; weekly reads must additionally be verified against retained real timestamps after a separately authorized deployment.

## Follow-up: browser-local votes and animated chart previews

The user authorized paired 1h/6h metrics, browser-local voting, and animated charts/previews after the initial release candidate. These are implemented; the original exclusions and demo-history-unavailable notes below describe the initial baseline. Current demo mode now serves explicitly fictional observation fixtures, with 1h/6h/24h detail controls and SVG list previews. No demo observations enter live responses. Votes are local, reversible, distinct from saves, and have no shared tally or ranking effect.

History previews request visible rows in validated batches of at most 25 IDs, with four upstream reads at a time and shared per-ID caching. Full Recharts remains lazy. History failure suppression is bounded to 200 IDs / 60 seconds. Current checks: 39 behavior tests, original 10 browser scenarios, and six new voting/chart scenarios, including both themes at 390/768/1440, cross-tab votes, keyboard/reduced-motion behavior, and unavailable-history states. Evidence: `artifacts/qa/votes-charts/`. No collector changes or deployment were performed in this follow-up. The prior live-data launch blockers still apply.

## Delivered

- Discovery with exact Momentum/Growth/Under-the-radar ordering, URL filters, separate unranked baselines, signed/null metrics, freshness aging, and 25-item paging.
- Repository profiles with catalog evidence, safe GitHub/topic links, copy fallback, related topics, and a lazy actual-observation chart with gap breaks and an exact timestamp table.
- One browser-local, versioned, 200-entry watchlist with stable IDs, rename retention, missing records, cross-tab updates, and session fallback when storage is blocked.
- Methodology and current coverage; DevLoot's original palettes, mascot, self-hosted fonts, and font licenses.
- Read-only public API, strict projection/validation, a coalesced 60s catalog cache, bounded delayed fallback, fail-closed authorization, and a 200-entry history cache.
- Fastify serving for deep links and true 404s, escaped metadata and configured-origin canonical/Open Graph tags. Preview HTML remains noindex; robots disallows crawling and sitemap contains no URLs.

## Validation actually run

| Check | Result |
| --- | --- |
| Runtime/dependencies | Node 24.22.2; final `npm ci` passed, 168 packages audited, zero reported vulnerabilities at that run |
| App typecheck | `npm run check` passed |
| App behavior suite | `npm test`: 43 tests across seven files passed |
| Production build | `npm run build` passed |
| Packaged runtime | Extracted into an isolated temporary directory; `npm ci --omit=dev`, startup, API, deep-link, 404 and license-file smoke checks passed; `artifacts/qa/runtime-smoke.json` |
| Collector typecheck | Sibling `npm run check` passed |
| Collector regression scope | History route, existing hosted service, and trend/scoring suites: 24 tests across three files passed |
| Built-app browser QA | Original 10 plus six follow-up scenario groups passed; `artifacts/qa/browser-results.json` |
| Responsive inspection | Four destinations × 390×844 / 768×1024 / 1440×900 × both themes; 24 screenshots, no horizontal page overflow |
| Browser failures and retention | Unavailable history, 503, empty and null-heavy live-style catalogs; blocked/malformed storage, cross-tab sync, renamed/missing IDs; zero/one-point chart; clock-driven metric aging all passed |
| Main journey | Full Growth → 6h → language → repo → evidence → save → watchlist → refresh → remove → browser Back passed against the built app. The live read-only run covered the same flow through removal, plus token/network inspection. |
| Accessibility checks | Tab/Enter/Escape, visible focus, named save actions, reduced motion, chart table and copy failure fallback checked; no claim of a full assistive-technology audit |
| Browser safety | No runtime page errors or unexpected console errors. Expected HTTP 501 history responses and injected 503 test responses are intentional error-state coverage. All observed product requests were same-origin GETs; collector token absent from browser requests/bundle and private studio fields absent from public catalog |
| Asset provenance | Copied design-system and workshop-fonts CSS compared byte-for-byte with the inspected core working tree |

The browser harness reused the installed Playwright/Chromium through `PLAYWRIGHT_MODULE`; no parallel browser stack was installed. Demo and chart-contract screenshots use explicitly fictional observation samples, **not live collector history**. Demo mode does not generate a chart from aggregate deltas.

Final initial JS: **128.27 KB gzip** (target ≤150 KB). Repository chunk: 3.17 KB gzip; lazy chart chunk: 106.27 KB gzip. Discovery requests only near-viewport histories through the batch endpoint; it does not request the full chart chunk. The sampled live public catalog was 435,596 bytes JSON / 111,038 bytes gzip, below the 500 KB compressed review trigger.

The final local run measured **1.212s LCP**, **0.0020 CLS**, and a maximum recorded interaction-event duration of **40ms**. These are not field p75 values.

The final mobile lab measurements are recorded in `artifacts/qa/performance.json`: Chromium headless, 390×844, DPR 1, touch/mobile, 4× CPU slowdown, 1.6 Mbps down / 750 Kbps up, 150 ms latency, cache disabled, loopback built demo. An initial loading-container/footer shift of ~0.52 CLS was corrected before the final run. This is a local lab sample, not field LCP/CLS/INP or a p75 claim. Developer usability sessions and real deployment-region API latency remain unmeasured.

## Live coverage investigation

Only authenticated GETs were made. Credentials stayed in process memory. `artifacts/qa/coverage.jsonl` contains aggregate public measurements, not raw private diagnostics or a database export.

| Check (UTC / Vancouver PST) | Public / tracked | Usable 1h | Usable 6h | Usable 24h | ≥90m cohort hourly coverage |
| --- | --- | --- | --- | --- | --- |
| Nov 10 19:30:33 / 11:30:33 | 656 / 656 | 238 | 647 | 0 | 238 / 655 = 36.34% |
| Nov 10 19:38:52 / 11:38:52 | 656 / 656 | 107 | 647 | 0 | 107 / 655 = 16.34% |
| Nov 10 19:41:59 / 11:41:59 | 656 / 656 | 0 | 647 | 0 | 0 / 655 = 0% |

These three checks span **11 minutes 26 seconds, not the required hour**. They already fail the 90% coverage threshold. Observations were recent: median age changed from ~8.68 minutes to ~16.23 and then ~2.17 minutes; latest-observation minimum ages in the latter samples were under one second. The latest completed collection field remained `2026-11-10T19:22:55.287Z` while per-repository timestamps advanced. A completed-run timestamp must not be mistaken for each repository's observation time.

No tracked repository in these samples had a first-observed age ≥24 hours. The oldest firstSeen was `2026-11-09T23:40:04.791Z`; the last sample is only about 20 hours later. Thus this sample cannot prove a daily-baseline failure for an established 24-hour cohort, or prove the daily gate passes.

Source inspection confirms serial candidate reads and scheduling the next run **after completion plus the configured interval** (`server/trends.ts` in the studio). A configured 15-minute interval does not guarantee 15-minute per-repository revisits. The scorer requires a point at/before the hourly target within 12 minutes, while six-hour tolerance is 30 minutes. Irregular revisit spacing is a plausible explanation for the mismatch, but **the cause is not established** from catalog timestamps alone. Full scan duration, per-repository revisit intervals, restarts, and exact historical boundary points could not be established without deployed history or an authorized operational observation export. No scoring tolerance or scheduling setting was changed to hide the gap.

Representative authenticated `/api/trends/:id/history?window=24h` reads returned **404**. The app correctly exposes a stable history-unavailable state and retains the overview.

## Separate collector change

Prepared locally only in `../devloot-instagram-videos`:

1. `server/trend-routes.ts`: optional history capability on the existing backend interface; local store read; current missing/dismissed validation; strict safe ID and fixed `window=24h`; existing bearer-protected scope and no-store hook retained.
2. `tests/unit/trend-history.test.ts`: authentication, missing/dismissed repositories, invalid IDs/windows, exact sorted stored points, strict 24h/future exclusion, and unchanged stored observations.

The remote studio backend has no history consumer, so no unused remote transport was added. No migration, retention change, scan, pause, or reset is required. Existing studio mutation routes retain their behavior; Radar exposes none of them.

`artifacts/collector/history-route.patch` is the reviewable additive patch. `manifest.json` records original/new file hashes because the sibling working tree had active untracked source. **The patch is already reflected locally; do not apply it again over these files.** Review/apply it against the matching original source in the eventual deployment checkout, retain the previous collector artifact, and run the tests before a separately authorized deployment. Core was not edited.

## Release artifact and configuration

`artifacts/devloot-radar-internal-preview.tar.gz` packages the built web assets, thin server, shared contracts, package/lockfile, runtime version, blank environment example, release documentation, and collector patch. The adjacent `.sha256` file identifies the artifact. It contains no `.env`, credentials, node_modules, database, or sibling runtime imports. No commit was created from the pre-existing untracked working trees.

| Variable | Role |
| --- | --- |
| `NODE_ENV=production` | Enables production configuration validation |
| `DATA_MODE=live` | Required in production; no automatic demo fallback |
| `TRENDS_REMOTE_URL` | Existing HTTPS collector origin, server only |
| `TRENDS_API_TOKEN` | Existing bearer token, server only; never `VITE_*` |
| `PUBLIC_ORIGIN` | Trusted public origin for canonical/OG URLs; required in production |
| `HOST` | Loopback locally; provider-approved listener for an eventual deployment |
| `PORT` | Provider port; local default 4321 |

The runtime artifact runs with Node 24, `npm ci --omit=dev`, and `npm start`; built assets are included. Source builds use `npm ci` then `npm run build`. The web service needs no volume or database. Do not copy the studio's full environment.

## Exact public launch gates still open

- Deploy the separately reviewed additive collector route, then verify authenticated representative real charts and exact stored timestamps. Until then, the real-chart acceptance gate is not passed.
- Investigate revisit spacing/scan duration with real history. Demonstrate ≥90% valid hourly baselines among tracked repositories with ≥90 minutes of observation age over at least three checks spanning ≥1 hour. Current evidence fails this gate.
- Confirm a real ≥24-hour observed cohort with measured daily deltas; keep newer/gapped records explicitly unavailable.
- Validate deep links, canonical origin, API/assets/404 behavior, token isolation, and warm API latency in the eventual deployment environment. Local verification is not a deployment verification.
- Only after the above and explicit release approval, enable public indexing and populate the sitemap with canonical discovery, methodology, and current public repo routes. Exclude watchlists, queries, demo URLs, and unknown repos. The current preview intentionally blocks indexing.

Do not provision a service, change production configuration, or deploy merely to close this local task. The operational owner must retain the collector's existing single-replica SQLite volume and budget/backoff behavior.

## Rollout and rollback

For an authorized release: retain the previous collector artifact; deploy the additive route without touching the volume; verify representative reads and the coverage gates; then release Radar as an independent web service. Start with noindex and perform the deployment checks before a separately approved indexing change.

If Radar fails, roll back or stop only the Radar web service/artifact. Its browser watchlists remain visitor-local, and the collector/core keep running. If the additive collector endpoint fails, restore the prior collector application artifact, **retaining its existing SQLite volume unchanged**. Radar will show history unavailable and retain catalog evidence. Never delete or reset the collector database as a rollback.
