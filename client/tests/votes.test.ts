import { describe, expect, it, vi } from "vitest";
import { createVotesStore, parseVotes, VOTES_KEY } from "../src/lib/votes";
describe("browser-local votes", () => {
  it("persists one reversible vote per numeric repository identity", () => {
    const data = new Map<string, string>();
    const storage = () => ({
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    });
    const store = createVotesStore(storage);
    store.toggle(42);
    expect(store.getSnapshot().ids).toEqual([42]);
    const reloaded = createVotesStore(storage);
    expect(reloaded.getSnapshot().ids).toEqual([42]);
    reloaded.toggle(42);
    expect(reloaded.getSnapshot().ids).toEqual([]);
    expect(data.has(VOTES_KEY)).toBe(true);
    expect(data.has("devloot-radar:watchlist:v1")).toBe(false);
  });
  it("validates, deduplicates and bounds untrusted stored votes", () => {
    expect(parseVotes("{broken")).toEqual([]);
    expect(parseVotes(JSON.stringify({ version: 2, ids: [1] }))).toEqual([]);
    expect(parseVotes(JSON.stringify({ version: 1, ids: [1, 1, 2] }))).toEqual([
      1, 2,
    ]);
    for (const ids of [
      [0],
      [-1],
      [Number.MAX_SAFE_INTEGER + 1],
      Array.from({ length: 2001 }, (_, i) => i + 1),
    ])
      expect(parseVotes(JSON.stringify({ version: 1, ids }))).toEqual([]);
  });
  it("continues with session state when reads or writes fail", () => {
    const blocked = createVotesStore(() => {
      throw Error("blocked");
    });
    blocked.toggle(7);
    expect(blocked.getSnapshot()).toMatchObject({
      ids: [7],
      persistent: false,
    });
    blocked.toggle(7);
    expect(blocked.getSnapshot().ids).toEqual([]);
    const writes = createVotesStore(() => ({
      getItem: () => null,
      setItem: () => {
        throw Error("quota");
      },
    }));
    writes.toggle(9);
    writes.toggle(10);
    expect(writes.getSnapshot()).toMatchObject({
      ids: [9, 10],
      persistent: false,
    });
  });
  it("synchronizes other tabs and clear events", () => {
    const store = createVotesStore(() => ({
      getItem: () => null,
      setItem: () => {},
    }));
    const listener = vi.fn();
    store.subscribe(listener);
    store.sync(JSON.stringify({ version: 1, ids: [2] }));
    expect(store.getSnapshot().ids).toEqual([2]);
    store.sync(null);
    expect(store.getSnapshot().ids).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
