import { z } from "zod";
import {
  fullNameSchema,
  idSchema,
  timestampSchema,
} from "@devloot-radar/shared/contracts";
export const WATCHLIST_KEY = "devloot-radar:watchlist:v1";
const entrySchema = z.object({
  id: idSchema,
  fullName: fullNameSchema,
  savedAt: timestampSchema,
});
export type SavedEntry = z.infer<typeof entrySchema>;
export function parseWatchlist(raw: string | null): SavedEntry[] {
  if (!raw) return [];
  try {
    const parsed = z
      .object({
        version: z.literal(1),
        entries: z.array(z.unknown()).max(10000),
      })
      .parse(JSON.parse(raw));
    const entries: SavedEntry[] = [];
    const seen = new Set<number>();
    for (const value of parsed.entries) {
      const result = entrySchema.safeParse(value);
      if (result.success && !seen.has(result.data.id)) {
        entries.push(result.data);
        seen.add(result.data.id);
      }
      if (entries.length === 200) break;
    }
    return entries;
  } catch {
    return [];
  }
}
export function toggleEntry(
  entries: SavedEntry[],
  repo: { id: number; fullName: string },
  now = Date.now(),
): SavedEntry[] {
  if (entries.some((e) => e.id === repo.id))
    return entries.filter((e) => e.id !== repo.id);
  if (entries.length >= 200) return entries;
  const entry = entrySchema.parse({ ...repo, savedAt: now });
  return [...entries, entry];
}
export function createWatchlistStore(
  storage: () => Pick<Storage, "getItem" | "setItem"> = () => localStorage,
) {
  let entries: SavedEntry[] = [];
  let persistent = true;
  let message = "";
  try {
    entries = parseWatchlist(storage().getItem(WATCHLIST_KEY));
  } catch {
    persistent = false;
  }
  let snapshot = { entries, persistent, message };
  const listeners = new Set<() => void>();
  const emit = () => {
    snapshot = { entries, persistent, message };
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    toggle: (repo: { id: number; fullName: string }) => {
      // Merge the latest valid tab state before applying this tab's operation.
      if (persistent)
        try {
          entries = parseWatchlist(storage().getItem(WATCHLIST_KEY));
        } catch {
          persistent = false;
        }
      const next = toggleEntry(entries, repo);
      message =
        next === entries
          ? "Your watchlist holds up to 200 repositories. Remove one to save another."
          : "";
      entries = next;
      try {
        storage().setItem(
          WATCHLIST_KEY,
          JSON.stringify({ version: 1, entries }),
        );
      } catch {
        persistent = false;
      }
      emit();
    },
    sync: (raw: string | null) => {
      entries = parseWatchlist(raw);
      message = "";
      emit();
    },
  };
}
