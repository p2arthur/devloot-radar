import { z } from "zod";
import { idSchema } from "@devloot-radar/shared/contracts";
export const VOTES_KEY = "devloot-radar:votes:v1";
const MAX_VOTES = 2000;
export function parseVotes(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = z
      .object({ version: z.literal(1), ids: z.array(idSchema).max(MAX_VOTES) })
      .parse(JSON.parse(raw));
    return [...new Set(parsed.ids)];
  } catch {
    return [];
  }
}
export function createVotesStore(
  storage: () => Pick<Storage, "getItem" | "setItem"> = () => localStorage,
) {
  let ids: number[] = [];
  let persistent = true;
  let message = "";
  try {
    ids = parseVotes(storage().getItem(VOTES_KEY));
  } catch {
    persistent = false;
  }
  let snapshot = { ids, persistent, message };
  const listeners = new Set<() => void>();
  const emit = () => {
    snapshot = { ids, persistent, message };
    listeners.forEach((fn) => fn());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    toggle: (id: number) => {
      idSchema.parse(id);
      if (persistent)
        try {
          ids = parseVotes(storage().getItem(VOTES_KEY));
        } catch {
          persistent = false;
        }
      message = "";
      if (ids.includes(id)) ids = ids.filter((value) => value !== id);
      else if (ids.length < MAX_VOTES) ids = [...ids, id];
      else
        message =
          "This browser holds up to 2,000 votes. Remove a vote before adding another.";
      try {
        storage().setItem(VOTES_KEY, JSON.stringify({ version: 1, ids }));
      } catch {
        persistent = false;
      }
      emit();
    },
    sync: (raw: string | null) => {
      ids = parseVotes(raw);
      message = "";
      emit();
    },
  };
}
