# DevLoot Radar MVP build plan

**Decision:** build a standalone React discovery app with DevLoot's visual identity, individual repository profiles, measured intraday momentum, and a browser-local watchlist. Reuse the existing Railway analyzer through a read-only backend. Do not rebuild ingestion or pull the whole DevLoot server into the app.

This plan is written for an implementing model that should execute a complete, bounded product pass. Explanations, exact data rules, and gates are included so it does not have to invent the design or backend. Read this document first, then the linked specs at each stage.

## Monorepo consolidation — current layout

The user authorized a public `p2arthur/devloot-radar` repository containing only the Radar client and collector, excluding the video studio. The source now uses npm workspaces: `client/`, `server/` (public API and separate collector process), and `shared/` (public DTOs). The original sibling trees are unchanged. No video generation/editing/publishing code, media assets, or dependencies were imported. Collector auth, history, scheduling, rate-limit/backoff and scoring are local modules; studio HTTP mutation routes were excluded. The existing production collector still owns ingestion; no deployment or data migration occurred.

Local consolidation checks: `npm ci`, workspace typechecks, all 90 behavior/integration tests, and client production build pass. All 16 browser scenario groups pass against the built monorepo, including 390/768/1440px in both themes. A standalone archive passes production dependency installation, API/deep-link/404 checks, and collector factory/SQLite checks without starting ingestion. Prepared for public publication as `p2arthur/devloot-radar`. `docs/ARCHITECTURE.md` and README supersede the original directory/package-layout instructions below. Historical QA files and old incremental sibling patches remain local generated artifacts, not runtime dependencies.

## Follow-up: demo links and live preview

November 10 correction: demo repository profiles no longer link fictional names to GitHub, and the demo notice explicitly says these are not real projects. The local loopback preview now runs in live mode using only the existing collector URL/token loaded into the server process; no credential file, frontend variable or production setting was changed. Read-only verification returned 656 real repositories. App typecheck, all 43 tests and production build pass; focused browser evidence is in `artifacts/qa/data-mode/`. Live history remains unavailable until the separately prepared collector changes are deployed. A default unconfigured process still starts in clearly labeled demo mode.

## Follow-up: seven-day history

Implementation and browser validation complete locally on November 10. Repository charts default to 7d, retain shorter views, expose actual sample coverage, and permit up to 2,000 exact observations. App and browser caches are keyed by repo/window; list previews stay on 24h. The explicitly authorized sibling change adds a separate fixed-window chart read and extends the bearer-protected route; scoring, eight-day retention, ingestion, production variables and stored data remain unchanged. App typecheck/build and 43 behavior tests pass; collector typecheck and 24 history/service/trends regression tests pass. All 16 browser scenario groups pass, including seven-day default, shorter-window selection, week-unavailable/day-available recovery, and both themes at 390/768/1440px. Reviewable incremental patch: `artifacts/collector/history-7d.patch` and hash manifest. **Live launch gate:** separately deploy/verify both history capabilities and collect real coverage evidence; a seven-day selector does not prove a seven-day observed cohort.

## Follow-up: repository avatars

Implemented locally on November 10. Discovery, watchlist, and repository profiles show the public GitHub owner's avatar for live repositories, with core's existing DevLoot pixel avatar when an image is missing or fails. Demo repositories use only the local fallback. Image dimensions are reserved and list images load lazily; no collector/API contract or sibling files changed. `npm ci`, typecheck, 39 tests, and production build passed. Browser checks cover successful/failed image loads, watchlist retention, demo isolation, and 390/768/1440 layouts in both themes; evidence: `artifacts/qa/avatars/`. The avatar changes are included in the subsequent seven-day release package.

## Follow-up: paired windows, votes, animated charts

User-requested expansion on November 10: **implemented locally**. Both 1h/6h metrics are visible in discovery/watchlist; repository charts have 1h/6h/24h views and reduced-motion-safe animation; visible rows get lightweight previews via bounded batched history reads. Browser-local upvotes are reversible, persistent when storage permits, synchronized across tabs, separate from saves, and do not change rankings. Demo history is explicitly fictional; live missing-history behavior remains truthful. This supersedes the original voting/list-preview exclusions.

Validation: 39 behavior tests, typecheck/build, the original 10 browser scenarios, and six added voting/chart scenario groups. Added responsive evidence lives in `artifacts/qa/votes-charts/`. The live history deployment and coverage launch gates remain open; no sibling or production changes were made in this follow-up.

