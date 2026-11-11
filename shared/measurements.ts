import type { Catalog, Repository } from "./contracts";
export const STALE_AFTER = 2 * 60 * 60_000;
export const isStale = (repo: Repository, now = Date.now()) =>
  repo.signal === "stale" || now - repo.checkedAt > STALE_AFTER;
export function ageRepository(repo: Repository, now: number): Repository {
  return isStale(repo, now)
    ? {
        ...repo,
        signal: "stale",
        hour: null,
        sixHours: null,
        day: null,
        acceleration: null,
        score: 0,
        reason: "No recent observation. Totals are last observed values.",
      }
    : repo;
}
export function coverage(
  items: Repository[],
  now = Date.now(),
): Catalog["coverage"] {
  const eligible = items.filter((r) => r.tracking && !isStale(r, now));
  return {
    observed: items.length,
    rankedHourly: eligible.filter((r) => r.hour !== null).length,
    measured6h: eligible.filter((r) => r.sixHours !== null).length,
    measured24h: eligible.filter((r) => r.day !== null).length,
  };
}
export function ageCatalog(catalog: Catalog, now = Date.now()): Catalog {
  const items = catalog.items.map((r) => ageRepository(r, now));
  return { ...catalog, items, coverage: coverage(items, now) };
}
