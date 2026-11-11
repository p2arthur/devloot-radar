> Historical initial implementation prompt. The authorized monorepo layout in ARCHITECTURE.md supersedes old paths.

# Prompt for the implementing model

Use this project directory: `<workspace>/devloot-radar`.

Implement the DevLoot Radar MVP described by this project's `AGENTS.md` and `docs/BUILD-PLAN.md`. Read `PRODUCT-DESIGN.md`, `BACKEND.md`, and `REUSE.md` before coding. Read `RESEARCH.md` for the observed limitations and rationale. The current React/Fastify application is a runnable foundation, not the finished MVP.

Execute stages 0–7 in order, completing each acceptance gate. Update the build-plan status to reflect actual work. Use the existing DevLoot styles/assets, exact ranking and null/freshness semantics, and one browser-local watchlist. Keep the UI polished at 390/768/1440px in both themes. Do not add auth, wallet flows, AI chat, comments, or payments.

The existing Railway collector owns ingestion. Only a read-only authenticated catalog/history adapter belongs in this app. Never put its token in frontend variables. Never expose scan/pause/save/dismiss routes. The history endpoint is not implemented in the inspected collector; prepare its specific additive change and tests in the sibling studio when that cross-repository work is included in your task. Do not deploy it, change production variables, or reset any data as part of local implementation. If you cannot complete that external dependency, finish independent app work, show a truthful history-unavailable state, and report the exact remaining launch gate.

Do not replace missing values with zero, synthesize charts, invent causal explanations, or confuse studio project IDs with DevLoot community IDs. Live data was successfully read, but hourly/daily baseline coverage was insufficient at research time. Investigate rather than hiding it. Fixtures must remain explicitly demo-only; production errors must never switch to demo data.

Run typecheck, behavior tests, production build, and the primary browser journey. Record actual results, artifacts, and unresolved integration gates. Prepare the stage 8 release note without provisioning/deploying services. Deliver a complete local MVP with honest evidence, not merely a static attractive homepage.