## Current completion status

Updated November 10, 2026. **Local implementation and QA are complete; public launch is blocked by observed collector coverage and undeployed live history.** The scope-specific collector change is prepared locally, not deployed. Detailed results and release steps are in `RELEASE.md`.

| Stage / area | Actual status and evidence |
| --- | --- |
| 0 — baseline | Complete. Node 24.22.2; `npm ci`, original four tests, typecheck/build, and loopback demo browser check passed. Existing untracked working trees retained. |
| 1 — public boundary | Complete. Strict runtime schemas, signed/null values, aging, coverage, canonical lookup, shared cache and delayed fallback, fail-closed authentication, no write routes. Integration tests pass. |
| 2 — shell/theme | Complete. Four destinations, active navigation, skip link, pre-paint system/persisted themes, fallible storage, direct navigation and true not-found handling. |
| 3 — discovery | Complete. Exact pure ranking/filter functions, canonical URL state, baseline section, finite signed metrics, 25-item increments/reset, explicit fixture cases. Behavior and browser checks pass. |
| 4 — watchlist | Complete. One versioned browser-local list, stable IDs, 200 limit, reload/rename/missing-record/blocked-storage/cross-tab behavior. No upstream writes. |
| 5 — profiles/history | Local implementation complete. Profiles, evidence, links/copy fallback, related topics, lazy actual-point chart, gaps/table, read-only history adapter/cache. Additive authenticated collector route and 23 relevant collector tests pass locally. **Live chart gate remains blocked: deployed route returns 404.** |
| 6 — serving/metadata | Complete for internal preview. Escaped route metadata, trusted-origin canonical/OG, JSON API/asset errors, canonical-case redirects and true 404s tested. All HTML remains noindex; robots blocks crawling and sitemap intentionally stays empty until an approved public release. |
| 7 — local QA | Complete. 43 app behavior tests, typecheck/build, 16 browser scenario groups, original and follow-up responsive screenshots, live read-only primary journey, token/network boundary, and mobile lab measurement. See `RELEASE.md` for actual numbers and limitations. |
| 8 — release preparation | Prepared artifact, separate collector patch, environment names, launch gates and rollback note. No provisioning, deployment, production variable changes, or data reset. |
| Public hourly/daily/history gates | **Not passed.** Three checks over ~11.4 minutes show 238 → 107 → 0 usable hourly repos; no confirmed ≥24h cohort. Required ≥1h observation span and real deployed chart verification remain outstanding. |

The local product is a complete internal preview. It is not a live chart release or a passed public launch gate merely because the mocked history contract and UI pass tests.

## Fixed product choices

- Working name **DevLoot Radar**; package and folder **devloot-trends**.
- Three discovery views: Momentum (1h score), Growth (1h/6h/24h), Under the radar (<2,000 stars and positive selected growth).
- Four product destinations: discovery, repository, watchlist, methodology. No authentication in MVP.
- Measured stars, forks, language, tags, license, creation/push timestamps, signal explanation, and fresh/stale states only.
- Real observation charts on detail with 1h/6h/24h/7d controls; no fake sparklines or 30d control.
- Save means browser-local watchlist, independent of studio preferences and GitHub stars.
- One Fastify web service and the existing collector; no new database or collector process.
- Warm DevLoot light theme and Natural Mystic dark theme, real local fonts/assets.
- No ads, promotion checkout, comments, shared public voting, maintainer claims, notifications, wallets, or AI chat in MVP. Browser-local voting is authorized by the follow-up above.

These are planning decisions, not live product claims. A future task can change them explicitly; the implementing model should not broaden them on its own.

## Target project organization

Keep one package, not a workspace monorepo. Add files only when their slice uses them.

