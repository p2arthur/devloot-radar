# DevLoot Radar monorepo instructions

Read `docs/ARCHITECTURE.md`, `docs/BUILD-PLAN.md`, `docs/PRODUCT-DESIGN.md`, and `docs/BACKEND.md` before changing behavior. `docs/RESEARCH.md` records historical evidence. The monorepo consolidation supersedes earlier single-package/sibling-runtime plans.

- `client/` is the React UI, `server/src/` is the public API, `server/src/collector/` owns ingestion and SQLite, and `shared/` holds public contracts.
- Preserve DevLoot styles, assets and self-hosted fonts; provenance is in `docs/REUSE.md` and `docs/COLLECTOR-PROVENANCE.json`.
- Null is not zero. Never fabricate growth, charts, ranks, causal explanations, community membership or account state. Demo fixtures remain visibly separate, never an outage fallback.
- Keep collector credentials server-only. Never put them in `VITE_*`, logs, public responses or git. Keep databases, private keys and environment files untracked.
- The public product does not start ingestion or expose scan/pause/save/dismiss routes. The packaged collector is a separate, explicitly started process and exposes authenticated reads only. Existing Railway ingestion remains the single production owner until a separately authorized migration.
- Do not provision, deploy, change production variables, reset data, expand retention or run duplicate ingestion as part of routine implementation.
- Votes and the single public watchlist remain browser-local. Studio decisions are not visitor preferences. GitHub repo IDs are not DevLoot community IDs.
- Sibling source trees are not runtime dependencies. Keep them unchanged unless a task explicitly includes a scoped cross-repository edit.
- Use Node 24, `npm ci`, `npm run check`, `npm test`, and `npm run build`. Behavior/integration tests must cover real boundaries, not markup snapshots.
- Bind preview servers to loopback. No Docker is needed. Production collector transport requires HTTPS; development loopback HTTP is opt-in.
- Update build/release status accurately and report tested results and unresolved live-data gates.
