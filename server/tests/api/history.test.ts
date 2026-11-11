import { describe, it, expect, vi } from "vitest";
import { createHistoryReader, publicHistory } from "../../src/history";
import { createApp } from "../../src/app";
import { demoCatalog } from "@devloot-radar/shared/demo";
import { chartPoints } from "../../../client/src/lib/history";
const now = Date.now();
const points = [
  { at: now - 10000, stars: 10, forks: 1 },
  { at: now - 1000, stars: 8, forks: 2 },
];
const input = { repositoryId: 1, window: "24h", points };
describe("history read boundary", () => {
  it("preserves exact sorted points without creating observations", () => {
    expect(
      publicHistory({ ...input, points: [...points].reverse() }, 1, now).points,
    ).toEqual(points);
    expect(
      publicHistory({ ...input, points: points.slice(0, 1) }, 1, now)
        .availability,
    ).toBe("insufficient");
    expect(publicHistory({ ...input, points: [] }, 1, now).availability).toBe(
      "insufficient",
    );
  });
  it("rejects duplicate, conflicting, unsafe and mismatched data", () => {
    for (const points of [
      [input.points[0], input.points[0]],
      [{ ...input.points[0], stars: -1 }],
      [{ ...input.points[0], at: Infinity }],
    ])
      expect(() => publicHistory({ ...input, points }, 1, now)).toThrow();
    expect(() => publicHistory(input, 2, now)).toThrow();
  });
  it("bounds actual samples to 200 with exact endpoints", () => {
    const many = Array.from({ length: 1000 }, (_, i) => ({
      at: now - 100000 + i,
      stars: i,
      forks: 0,
    }));
    const result = publicHistory({ ...input, points: many }, 1, now);
    expect(result.points).toHaveLength(200);
    expect(result.points[0]).toEqual(many[0]);
    expect(result.points.at(-1)).toEqual(many.at(-1));
    expect(
      result.points.every((p) =>
        many.some((q) => q.at === p.at && q.stars === p.stars),
      ),
    ).toBe(true);
  });
  it("coalesces/cache reads and distinguishes capability from auth failure", async () => {
    const request = vi.fn(async () => Response.json(input));
    const read = createHistoryReader(
      "https://example.test",
      "secret",
      request,
      () => now,
    );
    await Promise.all([read(1), read(1)]);
    await read(1);
    expect(request).toHaveBeenCalledTimes(1);
    for (const [status, expected] of [
      [404, 501],
      [501, 501],
      [401, 503],
      [403, 503],
      [500, 503],
    ]) {
      await expect(
        createHistoryReader(
          "https://example.test",
          "secret",
          async () => new Response("", { status }),
          () => now,
        )(1),
      ).rejects.toMatchObject({ status: expected });
    }
  });
  it("checks catalog membership before consulting even cached history and validates the window", async () => {
    let catalog = demoCatalog(now);
    const history = vi.fn(async () => publicHistory(input, 1, now));
    const app = createApp(async () => catalog, history);
    expect(
      (await app.inject("/api/v1/repos/1/history?window=24h")).statusCode,
    ).toBe(200);
    catalog = { ...catalog, items: [] };
    expect(
      (await app.inject("/api/v1/repos/1/history?window=24h")).statusCode,
    ).toBe(404);
    expect(history).toHaveBeenCalledTimes(1);
    expect(
      (await app.inject("/api/v1/repos/1/history?window=30d")).statusCode,
    ).toBe(400);
    await app.close();
  });
  it("uses a null marker only to break a gap, never a fabricated total", () => {
    const sparse = [points[0], { ...points[1], at: now + 3_600_000 }];
    const chart = chartPoints(sparse, 15);
    expect(chart).toHaveLength(3);
    expect(chart[1].stars).toBeNull();
    expect(chart.filter((p) => p.stars !== null)).toEqual(sparse);
    expect(chartPoints(points, 15)).toEqual(points);
  });
});

it("expires history at 60 seconds and evicts the least recently used entry at 200", async () => {
  let clock = now;
  const request = vi.fn(async (url: RequestInfo | URL) => {
    const id = Number(String(url).match(/trends\/(\d+)\/history/)![1]);
    return Response.json({ ...input, repositoryId: id });
  });
  const read = createHistoryReader(
    "https://example.test",
    "secret",
    request,
    () => clock,
  );
  for (let id = 1; id <= 200; id++) await read(id);
  await read(1);
  await read(201);
  await read(1);
  expect(request).toHaveBeenCalledTimes(201);
  await read(2);
  expect(request).toHaveBeenCalledTimes(202);
  clock += 60001;
  await read(1);
  expect(request).toHaveBeenCalledTimes(203);
});