```text
src/
  main.tsx
  App.tsx                         router and shared app shell
  pages/{Discover,Repository,Watchlist,Methodology,NotFound}.tsx
  components/{AppHeader,RepositoryRow,SignalBadge,SaveButton,FilterBar}.tsx
  components/{GrowthChart,DataStatus,EmptyState,Button}.tsx
  hooks/{useCatalog,useWatchlist,useTheme}.ts
  lib/{discovery,format,watchlist}.ts
  styles/{app,design-system,workshop-fonts}.css
server/
  index.ts                        runtime/config/static serving
  app.ts                          public HTTP routes
  catalog.ts                      upstream validation/projection/cache
  history.ts                      one real history adapter when available
  metadata.ts                     escaped route metadata
shared/
  contracts.ts                    runtime schemas and public types
  demo.ts                         explicit fictional demo catalog
tests/
  catalog.test.ts
  discovery.test.ts
  history.test.ts
  watchlist.test.ts
  app.test.ts
  e2e/                            primary browser journeys
docs/                             these handoff specs
```

This is a responsibility map, not an instruction to make empty placeholder files. A small component may remain in its page until reuse or clarity justifies extraction. Preserve a single definition of each metric/format rule.

## Stage 0 — establish the baseline

Read `AGENTS.md`, `README.md`, `PRODUCT-DESIGN.md`, `BACKEND.md`, and `REUSE.md`. Use Node 24 and `npm ci`. Run the existing tests/build. Inspect local changes before editing; do not discard user work. Keep core and the studio untouched until reaching the separately scoped collector addition.

Start `npm run dev:api` and `npm run dev` in separate terminals. Verify the demo banner, fictional repo names, search, and both palettes. This is the design reference and a working integration seam, not the final product. Retain the copied semantic tokens and font sources. Update `README.md` whenever commands or configuration change.

**Exit:** clean baseline checks, working loopback preview, and a clear understanding of which files are implementation versus specification.

## Stage 1 — stabilize the public data boundary

Files: `shared/contracts.ts`, `server/catalog.ts`, `server/app.ts`, tests. Follow the complete schemas and semantics in `BACKEND.md`.

1. Add coverage metadata, interval, scoring version, and the available/delayed state. Normalize expired observations at read time without changing upstream scoring. Build public values with explicit fields or a stripping runtime schema; never spread raw collector records into a public response.
2. Validate safe IDs, fullName path segments, finite measurements, timestamps, and bounded strings/arrays. Preserve null, zero, and negative deltas as three different states. Exclude dismissed records conservatively. Parse current upstream shape; do not invent fields the deployment does not provide.
3. Extend the existing cache with a bounded 10-minute last-good fallback marked delayed, then fail 503. Coalesce reads; never call the collector per row. On 401/403, expose only a generic service error, and log no credential details.
4. Add case-insensitive repository lookup and canonical path responses. No direct GitHub import or on-demand collection.
5. Keep demo mode explicit. Production refuses missing live configuration and never falls back to demo on error.

**Why this comes first:** every page depends on reliable nullability and freshness. Fixing misleading zeros after the UI is built creates inconsistent sorting and charts.

**Exit tests:** private fields removed; null and negative changes preserved; dismissed items excluded; dot-segment paths rejected; concurrent requests share one upstream call; stale-cache age is unchanged; missing config/upstream auth failure does not leak secrets or produce demo data; all studio mutation routes remain absent.

## Stage 2 — build the app shell and theme

Files: `src/App.tsx`, app header, local Button, theme hook, page shells and `app.css`. Add `react-router-dom` v7 and TanStack Query v5 at compatible pinned/locked versions. Use existing semantic CSS rather than adding another styling framework.

Implement routing with a shared header/footer, visible current navigation, skip link, theme preference, and useful not-found page. Shorten the foundation hero for discovery. Preserve palette differences and `--primary-foreground`. Follow the layout dimensions in `PRODUCT-DESIGN.md`; no giant marketing hero or admin dashboard sidebar.

Treat theme persistence as fallible. Respect system preference until the user chooses; then persist their choice. Apply the selected class before initial paint. Navigation works with keyboard and touch. Header labels remain readable at 390px and in both themes.

**Exit:** direct navigation among all four destinations, active links, back/forward behavior, 390/768/1440px layouts without page overflow, and no dead navigation.

## Stage 3 — finish discovery as the central product

Files: `pages/Discover.tsx`, filter bar, repository row, signal badge, `lib/discovery.ts`, `lib/format.ts`, catalog hook.

Implement the exact view rules from `PRODUCT-DESIGN.md`. Keep filtering/sorting as pure functions and test them independently. All filters compose, all meaningful state is in the URL, and visible result count describes the filtered set. The primary metric's window and its sorting must always match. Momentum fixes its window to 1h rather than pretending score changes with another period.

