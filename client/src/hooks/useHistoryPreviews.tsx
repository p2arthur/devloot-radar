import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  historyBatchSchema,
  type History,
  type HistoryPreview,
} from "@devloot-radar/shared/contracts";
type Context = {
  register: (id: number, visible: boolean) => void;
  entries: Map<number, HistoryPreview>;
  intervalMinutes: number;
  demo: boolean;
};
const Previews = createContext<Context>({
  register: () => {},
  entries: new Map(),
  intervalMinutes: 15,
  demo: false,
});
export function HistoryPreviewsProvider({
  children,
  intervalMinutes,
  demo,
}: {
  children: ReactNode;
  intervalMinutes: number;
  demo: boolean;
}) {
  const client = useQueryClient();
  const [visible, setVisible] = useState<number[]>([]);
  const [requested, setRequested] = useState<number[]>([]);
  const register = useCallback(
    (id: number, show: boolean) =>
      setVisible((current) =>
        show
          ? current.includes(id)
            ? current
            : [...current, id].sort((a, b) => a - b)
          : current.filter((value) => value !== id),
      ),
    [],
  );
  useEffect(() => {
    const timer = setTimeout(() => setRequested(visible), 80);
    return () => clearTimeout(timer);
  }, [visible]);
  const chunks = useMemo(
    () =>
      Array.from({ length: Math.ceil(requested.length / 25) }, (_, i) =>
        requested.slice(i * 25, i * 25 + 25),
      ),
    [requested],
  );
  const results = useQueries({
    queries: chunks.map((ids) => ({
      queryKey: ["history-previews", demo ? "demo" : "live", ids],
      staleTime: 60_000,
      gcTime: 120_000,
      refetchInterval: 60_000,
      refetchIntervalInBackground: false,
      retry: false,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const cached: HistoryPreview[] = [];
        const missing: number[] = [];
        for (const id of ids) {
          const history = client.getQueryData<History>([
            "history",
            demo ? "demo" : "live",
            id,
            "24h",
          ]);
          const state = client.getQueryState([
            "history",
            demo ? "demo" : "live",
            id,
            "24h",
          ]);
          if (history && state && Date.now() - state.dataUpdatedAt < 60_000)
            cached.push({
              repositoryId: id,
              history,
              availability: history.availability,
            });
          else missing.push(id);
        }
        if (!missing.length) return cached;
        const response = await fetch(
          `/api/v1/history?ids=${missing.join(",")}`,
          { signal },
        );
        if (!response.ok) throw Error("History unavailable");
        const { items } = historyBatchSchema.parse(await response.json());
        if (
          items.length !== missing.length ||
          new Set(items.map((item) => item.repositoryId)).size !==
            missing.length ||
          items.some(
            (item) =>
              !missing.includes(item.repositoryId) ||
              (item.history && (item.history.repositoryId !== item.repositoryId || item.history.window !== "24h")),
          )
        )
          throw Error("Invalid history batch");
        for (const item of items)
          if (item.history)
            client.setQueryData(
              ["history", demo ? "demo" : "live", item.repositoryId, "24h"],
              item.history,
            );
        return [...cached, ...items];
      },
    })),
  });
  const entries = new Map<number, HistoryPreview>();
  results.forEach((result, index) => {
    if (result.isError)
      chunks[index].forEach((id) =>
        entries.set(id, {
          repositoryId: id,
          history: null,
          availability: "unavailable",
        }),
      );
    else result.data?.forEach((item) => entries.set(item.repositoryId, item));
  });
  return (
    <Previews.Provider value={{ register, entries, intervalMinutes, demo }}>
      {children}
    </Previews.Provider>
  );
}
export function useHistoryPreview(id: number) {
  const client = useQueryClient();
  const { register, entries, intervalMinutes, demo } = useContext(Previews);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => register(id, entry.isIntersecting),
      { rootMargin: "160px" },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      register(id, false);
    };
  }, [id, register]);
  const cached = client.getQueryData<History>([
    "history",
    demo ? "demo" : "live",
    id,
    "24h",
  ]);
  return {
    ref,
    entry:
      entries.get(id) ??
      (cached && Date.now() - cached.fetchedAt < 60_000
        ? {
            repositoryId: id,
            history: cached,
            availability: cached.availability,
          }
        : undefined),
    intervalMinutes,
    demo,
  };
}
