import { expect, it } from "vitest";
import { demoCatalog, demoHistory } from "@devloot-radar/shared/demo";
import { previewGeometry, windowPoints } from "../src/lib/history";
import { historySchema } from "@devloot-radar/shared/contracts";
it("selects actual 1h and 6h samples, retaining gaps and never interpolating boundaries", () => {
  const history = demoHistory(1, 1800000000000);
  const hour = windowPoints(history, "1h"),
    six = windowPoints(history, "6h");
  expect(hour.length).toBeLessThan(six.length);
  expect(hour.every((point) => history.points.includes(point))).toBe(true);
  expect(hour[0].at).toBeGreaterThan(history.fetchedAt - 3600000);
  const geometry = previewGeometry(history, "6h", 15);
  expect(
    previewGeometry(demoHistory(7, history.fetchedAt), "6h", 15).segments
      .length,
  ).toBeGreaterThan(1);
  expect(geometry.segments.flat()).toHaveLength(six.length);
});
it("handles zero, one point and negative movement without fake slopes", () => {
  const now = 1800000000000;
  expect(previewGeometry(demoHistory(4, now), "1h", 15).points).toHaveLength(1);
  expect(
    previewGeometry({ ...demoHistory(4, now), points: [] }, "1h", 15).segments,
  ).toEqual([]);
  const flat = previewGeometry(demoHistory(5, now), "1h", 15);
  expect(new Set(flat.segments.flat().map((p) => p.y)).size).toBe(1);
  const declining = previewGeometry(demoHistory(6, now), "1h", 15);
  expect(declining.segments.flat().at(-1)!.y).toBeGreaterThan(
    declining.segments.flat()[0].y,
  );
});
it("keeps demo fixtures explicit, schema-valid and separate from live ingestion", () => {
  const now = 1800000000000;
  for (const repo of demoCatalog(now).items) {
    const history = historySchema.parse(demoHistory(repo.id, now));
    expect(history.points.at(-1)?.stars).toBe(repo.stars);
    expect(history.points.at(-1)?.at).toBe(repo.checkedAt);
  }
});

it("offers a larger seven-day sample without including it in intraday windows", () => {
 const now=1800000000000;const week=demoHistory(1,now,"7d");
 const day=demoHistory(1,now,"24h");
 expect(historySchema.parse(week).window).toBe("7d");
 expect(windowPoints(week,"7d").length).toBeGreaterThan(day.points.length);
 expect(windowPoints(week,"24h")).toEqual(day.points);
 expect(windowPoints(week,"7d")[0].at).toBeGreaterThanOrEqual(now-7*86400000);
 expect(previewGeometry(week,"7d",15).segments.length).toBeGreaterThan(1);
});