Create realistic **fictional** fixtures covering emerging/growing, flat/negative, missing hour with available six-hour data, stale, empty catalog, one long description/name, null language, and unavailable API. Keep live and fixture modes completely separate.

Use a single shared RepositoryRow. Show 25 results initially and a working increment button. Rank only measured, fresh, tracked matching repositories. Put unknown baselines in a named unranked section. A search that finds only baseline records is not “no results.” A healthy process with no usable measurements is not “live trends.”

Use concise evidence text. The breakout rail is optional based on actual results; it cannot create a ranking by highlighting unmeasured popular repositories. Handle 503, delayed data, no matches, insufficient coverage, and loading without layout jumps.

**Exit tests:** search and AND filters; reset/back/forward; 1h vs 6h/24h ordering; missing ≠ zero; negative stays negative; fixed Momentum window; <2,000 boundary; deterministic ties; stale exclusion; baseline section; pagination reset. Browser inspection confirms metric hierarchy and keyboard access.

## Stage 4 — implement watchlist retention

Files: `lib/watchlist.ts`, `hooks/useWatchlist.ts`, SaveButton and Watchlist page. Follow the versioned storage schema in the design spec.

Use stable numeric repo IDs. Updates are immediate and reversible. Persist validated minimal records, keep them isolated from the collector, and synchronize other tabs. If storage is blocked, keep session state and show the persistence limitation. A rename keeps the same saved ID. Unavailable repositories retain only the saved name and removal action.

Reuse RepositoryRow and filters as appropriate. Show “Saved in this browser.” Save on discovery and detail must update the header count and watchlist consistently. Do not introduce an account modal, GitHub star request, or studio PATCH.

**Exit tests:** save/remove, reload persistence, duplicate prevention, renamed ID, malformed storage, blocked storage, missing catalog ID, cross-tab event, 200-entry bound, and zero upstream writes. A browser flow saves from discovery, visits watchlist, refreshes, then removes it.

## Stage 5 — complete repo profiles and genuine history

Files: repository page, GrowthChart, history adapter/schema/tests; additive studio collector diff as described in `BACKEND.md`.

First implement the profile with metadata and measured deltas from catalog. Match DevLoot's community identity composition but make the entity one repository. Link back to the discovery filters where navigation state is available, with a normal root fallback for direct visits. Save, GitHub link, topic navigation, and copy link work. Never imply that the owner has signed up or authorized this profile.

Then implement the collector history route locally, without deploying it or resetting its database. Keep its patch small and independently testable. Add the Radar adapter route and cache. Validate the current public repo before serving any history. Test a mocked upstream history endpoint so local product work is not blocked by production deployment.

Add Recharts only for the detail chart and lazy-load it with the page/chart boundary. Use actual timestamps, gap handling, zero/one-point states, visible units, and a data-table alternative. The catalog page does not fetch per-row chart history. If the production collector lacks this capability, show the specified history-unavailable state and list it as a launch blocker.

**Exit tests:** unauthorized/missing/dismissed history cases in collector; 400 for invalid period; exact points preserved; no synthetic curve; null states; gaps; detail survives chart failure; repo route case normalization; saved rename behavior; safe external links; copy failure fallback.

## Stage 6 — methodology, route serving, and metadata

Implement methodology from `BACKEND.md` in user-facing language with real coverage counts and exact metric thresholds. A developer should be able to explain the list order without reverse engineering the app. Keep “first observed” distinct from “created.” No quality claims or causal narratives.

Finish production route serving and route-specific escaped HTML metadata. Add canonical URLs from configured public origin, Open Graph tags, robots/sitemap, and true 404 responses. Do not return the SPA shell for failed API calls or missing JS/assets. Keep watchlist and arbitrary filtered duplicates out of the sitemap. The current noindex is removed only for an approved public release after verification; local/demo previews remain noindex.

**Exit tests:** direct repo URL and refresh; invalid repo gives 404; API 404 is JSON/error rather than HTML; metadata escapes user-controlled repository descriptions/names; canonical ignores attacker-supplied Host; no demo URLs indexed; no raw secrets in frontend bundle.

## Stage 7 — visual and behavior QA

Run `npm run check`, `npm test`, and `npm run build`. Add browser tests appropriate to the actual app, then inspect it manually at 390×844, 768×1024, and 1440×900 in both themes. Use the supported browser automation available in the environment; do not install a parallel browser automation stack without a need.

