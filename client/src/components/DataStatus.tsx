import type { Catalog } from "@devloot-radar/shared/contracts";
import { dateTime } from "../lib/format";
export function DataStatus({
  catalog,
  error,
  retry,
}: {
  catalog?: Catalog;
  error: boolean;
  retry: () => void;
}) {
  if (!catalog)
    return (
      <div
        key={error ? "catalog-error" : "catalog-loading"}
        className={error ? "empty" : "catalog-loading"}
        role={error ? "alert" : "status"}
      >
        {error ? (
          <>
            <h2>The radar couldn’t load.</h2>
            <p>Trend data is temporarily unavailable.</p>
            <button onClick={retry}>Try again</button>
          </>
        ) : (
          <div className="skeleton">Loading observed repositories…</div>
        )}
      </div>
    );
  return (
    <>
      {catalog.mode === "demo" && (
        <div className="notice demo">
          <b>Demo preview</b>
          <span>
            Fictional repositories and measurements. These are not real GitHub projects.
          </span>
        </div>
      )}
      {(error || catalog.collection.state === "delayed") && (
        <div className="notice" role="status">
          <b>Data is delayed</b>
          <span>
            Last successful fetch: {dateTime(catalog.fetchedAt)}. Observation
            times are unchanged.
          </span>
          <button onClick={retry}>Retry</button>
        </div>
      )}
    </>
  );
}
