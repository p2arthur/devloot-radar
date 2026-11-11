# Monorepo architecture

The November 10 consolidation is authorized to include the existing local frontend and Radar engine. It supersedes the original single-package/sibling-engine planning layout.

## Workspaces

- `@devloot-radar/client`: React UI and static assets. It requests only same-origin public `/api/v1/*` endpoints.
- `@devloot-radar/server`: two independent entrypoints. `src/index.ts` serves the public API and built UI; `src/collector/index.ts` runs ingestion and the authenticated engine read API.
- `@devloot-radar/shared`: Zod public DTOs, measurement/freshness logic and explicit demo fixtures. Its TypeScript exports are compiled by Vite for the client and loaded by tsx on the server.

The browser never receives the collector token. The API validates and strips collector responses, checks current catalog membership before history reads, and maintains bounded day/week caches. The collector retains SQLite ownership and original scheduling/scoring behavior. Public watchlist/vote state remains exclusively in each visitor's browser.

## Engine boundary

The engine code was copied from the local DevLoot studio; its source hashes are recorded in `COLLECTOR-PROVENANCE.json`. Imports are local to this repository. The studio media application, decision controls, publishing tools, project files, secrets and databases were not copied. Existing sibling working trees remain unchanged by this consolidation.

The consolidated collector exports `/healthz` and bearer-protected `GET /api/trends` plus `GET /api/trends/:id/history?window=24h|7d`. Studio mutation routes were intentionally excluded. The public API exposes only validated catalog, repository and history reads. Tests assert that scan, pause and preference mutation endpoints are absent from both services.

Scoring uses the original 26-hour read. Chart history uses fixed 24h/7d bounds, excludes future points, and does not change eight-day retention. A seven-day selector does not prove seven days of observations. Local HTTP transport requires an explicit non-production flag and literal loopback; production remains HTTPS-only.

## Build and execution

One root `npm ci` installs all workspaces. `npm run check` checks the client and server boundaries, `npm test` runs all unit/integration tests, and `npm run build` typechecks then produces `client/dist`. Server code runs with Node 24 and the locked tsx runtime. The static asset location resolves relative to the server module, not the shell's current directory.

A source clone contains no data or credentials. The default app preview is explicit demo. The engine starts only through its separate command; API startup never starts it. Consolidation and public source publication do not deploy services, start a production collector or migrate a database.
