# MVP product and design specification

## Seven-day chart amendment

The November 10 follow-up adds 7 days as the default repository chart range alongside 1h, 6h, and 24h. The weekly chart shows actual stored points (up to 2,000), calendar dates, sample count and actual coverage times. The same gap rule remains; no missing history is filled. Range controls remain available during errors, including an undeployed weekly endpoint. Discovery sorting and list-preview windows remain unchanged. Explicit fictional demo history includes an authored week with gaps.

## November 10 follow-up: windows, votes, and charts

The user explicitly expanded the initial scope: show 1h and 6h together, add browser-local votes, and add animated repository charts and list previews. These choices supersede the original no-voting/no-list-chart exclusions below. Votes use numeric repository IDs under `devloot-radar:votes:v1`, are reversible and separate from saves, synchronize between tabs, and never imply public totals or affect analyzer ranking. Storage failure remains session-only.

Rows show both ~1h and ~6h net stars, with the selected ranking metric marked; ~24h is also shown when selected. Unranked hourly records may still show a measured six-hour delta. Detail charts switch between 1h/6h/24h (default 6h) using actual samples from the existing 24h read. Linear chart reveal respects reduced motion. List previews use lightweight SVG, activate near the viewport, and batch public history reads; the full chart library stays lazy. Demo charts use explicitly authored fictional observations only in demo mode. Missing live history never becomes demo data.

## Product decision

Working name: **DevLoot Radar**. The product helps curious developers discover open-source repositories with changing momentum, inspect the evidence, and return to a personal watchlist. The primary unit is a public GitHub repository, identified by GitHub's numeric repository ID. Owner/name is its readable route, not its durable identity.

Primary journey: **discovery → repository evidence → save → return**. Secondary journey: **discovery → repository → open GitHub**. A later DevLoot integration can add **repository → contribution opportunity**, but that integration must not be invented from repository popularity.

The MVP is free to browse and works without an account. “Save” means save on this browser; it never stars the repository on GitHub and never changes the studio watchlist. A repo page is an automatically assembled profile, not a community claimed or endorsed by its maintainer.

## Scope boundaries

| Ship in the MVP | After validation |
| --- | --- |
| Responsive discovery with text, language, and topic filters | Natural-language AI search and personalized recommendations |
| Momentum, growth, and under-the-radar views | Developer rankings and global ecosystem statistics |
| 1h/6h/24h net changes when measured | 7d/30d comparisons and archived digests |
| A repo profile with a real 24h observation chart | README generation, elaborate install guides, automated reviews |
| Evidence, freshness, and missing-data states | Historical rank movement, alert subscriptions, emails |
| Browser-local watchlist and votes | Accounts, shared vote totals, synchronized lists, user collections |
| Copyable repo-page links | Public badges and exportable social cards |
| Methodology and catalog coverage | Shared voting, comments, moderation, maintainer claims |
| DevLoot design and a clear attribution/footer | Bounties, payments, wallet flows, task execution |

No “Coming soon” navigation, inert buttons, placeholder tabs, fake people, or fake charts in the finished MVP. The current foundation intentionally labels its future features in explanatory copy; replace that copy with the implemented product during the build.

## Information architecture

| Route | Purpose | State |
| --- | --- | --- |
| `/` | Discovery | `view=momentum|growth|small`, `window=1h|6h|24h`, `q`, `language`, `topic` |
| `/repo/:owner/:name` | Individual repository profile | Optional `tab=overview|growth`; use anchors if tabs add no value |
| `/watchlist` | Saved repositories in this browser | Sort and filters local to this page |
| `/methodology` | Metric definitions, scope, cadence, coverage | No user state |
| unmatched path | Useful not-found page | Back to discovery |

All links must work on direct load and refresh. Use React Router in library mode with Vite, preserving the existing React foundation. URL state controls the discovery page, so back/forward and copied filters work. Update the query with `replace` for debounced typing and `push` for explicit tab/filter changes. Canonicalize empty/default parameters and reject unknown values to safe defaults.

## Screen 1: discovery

### Layout and hierarchy

Desktop at 1440px: centered content max-width 1280px, 40px side padding, 80px header. Header has DevLoot mascot/wordmark, Radar, Watchlist, How it works, and an accessible theme button. Do not add an unrelated admin sidebar. A compact 160–220px introduction has a 36–44px heading, one line of purpose, and a quiet coverage line. Useful repository content should begin within the first 600px at a normal desktop viewport. The starter hero is an art-direction sample; shorten it for the finished discovery screen.

Below the introduction: a 44–48px search field; then a compact toolbar containing view choice, period choice where applicable, language, topic, and reset. Show an active-filter summary with clear individual removals. The main results occupy roughly 3/4 of the width; a 260–280px side rail contains at most three explainable breakouts and a short methodology link. Collapse the rail below the list on smaller screens. If no qualifying breakouts exist, replace that module with a useful baseline/coverage explanation rather than filler repositories.

