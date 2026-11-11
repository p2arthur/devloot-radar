> Current monorepo paths: UI assets/styles live under `client/`; the engine is included under `server/src/collector/`. Paths in the original inventory below describe the source extraction. No runtime imports cross sibling repositories.

# DevLoot reuse and asset provenance

All source paths in this document are relative to the `devloot-trends` project root, not this `docs` directory. Inspection date: November 10, 2026. Core HEAD was `679300ed4376c87f46897ab7118e7ab0eb568851`, but many inspected files had local user changes; the copied design files reflect the working tree. The studio repository had no resolvable HEAD at inspection, so its working-tree source is the evidence. No claim is made about a deployed commit.

## Reuse inventory

| Source | What to reuse | How |
| --- | --- | --- |
| `../devloot-core/client/src/styles/design-system.css` | Theme tokens, fonts, radii, panels, profile cover treatment | Copied unchanged into `src/styles/design-system.css` |
| `../devloot-core/client/src/styles/workshop-fonts.css` | Font-face declarations | Copied unchanged; relative font paths preserved |
| `../devloot-core/client/src/styles/fonts/workshop/` | Archivo, IBM Plex Sans, IBM Plex Mono and OFL files | Copied into the equivalent local directory |
| `../devloot-core/client/public/devloot_mascot_black.svg` and `devloot_mascot_white.svg` | DevLoot brand mark | Copied into `public/brand/`; match variant to theme |
| `../devloot-core/client/public/favicon.svg` | Existing favicon | Copied into `public/brand/` |
| `../devloot-core/client/public/community-world-pixels.svg` | Profile/hero pixel map | Copied into `public/`; decorative only |
| `../devloot-core/client/src/components/ui/button.tsx` | Semantic action variants and focus behavior | Adapt minimal local Button; importing core's Tailwind/alias/Radix dependency tree wholesale is unnecessary |
| `../devloot-core/client/src/components/community/ProjectProfile.tsx` | Cover/avatar/identity/tags/actions composition | Reimplement around one repository DTO; omit votes, owner dashboard, wallets and community session |
| `../devloot-core/client/src/components/community/ProjectPhoto.tsx` | Image fallback pattern | Use public GitHub owner avatar with the existing DevLoot pixel fallback; avoid a “community profile” alt label on a repo |
| `../devloot-core/client/src/pages/project/components/ProjectDetails.tsx` | Metadata grouping and contribution context | Adapt only fields backed by the collector |
| `../devloot-core/client/src/stories/Foundations.stories.tsx` and `Screens.stories.tsx` | Existing visual references | Read while matching design; do not create a new Storybook dependency for four MVP pages |
| `../devloot-instagram-videos/shared/trends.ts` | Existing upstream contract | Maintain a narrower runtime-validated public projection in `shared/contracts.ts` |
| `../devloot-instagram-videos/server/trend-score.ts` | Score and signal semantics | Keep upstream as owner; document, do not fork the scoring implementation into React |
| `../devloot-instagram-videos/server/trend-remote.ts` | Server-only origin validation, timeout, redirect rejection | Pattern adapted by the foundation's catalog reader |
| `../devloot-instagram-videos/server/trend-store.ts` | Existing observations for charts | Add authenticated history read in the collector; no second data store |

## What should remain outside this application

- Core `UserContext`, wallet providers, Algorand clients, Stripe integration, realtime jobs, and complete `services/api.ts` are not required for repository discovery.
- Community comments/votes are user-generated content with permissions and moderation. Copying their components does not create a safe standalone community system.
- Core Quickcpick and Jev enrichment have catalog contracts, execution cost, and evidence requirements. Reuse them later through a specific API after a real consumer exists. Do not add an LLM merely to explain arithmetic.
- Studio media generation, publishing credentials, saved/dismissed decisions, and local video project IDs remain private studio concerns.

## Future reuse order

1. Public links to verified matching DevLoot communities and existing open bounties, using a batched enrichment API.
2. Evidence-based search enrichment from existing DevLoot discovery services, if lexical search proves insufficient.
3. Core identity for cross-device saves, only when retention justifies accounts.
4. Discussions and maintainer tools with the existing moderation and authorization boundaries.

Do not make each trend repo a new core `Project` automatically. Core models many repos per community and many communities per repo. A repo profile in Radar can exist without a DevLoot community. Claims of ownership or membership require real authorization, not a matching GitHub owner string.

## Design ownership

DevLoot assets are reused at the user's request in this sibling project. Preserve font licenses when shipping them. No GitTrend source, branding, artwork, generated descriptions, or repository data has been copied into the app. Demo repository names and values are fictional. The app uses the existing analyzer as its intended live data source.

For later design-system updates, compare the copied files against their original paths and make a deliberate update. No symlinks or runtime imports cross the sibling directories; the project should build independently when moved to its own repository.

The MVP also copies the three font license files to `public/licenses/`, so they ship alongside the built static assets in the release artifact. The source design-system and workshop-fonts CSS remain byte-identical to the inspected core working-tree files.

Repository avatar follow-up: `../devloot-core/client/public/images/project-default.png` is copied unchanged to `public/brand/project-default.png`. This is the existing DevLoot pixel avatar used by core ProjectPhoto. Live repository identity images use GitHub’s public owner-avatar URL (no collector credential); fictional demo repositories, missing owners, and failed image loads use the local asset. The current collector has no repository-specific image field.
