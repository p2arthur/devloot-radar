// Read-only operational evidence. No credentials or raw collector payloads are printed.
import { readFileSync, appendFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { publicCatalog, collectorOrigin } from "../server/src/catalog";
const source = process.argv[2];
const env = source ? parseEnv(readFileSync(source, "utf8")) : process.env;
const origin = collectorOrigin(
  env.TRENDS_REMOTE_URL ?? "",
  env.TRENDS_API_TOKEN ?? "",
);
const started = Date.now();
try {
  const response = await fetch(new URL("/api/trends", origin), {
    headers: { Authorization: `Bearer ${env.TRENDS_API_TOKEN}` },
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Catalog read failed");
  const raw = await response.json();
  const now = Date.now();
  const catalog = publicCatalog(raw, now);
  const tracked = catalog.items.filter((r) => r.tracking);
  const cohort = tracked.filter((r) => now - r.firstSeen >= 90 * 60_000);
  const daily = tracked.filter((r) => now - r.firstSeen >= 24 * 3_600_000);
  const ages = tracked
    .map((r) => (now - r.checkedAt) / 60_000)
    .sort((a, b) => a - b);
  const selected =
    tracked.find((r) => r.hour === null && r.sixHours !== null) ?? tracked[0];
  let historyStatus: number | null = null;
  if (selected) {
    const h = await fetch(
      new URL(`/api/trends/${selected.id}/history?window=24h`, origin),
      {
        headers: { Authorization: `Bearer ${env.TRENDS_API_TOKEN}` },
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      },
    );
    historyStatus = h.status;
    await h.body?.cancel();
  }
  const evidence = {
    checkedAt: new Date(now).toISOString(),
    durationMs: now - started,
    mode: catalog.mode,
    coverage: catalog.coverage,
    tracked: tracked.length,
    intervalMinutes: catalog.collection.intervalMinutes,
    lastCompletedCollection: new Date(catalog.lastCollectionAt).toISOString(),
    hourlyAgeEligible: cohort.length,
    hourlyMeasured: cohort.filter((r) => r.hour !== null).length,
    hourlyCoverage: cohort.length
      ? cohort.filter((r) => r.hour !== null).length / cohort.length
      : null,
    firstSeen24hCohort: daily.length,
    dailyMeasured: daily.filter((r) => r.day !== null).length,
    observationAgeMinutes: {
      min: ages[0] ?? null,
      median: ages[Math.floor(ages.length / 2)] ?? null,
      max: ages.at(-1) ?? null,
    },
    oldestFirstSeen: tracked.length
      ? new Date(Math.min(...tracked.map((r) => r.firstSeen))).toISOString()
      : null,
    historyStatus,
  };
  console.log(JSON.stringify(evidence, null, 2));
  if (process.argv[3])
    appendFileSync(process.argv[3], JSON.stringify(evidence) + "\n");
} catch {
  console.error(
    "Coverage check failed; credential details and raw upstream output withheld.",
  );
  process.exitCode = 1;
}
