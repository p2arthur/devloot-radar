import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { catalogSchema } from "@devloot-radar/shared/contracts";
import { ageCatalog } from "@devloot-radar/shared/measurements";
export function useCatalog() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 15_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  const query = useQuery({
    queryKey: ["catalog"],
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/v1/catalog", { signal });
      if (!response.ok)
        throw new Error("Trend data is temporarily unavailable.");
      return catalogSchema.parse(await response.json());
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  // Never retain browser-only public metadata beyond the server's last-good bound.
  const expired = query.data && now - query.data.fetchedAt > 600_000;
  return {
    ...query,
    data: query.data && !expired ? ageCatalog(query.data, now) : undefined,
    isError: query.isError || !!expired,
    now,
  };
}