it("batches only current public IDs, bounds concurrency, and isolates individual history failures", async () => {
  let active = 0,
    max = 0;
  const reader = vi.fn(async (id: number) => {
    active++;
    max = Math.max(max, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    if (id === 2) throw Error("private token");
    return publicHistory({ ...input, repositoryId: id }, id, now);
  });
  const app = createApp(async () => demoCatalog(now), reader);
  const response = await app.inject(
    "/api/v1/history?ids=1,2,3,4,5,6,7,8,9,999",
  );
  expect(response.statusCode).toBe(200);
  const items = response.json().items;
  expect(items).toHaveLength(10);
  expect(
    items.find((item: { repositoryId: number }) => item.repositoryId === 999)
      .availability,
  ).toBe("missing");
  expect(items[1].availability).toBe("unavailable");
  expect(items[0].history.points).toEqual(points);
  expect(max).toBeLessThanOrEqual(4);
  expect(reader).toHaveBeenCalledTimes(9);
  expect(response.body).not.toContain("private token");
  for (const ids of [
    "",
    "0",
    "1,1",
    "1.5",
    "9007199254740992",
    Array.from({ length: 26 }, (_, i) => i + 1).join(","),
  ])
    expect((await app.inject("/api/v1/history?ids=" + ids)).statusCode).toBe(
      400,
    );
  await app.close();
});
it("limits repeated failed history reads without substituting data", async () => {
  let clock = now;
  const request = vi.fn(async () => new Response("", { status: 501 }));
  const read = createHistoryReader(
    "https://example.test",
    "secret",
    request,
    () => clock,
  );
  await expect(read(1)).rejects.toMatchObject({ status: 501 });
  await expect(read(1)).rejects.toMatchObject({ status: 501 });
  expect(request).toHaveBeenCalledTimes(1);
  clock += 60001;
  await expect(read(1)).rejects.toMatchObject({ status: 501 });
  expect(request).toHaveBeenCalledTimes(2);
});

it("serves exact seven-day samples with a separate larger bound", () => {
  const boundary = now - 7 * 86400000;
  const week = [{at: boundary - 1,stars:1,forks:0},{at:boundary,stars:2,forks:0},{at:now-3*86400000,stars:4,forks:1},...points,{at:now+1,stars:20,forks:2}];
  const result = publicHistory({repositoryId:1,window:"7d",points:week},1,now,"7d");
  expect(result.points).toEqual(week.slice(1,-1));
  expect(() => publicHistory(input,1,now,"7d")).toThrow();
  const many=Array.from({length:2400},(_,i)=>({at:boundary+i*60000,stars:i,forks:0}));
  const sampled=publicHistory({repositoryId:1,window:"7d",points:many},1,now,"7d");
  expect(sampled.points).toHaveLength(2000);
  expect(sampled.points[0]).toEqual(many[0]);expect(sampled.points.at(-1)).toEqual(many.at(-1));
  expect(sampled.points.every(point=>many.some(original=>original.at===point.at&&original.stars===point.stars))).toBe(true);
});
it("isolates day/week caches, coalescing, and unavailable capabilities", async () => {
 const request=vi.fn(async (url: RequestInfo | URL)=>Response.json({...input,window:new URL(String(url)).searchParams.get("window")}));
 const read=createHistoryReader("https://example.test","secret",request,()=>now);
 await Promise.all([read(1,"24h"),read(1,"7d"),read(1,"7d")]);
 expect((await read(1,"24h")).window).toBe("24h");expect((await read(1,"7d")).window).toBe("7d");
 expect(request).toHaveBeenCalledTimes(2);
 const partial=createHistoryReader("https://example.test","secret",async url=>String(url).includes("7d")?new Response("",{status:404}):Response.json(input),()=>now);
 await expect(partial(1,"7d")).rejects.toMatchObject({status:501});
 expect((await partial(1,"24h")).points).toEqual(points);
});
it("passes explicit history windows while keeping list previews on one day", async () => {
 const reader=vi.fn(async (id:number, window: "24h"|"7d")=>publicHistory({...input,repositoryId:id,window},id,now,window));
 const app=createApp(async()=>demoCatalog(now),reader);
 expect((await app.inject("/api/v1/repos/1/history?window=7d")).json().window).toBe("7d");
 await app.inject("/api/v1/history?ids=1");
 expect(reader.mock.calls).toEqual([[1,"7d"],[1,"24h"]]);
 expect((await app.inject("/api/v1/repos/999/history?window=7d")).statusCode).toBe(404);
 await app.close();
});
