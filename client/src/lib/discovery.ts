import type { Repository } from "@devloot-radar/shared/contracts";
import { isStale } from "@devloot-radar/shared/measurements";
export type Window = "1h" | "6h" | "24h";
export type Filters = {
  view: "momentum" | "growth" | "small";
  window: Window;
  q: string;
  language: string;
  topic: string;
};
export const defaults: Filters = {
  view: "momentum",
  window: "1h",
  q: "",
  language: "",
  topic: "",
};
export const metric = (repo: Repository, window: Window) =>
  repo[window === "1h" ? "hour" : window === "6h" ? "sixHours" : "day"];
export function readFilters(params: URLSearchParams): Filters {
  const view = params.get("view");
  const window = params.get("window");
  return {
    view: view === "growth" || view === "small" ? view : "momentum",
    window:
      view !== "growth" && view !== "small"
        ? "1h"
        : window === "6h" || window === "24h"
          ? window
          : "1h",
    q: (params.get("q") ?? "").trim().slice(0, 200),
    language: (params.get("language") ?? "").slice(0, 100),
    topic: (params.get("topic") ?? "").slice(0, 100),
  };
}
export function filterParams(filters: Filters) {
  const canonical = readFilters(new URLSearchParams(filters));
  const params = new URLSearchParams();
  for (const key of Object.keys(defaults) as (keyof Filters)[])
    if (canonical[key] !== defaults[key]) params.set(key, canonical[key]);
  return params;
}
export function discover(
  items: Repository[],
  filters: Filters,
  now = Date.now(),
) {
  const window = filters.view === "momentum" ? "1h" : filters.window;
  const matching = items.filter(
    (r) =>
      r.tracking &&
      !isStale(r, now) &&
      `${r.fullName} ${r.description} ${r.language ?? ""} ${r.topics.join(" ")}`
        .toLowerCase()
        .includes(filters.q.toLowerCase()) &&
      (!filters.language || r.language === filters.language) &&
      (!filters.topic || r.topics.includes(filters.topic)) &&
      (filters.view !== "small" || r.stars < 2000),
  );
  const ranked = matching
    .filter(
      (r) =>
        metric(r, window) !== null &&
        (filters.view !== "small" || metric(r, window)! > 0),
    )
    .sort((a, b) =>
      filters.view === "momentum"
        ? b.score - a.score || b.hour! - a.hour! || a.id - b.id
        : metric(b, window)! - metric(a, window)! || a.id - b.id,
    );
  const baseline = matching
    .filter((r) => metric(r, window) === null)
    .sort((a, b) => b.firstSeen - a.firstSeen || a.id - b.id);
  return { ranked, baseline, count: ranked.length + baseline.length };
}
export function facets(items: Repository[], now = Date.now()) {
  const eligible = items.filter((r) => r.tracking && !isStale(r, now));
  return {
    languages: [
      ...new Set(eligible.flatMap((r) => (r.language ? [r.language] : []))),
    ].sort(),
    topics: [...new Set(eligible.flatMap((r) => r.topics))].sort(),
  };
}
