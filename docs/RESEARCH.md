# GitTrend research and the DevLoot opportunity

Research date: November 10, 2026, America/Vancouver. Public pages were read, and the homepage, time-range control, command search, and repository detail were inspected in the browser. This is a product review, not an audit of GitTrend's private pipeline. Its audience and coverage figures are claims made by the site.

## What GitTrend does well

GitTrend's homepage combines ranked repositories, period/language controls, search, and links to specialized discovery pages. That creates multiple entry points beyond a daily list. [Homepage](https://gittrend.io/)

The command search accepts a repository keyword and returns repositories and tags, with a full-results link and keyboard guidance. Searching `react` returned recognizable exact-name and related matches. This is a useful low-friction interaction to retain, but our first catalog search must clearly describe its smaller scope. [Search](https://gittrend.io/search?q=react&from=cmdk)

The sampled repository page combines historical measurements, momentum, recorded appearances, external links, explanatory content, related repositories, and embeddable assets. That provides reasons to land directly on a repository page and to share it. DevLoot should retain the idea of a durable repository destination, while putting the immediate growth evidence ahead of lengthy reference material. [Sample repository page](https://gittrend.io/repo/meta/astryx)

GitTrend describes verified snapshot differences rather than raw public event counts as the basis for its growth figures. Its methodology discusses freshness, historical coverage, and popularity's limits. These are useful trust practices to preserve. Our scope and periods must reflect our own collector, not its larger claimed coverage. [Methodology](https://gittrend.io/methodology)

## Discovery and retention surfaces

| Surface | Observed behavior | MVP response |
| --- | --- | --- |
| [Rising](https://gittrend.io/rising) | A separate entry point for younger repositories with traction | Use acceleration in the existing analyzer; distinguish repo creation from first observation |
| [Hidden Gems](https://gittrend.io/hidden-gems) | Small repositories are given their own discovery lane | Add “Under the radar” as a transparent size-and-growth filter, not a quality endorsement |
| [Topics](https://gittrend.io/topics) | Categorized discovery with period-based totals | Use existing GitHub topics as filter facets; postpone editorial category classification |
| [Language page](https://gittrend.io/languages/typescript) | Searchable/shareable language-specific list and context | Reuse one filtered discovery route; avoid duplicating page implementations |
| [Developer rankings](https://gittrend.io/trending/developers) | Aggregates traction across an owner's repositories | Defer; the product unit is one repo and the collector does not supply this aggregate |
| [Weekly digest](https://gittrend.io/weekly/2026-W45) | Period archive with editorial context and ranked projects | Defer until completed periods and retained history exist |
| [Insights](https://gittrend.io/insights) | Aggregate trends, distributions, and collection activity | Expose a compact coverage/methodology view; no broad ecosystem dashboard in MVP |
| [AI search](https://gittrend.io/ai-search) | Goal-based search advertised with a daily free allowance | Defer until basic search and data trust work; later reuse DevLoot Quickcpick selectively |
| [Promotion](https://gittrend.io/promote) | Paid distribution through video and social channels | Potential fit with DevLoot's existing media studio after product validation; no checkout in MVP |

## Friction observed and what it means

1. **Results compete with monetization elements.** The observed session showed sponsor blocks before the list and a bottom advertising overlay. This is session-specific, not necessarily every visitor's experience. Our design should put useful repository evidence nearer the top. [Homepage](https://gittrend.io/)
2. **Period values deserve explicit validation.** Selecting “This Week” changed the results but showed `+0 this week` for all ten visible entries; the archive showed nonzero totals. The cause was not established. Our tests must verify that period changes update values, sorting, units, and coverage together. [Homepage](https://gittrend.io/), [weekly archive](https://gittrend.io/weekly/2026-W45)
3. **Deep pages can dilute the immediate question.** The sampled detail page contained long explanatory sections and multiple ranking/reference areas. The design opportunity is a first-screen answer to “What changed, how reliable is that measurement, and what can I do with this repo?” Long-form enrichment can follow later. [Repository detail](https://gittrend.io/repo/meta/astryx)
4. **Our differentiation cannot simply be charts or explanations.** GitTrend already has both. A better DevLoot MVP should combine intraday change evidence, a useful return loop, and an individual repo identity that can later connect to contribution opportunities. This is our product inference, not an absent-feature claim about the competitor.

## Proposed advantage

**Find a repository while its momentum is changing, understand the measurement, and keep it on your own radar.**

The existing analyzer's hourly window and acceleration can support this positioning if real observation coverage becomes reliable. A 15-minute scheduling configuration is not evidence that each repository updates every 15 minutes. The product must show per-repo observation times and qualify its coverage.

DevLoot contributes a recognizable visual language, approachable community profiles, tags, contribution context, and a future path to real opportunities. The MVP borrows that identity and navigation model without requiring discussions, moderation, wallets, payouts, or repository administration.

## Live analyzer evidence

Read-only request to the configured Railway origin: the configured collector `/api/trends` endpoint (service origin omitted from this public source), at **2026-11-10 19:01:14 UTC / 11:01:14 America/Vancouver**. Authentication stayed in process memory; no credential or raw private response was saved here.

| Observation | Result |
| --- | --- |
| HTTP status | 200 |
| Catalog repositories | 655 |
| Configured active capacity | 800 |
| Tracking membership | 655 |
| Configured interval | 15 minutes |
| Collector auth mode | GitHub App |
| Collector state | Enabled, unpaused, running; no reported error/warnings |
| GH Archive ingestion | Disabled |
| Valid hourly deltas | 7 |
| Valid six-hour deltas | 647 |
| Valid daily deltas | 0 |
| Signals | 648 new, 7 watching; no emerging/growing/stale |

The mismatch between six-hour and one-hour coverage means “wait an hour” is not a sufficient diagnosis. Inspect observation spacing, scan duration, restarts, and the baseline tolerance before promising hourly signals. Do not relax the scorer or fabricate values to populate the UI. The response was sampled during a scan; this observation does not establish the cause or a permanent outage.

## Local source evidence

- Analyzer: `../devloot-instagram-videos/shared/trends.ts`, `server/trend-score.ts`, `server/trends.ts`, `server/trend-store.ts`, `server/trend-routes.ts`, `server/trend-service.ts`, `server/trend-remote.ts`, and `docs/hosted-trends.md`.
- Brand and communities: `../devloot-core/client/src/styles/design-system.css`, `workshop-fonts.css`, `components/community/ProjectProfile.tsx`, `components/community/ProjectDiscussion.tsx`, and `pages/project/components/ProjectDetails.tsx` (paths after `client/src/` where abbreviated).
- Domain relationship: `../devloot-core/server/prisma/schema.prisma` defines a many-to-many Project–Repository relation. A DevLoot community is not necessarily one repository.

Source observations and live observations are separate: the default authenticated capacity in source is 300; the observed deployment was configured to 800. Source inspection does not prove the running service has the same commit or every available feature.
