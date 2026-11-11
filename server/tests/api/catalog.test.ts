import { describe, expect, it, vi } from "vitest";
import { demoCatalog } from "@devloot-radar/shared/demo";
import { createCatalogReader, publicCatalog } from "../../src/catalog";
import { createApp } from "../../src/app";

const upstream = () => ({
  items: demoCatalog().items.map((item) => ({
    ...item,
    saved: true,
    dismissed: false,
    projectId: "studio-private-id",
    priorityUntil: 123,
  })),
  collector: {
    lastRun: 123,
    intervalMinutes: 15,
    authMode: "app",
    tokenExpiresAt: 999,
    error: "private error",
  },
});
describe("public collector boundary", () => {
  it("excludes internal state and dismissed repositories without coercing missing metrics to zero", () => {
    const input = upstream();
    input.items[0].dismissed = true;
    const data = publicCatalog(input);
    expect(data.items).toHaveLength(8);
    expect(data.items.find((r) => r.id === 4)?.hour).toBeNull();
    for (const key of [
      "saved",
      "dismissed",
      "projectId",
      "priorityUntil",
      "authMode",
      "tokenExpiresAt",
      "private error",
    ])
      expect(JSON.stringify(data)).not.toContain(key);
  });
  it("shares one upstream read across concurrent visitors and caches it", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify(upstream())));
    const read = createCatalogReader(
      "https://collector.example",
      "test-server-token",
      request,
    );
    await Promise.all([read(), read(), read()]);
    await read();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("rejects insecure or non-origin upstream configuration", () => {
    for (const origin of [
      "http://collector.example",
      "https://collector.example/path",
      "https://user:password@collector.example",
      "https://collector.example?token=secret",
    ])
      expect(() => createCatalogReader(origin, "token")).toThrow();
  });
  it("never relays failures or exposes studio write routes", async () => {
    const app = createApp(async () => {
      throw new Error("secret-token");
    });
    const failure = await app.inject("/api/v1/catalog");
    expect(failure.statusCode).toBe(503);
    expect(failure.body).not.toContain("secret-token");
    for (const url of ["/api/trends/scan", "/api/trends/collector"])
      expect((await app.inject({ method: "POST", url })).statusCode).toBe(404);
    await app.close();
  });
});

describe("freshness and validation", () => {
  it("preserves negative and zero changes and rejects unsafe paths and values", () => {
    const input = upstream();
    input.items[0].hour = -3;
    input.items[1].hour = 0;
    expect(
      publicCatalog(input)
        .items.slice(0, 2)
        .map((r) => r.hour),
    ).toEqual([-3, 0]);
    for (const fullName of [
      "../repo",
      "owner/..",
      "./repo",
      "owner/.",
      "a/b/c",
    ])
      expect(() =>
        publicCatalog({ ...input, items: [{ ...input.items[0], fullName }] }),
      ).toThrow();
    for (const id of [Number.MAX_SAFE_INTEGER + 1, Infinity, 0])
      expect(() =>
        publicCatalog({ ...input, items: [{ ...input.items[0], id }] }),
      ).toThrow();
  });
  it("ages metrics and retains original snapshot timestamps during bounded delayed fallback", async () => {
    let now = Date.now();
    const input = upstream();
    input.items[0].checkedAt = now - 7_190_000;
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(input)))
      .mockRejectedValue(new Error("secret"));
    const read = createCatalogReader(
      "https://collector.example",
      "secret",
      request,
      () => now,
    );
    const first = await read();
    now += 61_000;
    const delayed = await read();
    expect(delayed.fetchedAt).toBe(first.fetchedAt);
    expect(delayed.collection.state).toBe("delayed");
    expect(delayed.items[0].hour).toBeNull();
    expect(delayed.items[0].signal).toBe("stale");
    await read();
    expect(request).toHaveBeenCalledTimes(2);
    now += 600_000;
    await expect(read()).rejects.toThrow("Collector unavailable");
  });
  it("canonicalizes lookup and sanitizes cold authentication failures", async () => {
    const app = createApp(async () => publicCatalog(upstream()));
    const response = await app.inject("/api/v1/repos/DEMO/PATCHWORK");
    expect(response.json().canonicalPath).toBe("/repo/demo/patchwork");
    expect((await app.inject("/api/v1/repos/no/such")).statusCode).toBe(404);
    await app.close();
    for (const status of [401, 403]) {
      const read = createCatalogReader(
        "https://collector.example",
        "private-secret",
        async () => new Response("private detail", { status }),
      );
      const failed = createApp(read);
      const result = await failed.inject("/api/v1/catalog");
      expect(result.statusCode).toBe(503);
      expect(result.body).not.toMatch(/secret|demo|private detail/);
      await failed.close();
    }
  });
});

it("fails closed on revoked collector authorization, even with a warm snapshot", async () => {
  let now = Date.now();
  const request = vi
    .fn()
    .mockResolvedValueOnce(Response.json(upstream()))
    .mockResolvedValue(new Response("private", { status: 403 }));
  const read = createCatalogReader(
    "https://collector.example",
    "secret",
    request,
    () => now,
  );
  await read();
  now += 60001;
  await expect(read()).rejects.toThrow("Collector unavailable");
});
