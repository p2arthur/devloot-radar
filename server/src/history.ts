import { z } from "zod";
import { idSchema, pointSchema, historyWindowSchema, historyDuration, historyPointLimit, type HistoryWindow, type History } from "@devloot-radar/shared/contracts";
import { collectorOrigin } from "./catalog";
export class HistoryError extends Error {
  constructor(public status: 501 | 503 = 503) {
    super("History unavailable");
  }
}
export function publicHistory(
  input: unknown,
  id: number,
  now = Date.now(),
  window: HistoryWindow = "24h",
): History {
  const parsed = z
    .object({
      repositoryId: idSchema,
      window: historyWindowSchema,
      points: z.array(pointSchema).max(100000),
    })
    .parse(input);
  if (parsed.repositoryId !== id || parsed.window !== window) throw new Error("Invalid history identity");
  const sorted = parsed.points.sort((a, b) => a.at - b.at);
  if (new Set(sorted.map((p) => p.at)).size !== sorted.length)
    throw new Error("Duplicate timestamp");
  const points = sorted.filter((p) => p.at >= now - historyDuration(window) && p.at <= now);
  const limit = historyPointLimit(window);
  const bounded =
    points.length <= limit
      ? points
      : Array.from(
          { length: limit },
          (_, i) => points[Math.floor((i * (points.length - 1)) / (limit - 1))],
        );
  return {
    repositoryId: id,
    window,
    fetchedAt: now,
    points: bounded,
    availability: bounded.length >= 2 ? "available" : "insufficient",
  };
}
export function createHistoryReader(
  origin: string,
  token: string,
  request = fetch,
  now = Date.now,
  allowLoopbackHttp = false,
) {
  const url = collectorOrigin(origin, token, allowLoopbackHttp);
  const cache = new Map<string, History>();
  const pending = new Map<string, Promise<History>>();
  const failures = new Map<string, { until: number; status: 501 | 503 }>();
  return async (id: number, window: HistoryWindow = "24h"): Promise<History> => {
    historyWindowSchema.parse(window);
    const key = `${id}:${window}`;
    idSchema.parse(id);
    const failure = failures.get(key);
    if (failure && now() < failure.until)
      throw new HistoryError(failure.status);
    failures.delete(key);
    const cached = cache.get(key);
    if (cached && now() - cached.fetchedAt < 60_000) {
      cache.delete(key);
      cache.set(key, cached);
      return {
        ...publicHistory(cached, id, now(), window),
        fetchedAt: cached.fetchedAt,
      };
    }
    if (pending.has(key)) return pending.get(key)!;
    // Bound concurrent distinct reads as well as stored histories.
    if (pending.size >= 200) throw new HistoryError();
    const task = (async () => {
      try {
        const response = await request(
          new URL(`/api/trends/${id}/history?window=${window}`, url),
          {
            headers: { Authorization: `Bearer ${token}` },
            redirect: "error",
            signal: AbortSignal.timeout(10000),
          },
        );
        if (!response.ok) {
          await response.body?.cancel();
          throw new HistoryError(
            response.status === 404 || response.status === 501 ? 501 : 503,
          );
        }
        const history = publicHistory(await response.json(), id, now(), window);
        cache.delete(key);
        cache.set(key, history);
        if (cache.size > 200) cache.delete(cache.keys().next().value!);
        return history;
      } catch (error) {
        const safeError =
          error instanceof HistoryError ? error : new HistoryError();
        failures.set(key, { until: now() + 60_000, status: safeError.status });
        if (failures.size > 200) failures.delete(failures.keys().next().value!);
        throw safeError;
      }
    })();
    pending.set(key, task);
    try {
      return await task;
    } finally {
      pending.delete(key);
    }
  };
}
