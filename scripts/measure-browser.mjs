import { pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
    : "playwright"
);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const client = await page.context().newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.setCacheDisabled", { cacheDisabled: true });
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 1600000 / 8,
    uploadThroughput: 750000 / 8,
  });
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    window.radarPerf = { lcp: null, cls: 0, events: [], shifts: [] };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.radarPerf.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (!e.hadRecentInput) {
          window.radarPerf.cls += e.value;
          window.radarPerf.shifts.push({
            value: e.value,
            sources: e.sources.map((s) => ({
              node: s.node?.tagName,
              cls: s.node?.className,
              before: s.previousRect.toJSON(),
              after: s.currentRect.toJSON(),
            })),
          });
        }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (e.interactionId)
          window.radarPerf.events.push({ name: e.name, duration: e.duration });
    }).observe({ type: "event", buffered: true, durationThreshold: 16 });
  });
  await page.goto(process.env.QA_ORIGIN ?? "http://127.0.0.1:4321");
  await page.locator(".repository").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Growth", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Window", exact: true })
    .selectOption("6h");
  await page.getByRole("searchbox").fill("patchwork");
  await page.waitForTimeout(500);
  const metrics = await page.evaluate(() => ({
    ...window.radarPerf,
    resources: performance
      .getEntriesByType("resource")
      .filter((r) => r.name.includes("/assets/"))
      .map((r) => ({
        name: r.name.split("/").at(-1),
        transferSize: r.transferSize,
      })),
  }));
  const result = {
    profile:
      "Chromium headless, 390×844, DPR 1, mobile/touch, CPU 4× slowdown, 1.6 Mbps down / 750 Kbps up, 150 ms latency, cold cache, loopback demo build",
    browser: browser.version(),
    metrics,
    limitations:
      "One local lab run, not field Core Web Vitals. Event durations are a small interaction sample, not a measured p75 INP. CLS is the sum of observed shifts without recent input.",
  };
  console.log(JSON.stringify(result, null, 2));
  await writeFile(
    "artifacts/qa/performance.json",
    JSON.stringify(result, null, 2),
  );
} finally {
  await browser.close();
}
