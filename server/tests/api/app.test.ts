import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { createApp } from "../../src/app";
import { registerWeb } from "../../src/web";
import { readConfig } from "../../src/config";
import { demoCatalog } from "@devloot-radar/shared/demo";
describe("production route boundary", () => {
  it("serves direct routes, escapes metadata, rejects unknown APIs/assets, and trusts only configured origin", async () => {
    const root = await mkdtemp(join(tmpdir(), "radar-web-"));
    await writeFile(
      join(root, "index.html"),
      '<!doctype html><head><title>Base</title><meta name="description" content="base"><meta name="robots" content="noindex,nofollow"></head><body><div id="root"></div></body>',
    );
    const catalog = demoCatalog();
    catalog.items[0].description =
      '</title><script>alert("secret")</script> & text';
    const app = createApp(async () => catalog);
    try {
      await registerWeb(
        app,
        async () => catalog,
        root,
        "https://radar.example",
      );
      for (const path of [
        "/",
        "/methodology",
        "/watchlist",
        "/repo/demo/patchwork",
      ])
        expect((await app.inject(path)).statusCode).toBe(200);
      const repo = await app.inject({
        url: "/repo/demo/patchwork?anything=duplicate",
        headers: { host: "evil.example" },
      });
      expect(repo.body).toContain("https://radar.example/repo/demo/patchwork");
      expect(repo.body).not.toContain("evil.example");
      expect(repo.body).toContain("&lt;script&gt;");
      expect(repo.body).not.toContain("<script>alert");
      expect((await app.inject("/repo/DEMO/PATCHWORK")).statusCode).toBe(308);
      for (const path of ["/repo/unknown/nope", "/no-such-page"])
        expect((await app.inject(path)).statusCode).toBe(404);
      for (const path of [
        "/api/not-found",
        "/assets/missing.js",
        "/missing.css",
        "/brand/missing.svg",
      ]) {
        const result = await app.inject(path);
        expect(result.statusCode).toBe(404);
        expect(result.headers["content-type"]).not.toContain("text/html");
      }
      expect((await app.inject("/robots.txt")).body).toContain("Disallow: /");
      expect((await app.inject("/sitemap.xml")).body).not.toContain("<loc>");
      expect(
        (await app.inject({ method: "POST", url: "/repo/demo/patchwork" }))
          .statusCode,
      ).toBe(404);
    } finally {
      await app.close();
      await rm(root, { recursive: true, force: true });
    }
  });
  it("rejects missing live config and never enables production demo mode", () => {
    for (const env of [
      { NODE_ENV: "production" },
      { DATA_MODE: "live" },
      { DATA_MODE: "live", TRENDS_REMOTE_URL: "https://collector.example" },
      { NODE_ENV: "production", DATA_MODE: "demo" },
    ])
      expect(() => readConfig(env)).toThrow();
    expect(readConfig({}).host).toBe("127.0.0.1");
  });
  it("returns unavailable history independently of repository overview", async () => {
    const app = createApp(async () => demoCatalog());
    expect(
      (await app.inject("/api/v1/repos/1/history?window=24h")).statusCode,
    ).toBe(501);
    expect((await app.inject("/api/v1/repos/demo/patchwork")).statusCode).toBe(
      200,
    );
    await app.close();
  });
});
