import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createVotesStore, VOTES_KEY } from "../lib/votes";
const VotesContext = createContext<ReturnType<typeof createVotesStore> | null>(
  null,
);
export function VotesProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createVotesStore());
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      try {
        if (
          event.storageArea === localStorage &&
          (event.key === VOTES_KEY || event.key === null)
        )
          store.sync(event.newValue);
      } catch {
        /* retain session votes */
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [store]);
  return (
    <VotesContext.Provider value={store}>{children}</VotesContext.Provider>
  );
}
export function useVotes() {
  const store = useContext(VotesContext);
  if (!store) throw Error("Missing votes provider");
  return {
    ...useSyncExternalStore(store.subscribe, store.getSnapshot),
    toggle: store.toggle,
  };
}
