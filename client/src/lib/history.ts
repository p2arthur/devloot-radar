import type { History } from "@devloot-radar/shared/contracts";
export function chartPoints(
  points: History["points"],
  intervalMinutes: number,
) {
  const result: Array<{
    at: number;
    stars: number | null;
    forks: number | null;
  }> = [];
  const gap = Math.max(2 * intervalMinutes, 45) * 60_000;
  for (const [i, point] of points.entries()) {
    if (i > 0 && point.at - points[i - 1].at > gap)
      result.push({ at: points[i - 1].at + 1, stars: null, forks: null });
    result.push(point);
  }
  return result;
}

export type ChartWindow = "1h" | "6h" | "24h" | "7d";
export const windowMs = (window: ChartWindow) =>
  ({ "1h": 3_600_000, "6h": 21_600_000, "24h": 86_400_000, "7d": 604_800_000 })[window];
export function windowPoints(history: History, window: ChartWindow) {
  return history.points.filter(
    (point) =>
      point.at >= history.fetchedAt - windowMs(window) &&
      point.at <= history.fetchedAt,
  );
}
// SVG previews preserve the same actual timestamps and gap rule as the detail chart.
export function previewGeometry(
  history: History,
  window: ChartWindow,
  intervalMinutes: number,
) {
  const points = windowPoints(history, window);
  const minimum = points.length ? Math.min(...points.map((p) => p.stars)) : 0;
  const maximum = points.length ? Math.max(...points.map((p) => p.stars)) : 0;
  const segments: Array<Array<{ x: number; y: number }>> = [];
  const start = history.fetchedAt - windowMs(window);
  const gap = Math.max(intervalMinutes * 2, 45) * 60_000;
  points.forEach((point, index) => {
    if (index === 0 || point.at - points[index - 1].at > gap) segments.push([]);
    segments
      .at(-1)!
      .push({
        x: 4 + ((point.at - start) / windowMs(window)) * 192,
        y:
          maximum === minimum
            ? 28
            : 49 - ((point.stars - minimum) / (maximum - minimum)) * 42,
      });
  });
  return { points, segments, minimum, maximum };
}