Use one bordered list panel with row dividers. Do not turn every metric into a separate card. Each row contains:

1. Rank **within the selected, eligible result set**; omit in baseline/unranked sections.
2. GitHub owner avatar or DevLoot pixel-avatar fallback, `owner/name` as a real link, and a two-line maximum description.
3. Language, up to three topic chips, and total stars in a quieter line.
4. Primary selected metric aligned on the right, always with its unit/window.
5. Signal label and a concise explanation: e.g. `+42 net stars in ~1h · 7.5× previous pace`.
6. A save button outside the repo link, with `aria-pressed`, a repo-specific accessible name, and no nested interactive elements.

Use text explanations plus lightweight previews from stored observations. Fetch previews near the viewport in batches of up to 25 IDs, sharing cached histories with detail. Keep the full chart library on the repository page. Paginate the in-memory catalog presentation in 25-row increments with “Show 25 more”; reset the visible count when filters change. This is not a claim that all GitHub repositories are searchable.

### View semantics

- **Momentum**: fresh, tracked repositories with an hourly baseline, sorted by analyzer score descending, then hour descending, then numeric repository ID ascending. The period is fixed to 1h and explained in the toolbar. Do not leave 6h/24h controls looking active when they cannot affect the score.
- **Growth**: fresh tracked repositories with a non-null selected delta, ordered by that delta descending and ID ascending. Show 1h/6h/24h. Preserve zero and negative values; no missing values in ranked results.
- **Under the radar**: same measured Growth ordering, restricted to `stars < 2000` and positive selected growth. Its subtitle says exactly that. This threshold is a product choice, not a quality rating or a new analyzer signal.
- **Building a baseline**: a separately labeled section of matching fresh repositories without the needed measurement. Sort by firstSeen descending then ID. No ranks or growth numbers. A six-hour metric can be present even when hourly data is missing; show it on detail rather than treating the entire record as empty.
- **No recent observation**: exclude from ranked discovery, preserve on detail and watchlist with last-known totals and dates. Do not label stale records “Watching” just because they used to have that signal.

When the initial hourly ranking is empty, show the baseline explanation and a normal action to inspect six-hour Growth. Never silently switch the selected metric. Search matches owner/name, description, language, and GitHub topic strings case-insensitively. Filters combine with AND. Topic facets are actual repo tags, not inferred categories. Language facets are computed from the full eligible catalog, not just the first rendered page.

### Feedback and states

Skeleton rows reserve the same approximate height as actual rows. A 503 with no cached result gives a short error and retry. Previously loaded data can stay visible with a stale warning and its original timestamp; do not claim it was just updated. No results explains whether filters, absence of coverage, or an empty catalog caused the state. Retry re-fetches public data; it does not trigger a collector scan.

Freshness line: `Observed repositories, not all of GitHub · Latest completed collection [absolute/relative time]`. Keep `fetchedAt` separate from collection and per-repo observation times. Use local time for presentation, UTC for stored timestamps, and an exact timestamp available in an accessible description or native `title` in addition to visible relative time.

## Screen 2: the individual repository home

Adapt DevLoot's `ProjectProfile` composition rather than copying its component with all its dependencies. Above the fold: breadcrumb back to the filtered list; a subtle pixel-map cover; avatar overlapping the cover edge; owner/name; repository description; language, license, and topic chips; save and View on GitHub actions. A small label says `Repository profile · GitHub data` so it does not imply a maintainer account.

The right or lower hero area contains total stars, forks, and last push. Do not use last push as proof of health, open issues as a contributor count, or aggregate DevLoot community stars as the repo's stars. Below it, use two columns on desktop:

- **Main column:** “What changed” with 1h/6h/24h observed deltas; “Growth over the last 24 hours” with the actual observations; metadata including first observed and repository creation date.
- **Side column:** plain-language signal definition and evidence; observation freshness; GitHub links; a small list of up to four related tracked repositories based on topic intersection, with the shared topic shown. Break ties by ID and exclude the current repository. Omit the related section when there are no actual overlaps.

The chart is cumulative stars over a rolling 24h view, labeled as such. It is not historical lifetime star growth. Use actual timestamps on x, actual totals on y, `connectNulls=false`, and no smoothed curve that implies nonexistent samples. A nonzero y-axis minimum is allowed if ticks remain visible and the caption discloses “axis starts at [n]”; provide the selected interval's signed net change separately. With one point, show the point and “Waiting for another observation.” With no points, use the history-unavailable state. Show gaps longer than `max(2 × configured interval, 45 minutes)` as breaks. Do not infer exact hourly acquisition from irregular samples. Provide a collapsible accessible data table and keyboard-readable summary.

The chart depends on the collector history endpoint specified in `BACKEND.md`. Until that endpoint exists, a truthful repo page without a chart can be used for internal preview. It does not pass the full MVP's chart acceptance gate.

