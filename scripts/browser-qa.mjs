// Run against the built loopback server. Reuse an installed Playwright module via PLAYWRIGHT_MODULE.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
    : "playwright"
);
const base = process.env.QA_ORIGIN ?? "http://127.0.0.1:4321";
const out = "artifacts/qa";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const errors = [];
const check = async (name, fn) => {
  await fn();
  results.push({ name, status: "passed" });
  console.log("PASS", name);
};
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().startsWith("Failed to load resource:")
    )
      errors.push(message.text());
  });
  page.on("request", (r) =>
    requests.push({ url: r.url(), method: r.method() }),
  );
  await check("primary journey on production build", async () => {
    await page.goto(base);
    await page.getByRole("button", { name: "Growth", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Window", exact: true })
      .selectOption("6h");
    await page
      .getByRole("combobox", { name: "Language", exact: true })
      .selectOption("TypeScript");
    assert.equal(
      await page.locator(".repository").first().locator("h3").innerText(),
      "demo/six-hour-notebook",
    );
    assert.equal(
      requests.some((r) => /repos\/\d+\/history|GrowthChart/.test(r.url)),
      false,
    );
    await page
      .getByRole("link", { name: "demo/six-hour-notebook", exact: true })
      .first()
      .click();
    await page
      .getByRole("heading", { name: "Star growth", exact: true })
      .waitFor();
    await page.getByRole("heading", { name: "What changed" }).waitFor();
    await page
      .getByRole("button", {
        name: "Save demo/six-hour-notebook to watchlist",
        exact: true,
      })
      .click();
    await page.getByRole("link", { name: "Watchlist 1", exact: true }).click();
    await page.reload();
    await page
      .getByRole("button", {
        name: "Remove demo/six-hour-notebook from watchlist",
        exact: true,
      })
      .click();
    await page
      .getByRole("heading", { name: "Keep something worth returning to." })
      .waitFor();
    await page.goBack();
    await page.getByRole("link", { name: "Back to discovery" }).click();
    assert.match(page.url(), /window=6h/);
    assert.match(page.url(), /language=TypeScript/);
    assert.equal(
      requests.some((r) => r.method !== "GET"),
      false,
    );
  });
  await check("direct route, canonical case and copy failure", async () => {
    await page.goto(base + "/repo/DEMO/PATCHWORK");
    assert.equal(new URL(page.url()).pathname, "/repo/demo/patchwork");
    await page
      .getByRole("heading", { name: "demo/patchwork", exact: true })
      .waitFor();
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(Error("denied")) },
      });
    });
    await page.getByRole("button", { name: "Copy link", exact: true }).click();
    await page
      .getByText("Couldn’t copy automatically. Select this link:", {
        exact: false,
      })
      .waitFor();
    assert.equal(
      await page.locator(".copy-fallback input").inputValue(),
      base + "/repo/demo/patchwork",
    );
  });
  await check("responsive light and dark layouts", async () => {
    for (const [width, height] of [
      [390, 844],
      [768, 1024],
      [1440, 900],
    ])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height });
        await page.evaluate((t) => {
          localStorage.setItem("devloot-radar:theme:v1", t);
        }, theme);
        for (const [name, path] of [
          ["discover", "/"],
          ["repo", "/repo/demo/patchwork"],
          ["methodology", "/methodology"],
          ["watchlist", "/watchlist"],
        ]) {
          await page.goto(base + path);
          await page.locator(".demo").waitFor();
          await page.evaluate(() => document.fonts.ready);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
            `${name} ${width} ${theme} overflow`,
          );
          await page.screenshot({
            path: `${out}/${name}-${width}-${theme}.png`,
            fullPage: true,
          });
        }
      }
  });
  await check(
    "keyboard search, Escape and visible focus; reduced motion",
    async () => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(base);
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent),
        "Skip to content",
      );
      assert.notEqual(
        await page.evaluate(
          () => getComputedStyle(document.activeElement).outlineStyle,
        ),
        "none",
      );
      await page.keyboard.press("Enter");
      await page.getByRole("searchbox").focus();
      await page.keyboard.type("seedling");
      await page.waitForTimeout(350);
      await page.getByText("1 matching repos · 0 ranked").waitFor();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(350);
      assert.equal(await page.getByRole("searchbox").inputValue(), "");
      assert.equal(
        await page.evaluate(
          () => matchMedia("(prefers-reduced-motion: reduce)").matches,
        ),
        true,
      );
    },
  );
  await check(
    "cross-tab saves and unavailable ID; malformed storage",
    async () => {
      await page.goto(base);
      await page
        .getByRole("button", {
          name: "Save demo/patchwork to watchlist",
          exact: true,
        })
        .click();
      const tab = await context.newPage();
      await tab.goto(base + "/watchlist");
      await tab
        .getByRole("button", {
          name: "Remove demo/patchwork from watchlist",
          exact: true,
        })
        .waitFor();
      await page
        .getByRole("button", {
          name: "Remove demo/patchwork from watchlist",
          exact: true,
        })
        .click();
      await tab
        .getByRole("heading", { name: "Keep something worth returning to." })
        .waitFor();
      await page.evaluate(() =>
        localStorage.setItem(
          "devloot-radar:watchlist:v1",
          JSON.stringify({
            version: 1,
            entries: [{ id: 999999, fullName: "demo/unavailable", savedAt: 1 }],
          }),
        ),
      );
      await tab.getByText("No current public data", { exact: true }).waitFor();
      await tab
        .getByRole("button", { name: "Remove demo/unavailable from watchlist" })
        .click();
      await tab.close();
      await page.evaluate(() =>
        localStorage.setItem("devloot-radar:watchlist:v1", "{broken"),
      );
      await page.reload();
      await page
        .getByRole("link", { name: "Watchlist 0", exact: true })
        .waitFor();
    },
  );
  await check("blocked storage still saves for the session", async () => {
    const blocked = await browser.newContext();
    await blocked.addInitScript(() =>
      Object.defineProperty(window, "localStorage", {
        get() {
          throw Error("blocked");
        },
      }),
    );
    const p = await blocked.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(base);
    await p
      .getByRole("button", {
        name: "Save demo/patchwork to watchlist",
        exact: true,
      })
      .click();
    await p.getByRole("link", { name: "Watchlist 1", exact: true }).click();
    await p
      .getByText("Browser storage is unavailable.", { exact: false })
      .waitFor();
    await p
      .getByRole("button", {
        name: "Remove demo/patchwork from watchlist",
        exact: true,
      })
      .click();
    await blocked.close();
  });
  // Explicit test fixtures injected only in the browser harness, never as runtime outage fallback.
  const catalog = await (
    await context.request.get(base + "/api/v1/catalog")
  ).json();
  const now = Date.now();
  await check("real-point chart contract and data table", async () => {
    await page.route("**/api/v1/repos/1/history?window=7d", (route) =>
      route.fulfill({
        json: {
          repositoryId: 1,
          window: "7d",
          fetchedAt: now,
          availability: "available",
          points: [
            { at: now - 3600000, stars: 800, forks: 40 },
            { at: now - 2700000, stars: 812, forks: 42 },
            { at: now - 300000, stars: 842, forks: 47 },
          ],
        },
      }),
    );
    await page.goto(base + "/repo/demo/patchwork");
    await page
      .getByText(
        "+42 net stars between the first and last displayed observations.",
      )
      .waitFor();
    await page.getByText("View 3 stored observations as a table").click();
    assert.equal(await page.locator("tbody tr").count(), 3);
    await page.screenshot({
      path: out + "/chart-contract-1440-dark.png",
      fullPage: true,
    });
    await page.unroute("**/api/v1/repos/1/history?window=7d");
  });
  await check(
    "null-heavy live-style data, empty catalog and 503 never become demo",
    async () => {
      await page.route("**/api/v1/catalog", (route) =>
        route.fulfill({
          json: {
            ...catalog,
            mode: "live",
            items: catalog.items.map((r) => ({
              ...r,
              hour: null,
              signal: "new",
              acceleration: null,
            })),
          },
        }),
      );
      await page.goto(base);
      await page.getByText("This window is building a baseline.").waitFor();
      assert.equal(await page.locator(".demo").count(), 0);
      assert.equal(
        await page
          .locator(".repository .rank")
          .filter({ hasText: /\d/ })
          .count(),
        0,
      );
      await page.screenshot({
        path: out + "/null-heavy-live-style.png",
        fullPage: true,
      });
      await page.unroute("**/api/v1/catalog");
      await page.route("**/api/v1/catalog", (route) =>
        route.fulfill({ json: { ...catalog, mode: "live", items: [] } }),
      );
      await page.reload();
      await page.getByText("No observed repositories yet.").waitFor();
      await page.unroute("**/api/v1/catalog");
      await page.route("**/api/v1/catalog", (route) =>
        route.fulfill({ status: 503, json: { error: "Unavailable" } }),
      );
      await page.reload();
      await page.getByText("The radar couldn’t load.").waitFor();
      assert.equal(await page.locator(".repository,.demo").count(), 0);
      await page.unroute("**/api/v1/catalog");
    },
  );
  await check(
    "pagination resets after filters and browser back/forward",
    async () => {
      const many = Array.from({ length: 56 }, (_, i) => ({
        ...catalog.items[0],
        id: i + 100,
        fullName: `demo/project-${i}`,
        language: i % 2 ? "Rust" : "Go",
      }));
      await page.route("**/api/v1/catalog", (route) =>
        route.fulfill({ json: { ...catalog, items: many } }),
      );
      await page.goto(base);
      await page.locator(".repository").nth(24).waitFor();
      assert.equal(await page.locator(".repository").count(), 25);
      await page.getByRole("button", { name: /Show 25 more/ }).click();
      await page.locator(".repository").nth(49).waitFor();
      assert.equal(await page.locator(".repository").count(), 50);
      await page
        .getByRole("combobox", { name: "Language", exact: true })
        .selectOption("Rust");
      assert.equal(await page.locator(".repository").count(), 25);
      await page.goBack();
      assert.equal(
        await page
          .getByRole("combobox", { name: "Language", exact: true })
          .inputValue(),
        "",
      );
      await page.goForward();
      assert.equal(
        await page
          .getByRole("combobox", { name: "Language", exact: true })
          .inputValue(),
        "Rust",
      );
      await page.unroute("**/api/v1/catalog");
    },
  );
  await check(
    "zero and one-point history, rename retention and cached aging",
    async () => {
      for (const count of [0, 1]) {
        await page.route("**/api/v1/repos/1/history?window=7d", (route) =>
          route.fulfill({
            json: {
              repositoryId: 1,
              window: "7d",
              fetchedAt: now,
              availability: "insufficient",
              points: count ? [{ at: now - 1000, stars: 842, forks: 47 }] : [],
            },
          }),
        );
        await page.goto(base + "/repo/demo/patchwork");
        await page
          .getByText(
            count
              ? "Waiting for another observation."
              : "No observations in the last 7d.",
            { exact: true },
          )
          .waitFor();
        await page.unroute("**/api/v1/repos/1/history?window=7d");
      }
      await page.evaluate(() =>
        localStorage.setItem(
          "devloot-radar:watchlist:v1",
          JSON.stringify({
            version: 1,
            entries: [{ id: 1, fullName: "demo/old-name", savedAt: 1 }],
          }),
        ),
      );
      await page.goto(base + "/watchlist");
      await page
        .getByRole("button", {
          name: "Remove demo/patchwork from watchlist",
          exact: true,
        })
        .waitFor();
      assert.equal(
        await page.getByText("demo/old-name", { exact: true }).count(),
        0,
      );
      await page
        .getByRole("button", {
          name: "Remove demo/patchwork from watchlist",
          exact: true,
        })
        .click();
      const aging = await browser.newContext();
      const p = await aging.newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      await p.clock.install({ time: new Date(now) });
      await p.route("**/api/v1/catalog", (route) =>
        route.fulfill({
          json: {
            ...catalog,
            fetchedAt: now,
            items: [{ ...catalog.items[0], checkedAt: now - 7199000 }],
          },
        }),
      );
      await p.goto(base);
      await p.locator(".repository").first().waitFor();
      await p.clock.runFor(16000);
      assert.equal(await p.locator(".repository").count(), 0);
      await aging.close();
    },
  );
  assert.deepEqual(errors, []);
  await writeFile(
    out + "/browser-results.json",
    JSON.stringify(
      {
        base,
        results,
        pageErrors: errors,
        networkWrites: requests.filter((r) => r.method !== "GET"),
      },
      null,
      2,
    ),
  );
  await context.close();
} finally {
  await browser.close();
}
