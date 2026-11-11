# Connect Radar to the existing Railway collector

The existing Railway deployment runs the collector and owns ingestion and its SQLite observations. Radar's local public API reads that deployment; the browser calls only the local API. The collector code packaged in this repository is available for maintenance and a separately authorized migration. It does not mean the running deployment has been updated from this repository.

```text
Browser :4320 → local public API :4321 → existing Railway collector (HTTPS)
                                      bearer token stays on the server
```

## Obtain the existing connection settings

Use the existing configuration supplied by the deployment maintainer, or open the correct collector service and environment in the [Railway dashboard](https://railway.com/dashboard) with authorized project access:

1. In the service's networking settings, copy its **existing public HTTPS domain**. Set `TRENDS_REMOTE_URL` to that origin, such as `https://YOUR-EXISTING-COLLECTOR-DOMAIN`, without an API path, credentials, or query string. A Railway dashboard URL or private internal hostname is not the endpoint for local development. See [Railway networking](https://docs.railway.com/networking).
2. In the service's **Variables** tab, locate the existing `TRENDS_API_TOKEN`, or obtain it through the maintainer's secret manager. This is the collector's bearer secret, not a Railway personal, project, or CLI token. If access to the value is unavailable, request it from the maintainer rather than changing the running service. See [Railway variables](https://docs.railway.com/variables).

The deployment hostname, project identifiers and token are deliberately omitted from this public repository. Public source access does not grant access to the hosted collector. Reading these settings requires no new domain, deployment, variable edit, token rotation, or database operation.

## Configure and start locally

Use Node 24. From the repository root:

```sh
npm ci
cp -n .env.example .env
```

Edit the root `.env` (already ignored by git), replacing the two placeholders:

```dotenv
DATA_MODE=live
TRENDS_REMOTE_URL=https://YOUR-EXISTING-COLLECTOR-DOMAIN
TRENDS_API_TOKEN=YOUR-EXISTING-COLLECTOR-TOKEN
HOST=127.0.0.1
PORT=4321
PUBLIC_ORIGIN=http://127.0.0.1:4321
ALLOW_LOCAL_COLLECTOR=false
```

```sh
npm run dev
```

Open [the six-hour growth view](http://127.0.0.1:4320/?view=growth&window=6h). The command starts only the public API and Vite, waits for API health, and stops both on Ctrl+C. Restart after changing `.env`. Root `.env` is loaded by the API, not Vite; never copy these settings into `client/.env` or `VITE_*` variables. No sibling checkout is required.

For the built UI, stop development, run `npm run build && npm start`, and open [port 4321](http://127.0.0.1:4321). Do not run `dev:collector` or `start:collector` when connecting to the existing Railway worker: those commands explicitly start a separate ingestion process.

## Verify the connection without printing secrets

With the app running, execute this from another terminal. It reads the sanitized local API and prints only mode and coverage:

```sh
node --input-type=module -e 'const r = await fetch("http://127.0.0.1:4320/api/v1/catalog"); if (!r.ok) throw new Error(`Catalog HTTP ${r.status}`); const d = await r.json(); console.log({mode:d.mode,repositories:d.items.length,coverage:d.coverage}); if (d.mode !== "live") process.exitCode = 1;'
```

Use port 4321 instead for a built preview. Expected: HTTP success and `mode: 'live'`. `/healthz` verifies only the local API process, not collector authentication or data availability. The local API authenticates `GET /api/trends` upstream; visitors never need the collector token. Avoid pasting authenticated curl commands, raw upstream payloads, or `.env` contents into issues or logs.

| Symptom | Check |
| --- | --- |
| Vite `ECONNREFUSED 127.0.0.1:4321` | The local API is stopped. Use the combined `npm run dev`, or start `dev:api` alongside `dev:client`. |
| Port 4320 or 4321 is occupied | Stop the previous local preview before starting another. The combined command refuses to reuse or terminate unknown listeners. |
| Startup rejects configuration | Confirm `DATA_MODE=live`, a nonempty token, and an HTTPS origin without a path. Restart after edits. |
| Catalog returns 503 | Check the existing domain, matching token and collector availability with the maintainer. Public errors are deliberately sanitized; they do not establish which upstream check failed. Live errors never switch to demo. |
| Demo banner appears | This process is using demo configuration. Set live mode in the root `.env` and restart. Shell environment values take precedence over `.env`. |
| Charts say history unavailable | The inspected deployment did not implement the authenticated history endpoint. The source here includes it, but pushing source does not deploy it. |
| Hourly figures show a dash | A valid observed baseline is missing or stale. Null is not zero; six-hour or daily measurements can still be available. |

## Existing deployment and remaining release gates

On November 10, 2026, the live local adapter returned 662 repositories, including 658 with six-hour measurements and 640 with daily measurements, but zero eligible hourly rankings. This is a point-in-time observation, not a coverage guarantee. The separate live history check reported the endpoint unavailable. These limitations are recorded in [research](RESEARCH.md), [build status](BUILD-PLAN.md), and [release notes](RELEASE.md).

Real charts require a separately authorized additive deployment of `GET /api/trends/:id/history?window=24h|7d` to the existing worker, followed by verification against real retained observations. Hourly coverage still needs investigation and sustained measurement. Keep the existing volume, retention, and single ingestion owner intact. Connecting this local app does not provision services, publish Radar, migrate the worker, or change production variables.
