import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createWatchlistStore, WATCHLIST_KEY } from "../lib/watchlist";
const Context = createContext<ReturnType<typeof createWatchlistStore> | null>(
  null,
);
export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createWatchlistStore());
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      try {
        if (
          e.storageArea === localStorage &&
          (e.key === WATCHLIST_KEY || e.key === null)
        )
          store.sync(e.newValue);
      } catch {
        /* Storage is blocked; retain session state. */
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useWatchlist() {
  const store = useContext(Context);
  if (!store) throw new Error("Missing watchlist provider");
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { ...state, toggle: store.toggle };
}
