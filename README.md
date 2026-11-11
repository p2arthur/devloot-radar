# DevLoot Radar

A monorepo for discovering observed GitHub repositories, measuring intraday momentum, and keeping a browser-local watchlist and votes. Built with React, Vite, Fastify, TypeScript, and SQLite.

## Project layout

```text
client/                  React UI, DevLoot assets/fonts, client behavior tests
server/src/              Public API, collector adapter, static serving and metadata
server/src/collector/    Ingestion engine, scoring, SQLite history, authenticated read API
server/tests/            API, collector and full local-adapter integration tests
shared/                  Runtime-validated public contracts and explicit demo fixtures
scripts/                 Browser QA, coverage checks and release packaging
docs/                    Design, architecture, provenance and release status
```

The npm workspaces share one lockfile. The public server and ingestion engine are separate processes within the same repository. Starting the web app does not start ingestion. Neither service exposes scan, pause, save or dismiss HTTP routes. The running Railway collector remains the ingestion owner until a separately authorized migration; creating this repository does not deploy or replace it.

## Quick start

Requires **Node 24** (`.nvmrc`) and npm. No Docker or sibling repository is required.

```sh
npm ci
npm run build
npm start
```

Open [http://127.0.0.1:4321](http://127.0.0.1:4321). Without configuration, this is visibly labeled **demo mode** with fictional repositories and charts. Demo repositories have no GitHub links; live failures never fall back to demo.

For frontend development, run `npm run dev:api` and `npm run dev` in separate terminals, then open [http://127.0.0.1:4320](http://127.0.0.1:4320). The Vite dev server proxies `/api` to the loopback API.

## Use the existing collector

Copy `.env.example` to `.env` and configure only the server-side settings:

```dotenv
DATA_MODE=live
TRENDS_REMOTE_URL=https://your-collector.example
TRENDS_API_TOKEN=your-existing-server-token
HOST=127.0.0.1
PORT=4321
PUBLIC_ORIGIN=http://127.0.0.1:4321
```

Restart `npm start`. The API makes authenticated, read-only catalog/history requests and sends only validated public fields to the browser. Never put credentials in `VITE_*` variables or commit `.env` files. Production requires HTTPS, live mode and an explicit `PUBLIC_ORIGIN`.

## Run the packaged engine separately

The complete collector is in `server/src/collector`. It retains the existing discovery, scoring, retry/rate-limit handling, GitHub App support, and eight-day observation retention. Its authenticated history API supports `24h` and `7d`; the scoring read remains 26 hours.

For an intentionally separate **local** instance, copy `.env.collector.example` to `.env.collector`, set a random `TRENDS_API_TOKEN` of at least 32 characters, then run:

```sh
npm run start:collector
```

This explicitly starts ingestion and writes only to the configured `TRENDS_DATA_DIR` (default example: `./data/collector`). Do not run a duplicate worker against an existing production volume. The examples leave GH Archive disabled; enabling it is a separate operational choice.

To connect the web API to that local instance, use the same token in `.env`, set `DATA_MODE=live`, `TRENDS_REMOTE_URL=http://127.0.0.1:4332`, and `ALLOW_LOCAL_COLLECTOR=true`. HTTP is allowed only for literal loopback addresses outside production. Production must use HTTPS. New local databases start without observations; history cannot be reconstructed from current star totals.

## Validation

```sh
npm run check
npm test
npm run build
```

The tests include real temporary SQLite stores and an end-to-end local collector-to-public-API integration with mocked ingestion. No live collection or production data is needed.

For browser QA, start the built app in demo mode on loopback, then run:

```sh
npx playwright install chromium
npm run test:e2e
npm run test:features
```

`QA_ORIGIN` overrides the preview address. `PLAYWRIGHT_MODULE` optionally reuses an existing Playwright installation. CI installs Chromium and runs both browser suites. Screenshots and generated QA output go into ignored `artifacts/`.

```sh
npm run measure:browser
npm run check:coverage -- /path/to/authorized/server.env artifacts/qa/coverage.jsonl
npm run package:release
```

The release archive contains the built client and server/collector runtime with workspace manifests and one lockfile; no credentials, databases, node_modules, or sibling imports. Run `npm ci --omit=dev` and `npm start` from its extracted root. Use `npm run start:collector` only when intentionally starting the ingestion process.

## Product behavior and status

- Exact 1h/6h/24h ranking semantics, null/negative measurements and freshness rules.
- Browser-local, reversible votes and one watchlist; no account or shared vote tally.
- GitHub owner avatars with the existing DevLoot pixel fallback.
- Repository charts default to seven days, with shorter windows, exact stored points, gaps, dates, and a table. Up to 2,000 weekly samples; list previews request daily history only.
- Missing history remains unavailable. Public indexing stays disabled until the live release gates pass.

The source is public; the product is still an internal preview. Existing live history capability and hourly/daily coverage need deployment verification. Nothing was provisioned or deployed as part of consolidating this repository.

See [architecture](docs/ARCHITECTURE.md), [build status](docs/BUILD-PLAN.md), [release notes](docs/RELEASE.md), [measurement rules](docs/BACKEND.md), and [asset provenance](docs/REUSE.md). Fonts retain their bundled licenses. Earlier planning documents record the pre-monorepo structure; the architecture below supersedes those path/layout assumptions.