Primary journey: open discovery → choose Growth/6h → filter language → open repo → inspect evidence/chart → save → visit watchlist → refresh → remove → return via browser back. Also test a direct repo URL and a null-heavy live-style catalog. Keyboard journey uses Tab/Enter/Escape and has visible focus; screen-reader labels name the repository for save actions. Charts have a nonvisual alternative. Check prefers-reduced-motion.

Inspect output size and avoid loading the chart library on discovery. Target initial JS ≤150KB gzip excluding lazy chart chunk; the current foundation is approximately 95KB gzip, so there is a usable budget. Treat LCP <2.5s, CLS <0.1 and INP <200ms as targets to measure under a documented mobile profile, not claims established by a local build. Do not add analytics or animation dependencies to chase a cosmetic score.

**Exit:** all behavior checks pass, no horizontal overflow, no console errors, no fake controls, no stale/missing metrics mislabeled, and production build serves the primary journey.

## Stage 8 — prepare the release, with evidence

Produce release configuration and a short rollout note. Do not provision services or change production during local implementation. Include the separate collector patch and its test results, the web artifact/commit, required variable names, rollback steps, and the following gates:

| Gate | Pass condition |
| --- | --- |
| Collector availability | Authenticated catalog read succeeds; no private diagnostics exposed |
| Hourly sampling | Investigated with actual timestamps; ≥90% of tracked repos with ≥90 minutes of observation age have valid 1h baselines over at least three checks spanning ≥1 hour |
| Daily coverage | A confirmed ≥24h observed cohort has measured daily deltas; missing windows remain clearly marked for newer/gapped repos |
| Real chart | Authenticated additive history route deployed and representative public detail charts verified |
| Public boundary | Browser bundle/network never contains collector token or studio controls |
| Production route behavior | Deep links, 404s, metadata, canonical origin, and assets validated |
| Operational independence | Radar rollback does not affect core or the collector volume |

These thresholds are proposed product-readiness criteria, not a promise that the existing data currently meets them. If coverage fails, ship a clearly named internal preview, report the measured gap, and keep the public launch pending. Do not hide failing measurements or declare success because the demo has good numbers.

## Acceptance matrix for the finished MVP

| Requirement | Evidence required |
| --- | --- |
| Looks like DevLoot | Copied tokens/fonts/assets, matched profile composition, both themes reviewed |
| Useful discovery | Real filters, deterministic metric-specific ranking, URL state, load-more |
| Explains movement | Actual signed deltas, acceleration meaning, timestamps, methodology |
| Repo-centered identity | Durable routes, real metadata, individual repo not aggregated community |
| Return loop | Local saves survive reload; unavailable/renamed repositories handled |
| Honest chart | Stored points only, gaps and limited history visible, accessible table |
| Safe reuse | Read-only collector adapter; existing studio remains functional |
| Independent foundation | Can run from this folder with `npm ci`; no sibling runtime imports |
| Ready for smaller-model delivery | Implemented stages checked off, tests/results recorded, limitations explicit |

## Avoid these common implementation mistakes

- Do not use `delta || 0`; zero and null are different. Do not divide by a zero baseline without following the scorer's documented semantics.
- Do not sort by all-time stars and label the result momentum. Do not decorate every repo as “trending.”
- Do not infer historical rank movement from current score; it needs stored ranking snapshots and is deferred.
- Do not call the current studio `projectId` a DevLoot community ID.
- Do not paste core's full `ProjectProfile` and then stub missing providers. Adapt its visual structure to the smaller DTO.
- Do not create a site-wide “real time” badge based on process health or a fresh HTTP fetch.
- Do not label `new` as newly created: it means the hourly baseline is missing.
- Do not silently enable GH Archive, increase repository capacity, or change production scheduling while building the website.
- Do not auto-populate charts or explanations with invented production data to make screenshots more exciting.
- Do not turn this plan into many independent apps, queues, or abstract provider layers. The MVP has one web backend and one existing upstream.

## Next increments, only after this MVP

Prioritize using evidence from actual users: verified DevLoot contribution links; longer retained history and historical change records; cross-device saves; digest subscriptions; goal-based search; maintainer claims/discussions; media promotion. Each increment needs its own data/permission/operations assessment. The first release should establish that developers value the discovery → evidence → save loop.
