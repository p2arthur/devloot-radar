import { z } from "zod";
import {
  repositorySchema,
  timestampSchema,
  type Catalog,
} from "@devloot-radar/shared/contracts";
import { ageCatalog, coverage } from "@devloot-radar/shared/measurements";
const upstreamSchema = z.object({
  items: z
    .array(repositorySchema.extend({ dismissed: z.boolean() }))
    .max(20000),
  collector: z.object({
    lastRun: timestampSchema,
    intervalMinutes: z.number().positive().max(1440),
  }),
});
export function publicCatalog(input: unknown, now = Date.now()): Catalog {
  const parsed = upstreamSchema.parse(input);
  const items = parsed.items
    .filter((item) => !item.dismissed)
    .map((item) => repositorySchema.parse(item));
  if (
    new Set(items.map((i) => i.id)).size !== items.length ||
    new Set(items.map((i) => i.fullName.toLowerCase())).size !== items.length
  )
    throw new Error("Invalid catalog");
  return ageCatalog(
    {
      mode: "live",
      fetchedAt: now,
      lastCollectionAt: parsed.collector.lastRun,
      scoringVersion: "collector-v1",
      collection: {
        state: "available",
        intervalMinutes: parsed.collector.intervalMinutes,
      },
      coverage: coverage(items, now),
      items,
    },
    now,
  );
}
export function collectorOrigin(origin: string, token: string, allowLoopbackHttp = false): URL {
  const url = new URL(origin);
  if (
    (url.protocol !== "https:" && !(allowLoopbackHttp && url.protocol === "http:" && ["127.0.0.1", "[::1]"].includes(url.hostname))) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    !token.trim()
  )
    throw new Error(
      "Configure an HTTPS collector origin and a server-only token.",
    );
  return url;
}
export function createCatalogReader(
  origin: string,
  token: string,
  request = fetch,
  now = Date.now,
  allowLoopbackHttp = false,
) {
  const url = collectorOrigin(origin, token, allowLoopbackHttp);
  let cache: Catalog | undefined;
  let pending: Promise<Catalog> | undefined;
  let retryAfter = 0;
  return async function read(): Promise<Catalog> {
    if (cache && now() - cache.fetchedAt < 60_000)
      return ageCatalog(cache, now());
    if (cache && now() < retryAfter && now() - cache.fetchedAt <= 600_000)
      return ageCatalog(
        { ...cache, collection: { ...cache.collection, state: "delayed" } },
        now(),
      );
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await request(new URL("/api/trends", url), {
          headers: { Authorization: `Bearer ${token}` },
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403)
            cache = undefined;
          await response.body?.cancel();
          throw new Error("Collector unavailable");
        }
        cache = publicCatalog(await response.json(), now());
        retryAfter = 0;
        return cache;
      } catch {
        retryAfter = now() + 60_000;
        if (cache && now() - cache.fetchedAt <= 600_000)
          return ageCatalog(
            { ...cache, collection: { ...cache.collection, state: "delayed" } },
            now(),
          );
        throw new Error("Collector unavailable");
      }
    })();
    try {
      return await pending;
    } finally {
      pending = undefined;
    }
  };
}
