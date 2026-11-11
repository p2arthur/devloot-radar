import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
    : "playwright"
);
const browser = await chromium.launch({ headless: true });
const out = "artifacts/qa/votes-charts";
await mkdir(out, { recursive: true });
const results = [];
const errors = [];
const base = process.env.QA_ORIGIN ?? "http://127.0.0.1:4321";
const check = async (name, fn) => {
  await fn();
  results.push({ name, status: "passed" });
  console.log("PASS", name);
};
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    timezoneId: "America/Vancouver",
  });
  const page = await context.newPage();
  const requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().startsWith("Failed to load resource:")
    )
      errors.push(message.text());
  });
  page.on("request", (request) =>
    requests.push({ url: request.url(), method: request.method() }),
  );
  await check(
    "paired metrics, lazy batched previews, local votes and reload persistence",
    async () => {
      await page.goto(base);
      const row = page
        .locator(".repository")
        .filter({
          has: page.getByRole("link", { name: "demo/patchwork", exact: true }),
        });
      await row.locator(".growth-preview svg").waitFor();
      assert.equal(await row.locator(".mini-metric").count(), 2);
      assert.match(
        await row.locator(".row-deltas").innerText(),
        /1h stars\s*\+42/,
      );
      assert.match(
        await row.locator(".row-deltas").innerText(),
        /6h stars\s*\+70/,
      );
      assert.ok(requests.some((r) => r.url.includes("/api/v1/history?ids=")));
      assert.equal(
        requests.some(
          (r) =>
            r.url.includes("/repos/1/history") ||
            r.url.includes("GrowthChart-"),
        ),
        false,
      );
      await row
        .getByRole("button", { name: "Upvote demo/patchwork", exact: true })
        .click();
      assert.equal(
        await row
          .getByRole("button", {
            name: "Remove vote for demo/patchwork",
            exact: true,
          })
          .getAttribute("aria-pressed"),
        "true",
      );
      await page
        .getByRole("link", { name: "Watchlist 0", exact: true })
        .waitFor();
      await page.reload();
      await page
        .getByRole("button", {
          name: "Remove vote for demo/patchwork",
          exact: true,
        })
        .waitFor();
    },
  );
  await check(
    "profile window selection changes actual samples and retains local vote",
    async () => {
      await page
        .getByRole("link", {
          name: "View demo/patchwork growth chart",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: "Remove vote for demo/patchwork",
          exact: true,
        })
        .waitFor();
      await page.getByText(/View \d+ stored observations as a table/).click();
      assert.equal(await page.getByRole("button", {name:"7 days",exact:true}).getAttribute("aria-pressed"), "true");
      const week = await page.locator("tbody tr").count();
      await page.getByRole("button", { name: "6 hours", exact: true }).click();
      await page.getByText(/View \d+ stored observations as a table/).waitFor();
      if (!await page.locator("tbody").isVisible()) await page.getByText(/View \d+ stored observations as a table/).click();
      const six = await page.locator("tbody tr").count();
      assert.ok(week > six);
      await page.getByRole("button", { name: "1 hour", exact: true }).click();
      const one = await page.locator("tbody tr").count();
      assert.ok(one > 0 && one < six);
      await page.getByRole("button", { name: "6 hours", exact: true }).click();
      assert.equal(await page.locator("tbody tr").count(), six);
      await page
        .getByText("Fictional demo observations · Cumulative stars", {
          exact: true,
        })
        .waitFor();
    },
  );
  await check("cross-tab voting, undo and separation from saves", async () => {
    const tab = await context.newPage();
    await tab.goto(base);
    await tab
      .getByRole("button", {
        name: "Remove vote for demo/patchwork",
        exact: true,
      })
      .waitFor();
    await page
      .getByRole("button", {
        name: "Remove vote for demo/patchwork",
        exact: true,
      })
      .click();
    await tab
      .getByRole("button", { name: "Upvote demo/patchwork", exact: true })
      .waitFor();
    await tab.getByRole("link", { name: "Watchlist 0", exact: true }).waitFor();
    await tab.close();
  });
  await check("responsive charts and controls in both themes", async () => {
    for (const [width, height] of [
      [390, 844],
      [768, 1024],
      [1440, 900],
    ])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(
          (theme) => localStorage.setItem("devloot-radar:theme:v1", theme),
          theme,
        );
        for (const [name, path] of [
          ["list", "/"],
          ["profile", "/repo/demo/patchwork"],
        ]) {
          await page.goto(base + path);
          if (name === "list")
            await page
              .locator(".growth-preview")
              .first()
              .scrollIntoViewIfNeeded();
          await page
            .locator(name === "list" ? ".growth-preview svg" : ".chart svg")
            .first()
            .waitFor();
          if (name === "profile")
            await page.locator(".chart").scrollIntoViewIfNeeded();
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(name === "profile" ? 3500 : 1400);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
            `${name} ${width} ${theme}`,
          );
          await page.screenshot({
            path: `${out}/${name}-${width}-${theme}.png`,
            fullPage: true,
          });
        }
      }
  });
  await check(
    "unavailable live-style history never draws a demo line",
    async () => {
      await page.route("**/api/v1/history?ids=*", (route) => {
        const ids = new URL(route.request().url()).searchParams
          .get("ids")
          .split(",")
          .map(Number);
        return route.fulfill({
          json: {
            items: ids.map((repositoryId) => ({
              repositoryId,
              history: null,
              availability: "unavailable",
            })),
          },
        });
      });
      await page.goto(base);
      await page
        .getByText("History unavailable", { exact: true })
        .first()
        .waitFor();
      assert.equal(await page.locator(".growth-preview svg").count(), 0);
      await page.unroute("**/api/v1/history?ids=*");
      await page.route("**/api/v1/repos/1/history?window=7d", (route) =>
        route.fulfill({ status: 501, json: { code: "HISTORY_NOT_AVAILABLE" } }),
      );
      await page.goto(base + "/repo/demo/patchwork");
      await page
        .getByText("Observation history is unavailable.", { exact: true })
        .waitFor();
      await page.getByRole("heading", { name: "What changed" }).waitFor();
      await page.getByRole("button", {name:"24 hours",exact:true}).click();
      await page.locator(".chart svg").first().waitFor();
      await page.unroute("**/api/v1/repos/1/history?window=7d");
    },
  );
  await check(
    "reduced motion, keyboard voting and blocked storage",
    async () => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(base);
      await page.locator(".preview-line").first().waitFor();
      assert.equal(
        await page
          .locator(".preview-line")
          .first()
          .evaluate((el) => getComputedStyle(el).animationName),
        "none",
      );
      const vote = page.getByRole("button", {
        name: "Upvote demo/patchwork",
        exact: true,
      });
      await vote.focus();
      await page.keyboard.press("Enter");
      await page
        .getByRole("button", {
          name: "Remove vote for demo/patchwork",
          exact: true,
        })
        .waitFor();
      await page.keyboard.press("Enter");
      await vote.waitFor();
      const blocked = await browser.newContext();
      await blocked.addInitScript(() =>
        Object.defineProperty(window, "localStorage", {
          get() {
            throw Error("blocked");
          },
        }),
      );
      const p = await blocked.newPage();
      await p.goto(base);
      await p
        .getByRole("button", { name: "Upvote demo/patchwork", exact: true })
        .click();
      await p
        .getByRole("button", {
          name: "Remove vote for demo/patchwork",
          exact: true,
        })
        .waitFor();
      await p
        .locator(".vote-scope")
        .filter({ hasText: "Session only" })
        .first()
        .waitFor();
      await blocked.close();
    },
  );
  assert.deepEqual(errors, []);
  assert.equal(
    requests.some((r) => r.method !== "GET"),
    false,
  );
  await writeFile(
    out + "/results.json",
    JSON.stringify(
      {
        results,
        pageErrors: errors,
        networkWrites: requests.filter((r) => r.method !== "GET"),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
