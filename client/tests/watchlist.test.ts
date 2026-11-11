import { describe, it, expect, vi } from "vitest";
import {
  createWatchlistStore,
  parseWatchlist,
  toggleEntry,
  WATCHLIST_KEY,
} from "../src/lib/watchlist";
const repo = { id: 1, fullName: "demo/one" };
describe("browser watchlist", () => {
  it("saves, reloads and removes by stable ID through renames", () => {
    const storage = new Map<string, string>();
    const access = () => ({
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storage.set(k, v);
      },
    });
    const store = createWatchlistStore(access);
    store.toggle(repo);
    expect(createWatchlistStore(access).getSnapshot().entries).toHaveLength(1);
    store.toggle({ ...repo, fullName: "demo/renamed" });
    expect(store.getSnapshot().entries).toEqual([]);
  });
  it("deduplicates and strips extra fields, rejecting malformed records", () => {
    expect(parseWatchlist("{broken")).toEqual([]);
    expect(parseWatchlist(JSON.stringify({ version: 2, entries: [] }))).toEqual(
      [],
    );
    expect(
      parseWatchlist(
        JSON.stringify({
          version: 1,
          entries: [
            { ...repo, savedAt: 1, secret: "x" },
            { ...repo, savedAt: 2 },
            { id: -1 },
          ],
        }),
      ),
    ).toEqual([{ ...repo, savedAt: 1 }]);
  });
  it("keeps blocked storage session-only and reversible", () => {
    const store = createWatchlistStore(() => {
      throw Error("blocked");
    });
    store.toggle(repo);
    expect(store.getSnapshot()).toMatchObject({
      persistent: false,
      entries: [{ ...repo }],
    });
    store.toggle(repo);
    expect(store.getSnapshot().entries).toHaveLength(0);
  });
  it("synchronizes tab state and clears", () => {
    const store = createWatchlistStore(() => ({
      getItem: () => null,
      setItem: () => {},
    }));
    const listener = vi.fn();
    store.subscribe(listener);
    store.sync(
      JSON.stringify({ version: 1, entries: [{ ...repo, savedAt: 2 }] }),
    );
    expect(store.getSnapshot().entries[0].id).toBe(1);
    store.sync(null);
    expect(store.getSnapshot().entries).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
  });
  it("enforces 200 saves without evicting existing entries", () => {
    let entries = [] as ReturnType<typeof parseWatchlist>;
    for (let i = 1; i <= 201; i++)
      entries = toggleEntry(entries, { id: i, fullName: `demo/repo-${i}` }, 1);
    expect(entries).toHaveLength(200);
    expect(entries[0].id).toBe(1);
    expect(WATCHLIST_KEY).toBe("devloot-radar:watchlist:v1");
  });
});
