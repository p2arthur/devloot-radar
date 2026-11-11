import { describe, it, expect } from "vitest";
import { demoCatalog } from "@devloot-radar/shared/demo";
import {
  defaults,
  discover,
  readFilters,
  filterParams,
} from "../src/lib/discovery";
const now = Date.now();
const items = demoCatalog(now).items;
describe("discovery rules", () => {
  it("composes search, language and topics with AND", () => {
    const result = discover(
      items,
      {
        ...defaults,
        q: "PATCH",
        language: "TypeScript",
        topic: "collaboration",
      },
      now,
    );
    expect(result.ranked.map((r) => r.id)).toEqual([1]);
    expect(
      discover(items, { ...defaults, q: "PATCH", language: "Rust" }, now).count,
    ).toBe(0);
  });
  it("keeps null separate from signed and zero measurements", () => {
    const result = discover(items, { ...defaults, view: "growth" }, now);
    expect(result.ranked.map((r) => r.hour)).toEqual([42, 18, 8, 5, 0, -3]);
    expect(result.baseline.map((r) => r.id)).toEqual([4, 7]);
  });
  it("orders by the selected metric and fixes momentum to an hour", () => {
    expect(
      discover(items, { ...defaults, view: "growth", window: "6h" }, now)
        .ranked[0].id,
    ).toBe(7);
    expect(
      discover(items, { ...defaults, window: "24h" }, now).ranked[0].id,
    ).toBe(1);
    expect(readFilters(new URLSearchParams("window=6h")).window).toBe("1h");
  });
  it("enforces strict under-2000 and positive growth", () => {
    const result = discover(items, { ...defaults, view: "small" }, now);
    expect(result.ranked.map((r) => r.id)).toEqual([1, 2, 3, 9]);
  });
  it("excludes stale and untracked items; ties resolve by ID", () => {
    const one = items[0];
    expect(
      discover(
        [
          { ...one, id: 4 },
          { ...one, id: 2 },
          { ...one, id: 1, tracking: false },
          { ...one, id: 3, checkedAt: now - 7_200_001 },
        ],
        defaults,
        now,
      ).ranked.map((r) => r.id),
    ).toEqual([2, 4]);
  });
  it("canonicalizes defaults and invalid parameters", () => {
    expect(
      filterParams(
        readFilters(
          new URLSearchParams("view=invalid&window=bogus&q=%20%20&x=y"),
        ),
      ).toString(),
    ).toBe("");
  });
  it("returns baseline-only searches and ages cached items at the boundary", () => {
    expect(discover(items, { ...defaults, q: "six-hour" }, now)).toMatchObject({
      ranked: [],
      count: 1,
    });
    expect(discover(items, defaults, now + 7_200_001).count).toBe(0);
  });
});