“Copy link” uses the canonical repo route. Copy failures present a selectable URL, not a false success toast. No full README renderer or install-command generator in this MVP; the GitHub link gets people to the authoritative instructions.

Unknown repo: 404-style page, no guessed metadata and no background GitHub import. Explain that only observed repositories are in this catalog. Renamed repo: route lookup uses case-insensitive current fullName; stable numeric IDs preserve saves. Redirect old names only when a verified alias is available; do not guess redirects.

## Screen 3: watchlist

Store `{version:1, entries:[{id, fullName, savedAt}]}` under `devloot-radar:watchlist:v1`. Validate on read. Use numeric ID for joins, preserve existing saves on name changes, deduplicate by ID, and keep a maximum of 200 entries. `localStorage` access is fallible: continue with session-only state and say saves will not survive this session when persistence fails. Do not report success before updating the visible state. Synchronize changes from the browser `storage` event.

The header says `Saved in this browser`; never imply account synchronization. Render current catalog matches with the same row component. A saved ID that is no longer in the public catalog stays visible as “No current public data” with its last saved name and a Remove action. Do not keep presenting cached sensitive metadata after an upstream repository disappears. Empty state points back to discovery. No server POST/PATCH is made when a visitor saves or removes an item.

## Screen 4: methodology

Explain net stars, observed window tolerance, acceleration denominator flooring, score purpose, signal thresholds, the distinction between first seen and repository created, observation versus fetch time, catalog eligibility, and the fact that stars do not establish quality or causation. Include a live coverage summary: observed catalog count and counts with usable 1h/6h/24h data. Never expose authentication state, API quotas, raw collector errors, or studio controls here.

“Why this is trending” is deterministic: measured change plus comparison pace. Never claim a release, social post, or announcement caused growth without a separate sourced event integration. No LLM call is needed to explain the existing score.

## DevLoot visual specification

These exact values come from the current core design system. The copied CSS is authoritative; avoid hardcoded component-level duplicates.

| Token | Light | Natural Mystic |
| --- | --- | --- |
| Canvas | `rgb(246 237 225)` | `rgb(17 23 25)` |
| Surface | `rgb(255 251 245)` | `rgb(24 32 35)` |
| Border | `rgb(218 204 186)` | `rgb(73 87 94)` |
| Primary text | `rgb(38 34 29)` | `rgb(242 245 245)` |
| Secondary text | `rgb(103 92 79)` | `rgb(176 191 197)` |
| Accent | `rgb(173 52 20)` | `rgb(245 135 107)` |
| Positive | `rgb(20 105 56)` | `rgb(112 211 160)` |

Archivo for headings, IBM Plex Sans for prose/controls, IBM Plex Mono for measurements. All are self-hosted with their license files. Display type is confident but compact; numbers use tabular alignment. Primary actions use `--primary-foreground`. Negative changes use `--danger` plus a minus sign; unknown uses a dash with explanatory text, never a green zero.

Use 8px small radius, 12px controls, 18px cards, 22px panels, 28px hero and pill action buttons. Preserve thin warm borders and restrained shadows. Pixel artwork belongs in the intro/profile cover at low opacity; it should not compete with the chart or appear as chart data. The mascot marks the product and can accompany one empty state; do not repeat it on every repository.

At 390px: 16–18px page margins, compact 64–72px header, wrapped filters, no forced horizontal page scrolling. Repository rows become two-column compact entries; secondary metadata wraps below. Keep the primary growth figure and save action visible. At 768px use one main column; at 1024px enable the optional side rail. Target touch controls of at least 44px. Inputs have persistent labels. Buttons expose state to assistive technology. Use genuine links and preserve visible focus.

Theme defaults to system preference, then persists an explicit selection under a versioned key. Apply the theme before first paint to avoid a flash. Support reduced motion: no pulsing “live” dot, animated counters, or infinite marquee. Use at most 120–160ms hover transitions and optional short nonessential entry transitions.

## Product quality and learning

The first session should let someone identify an interesting repo in under 30 seconds and inspect the metric meaning without leaving the app. Validate this with three representative developers, rather than treating it as a measured outcome today.

Recommended launch measurements, after choosing the deployment's existing analytics mechanism: discovery loaded, repo opened, save toggled, GitHub outbound clicked, and return to watchlist. Record route, view, period, and public repo ID; do not record raw search text, tokens, full watchlists, or email. No new analytics vendor is needed for MVP. Local QA can inspect events in a development console. Decide consent/retention with the chosen analytics setup before enabling production tracking.

Initial success criteria are hypotheses: ≥25% of discovery sessions open a repo, ≥10% save at least one, and meaningful repeat watchlist use within a week. Review with a small cohort after two weeks; do not add artificial engagement mechanics to inflate them. No sign-up funnel is required to validate discovery value.
