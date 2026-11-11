import { HistoryPreviewsProvider } from "../hooks/useHistoryPreviews";
import { usePageTitle } from "../hooks/usePageTitle";
import { Link } from "react-router-dom";
import { useCatalog } from "../hooks/useCatalog";
import { useWatchlist } from "../hooks/useWatchlist";
import RepositoryRow from "../components/RepositoryRow";
import { DataStatus } from "../components/DataStatus";
export default function Watchlist() {
  usePageTitle("Your browser watchlist · DevLoot Radar");
  const query = useCatalog();
  const { entries, toggle } = useWatchlist();
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">YOUR OWN RADAR</p>
        <h1>Watchlist</h1>
        <p>
          Saved in this browser. No account, no GitHub stars, just your list.
        </p>
      </div>
      <DataStatus
        catalog={query.data}
        error={query.isError}
        retry={() => void query.refetch()}
      />
      {entries.length === 0 ? (
        <section className="empty">
          <img
            className="empty-mascot"
            src="/brand/devloot_mascot_black.svg"
            alt=""
          />
          <h2>Keep something worth returning to.</h2>
          <p>
            Save a repository from discovery or its profile. It will be here
            when you come back.
          </p>
          <Link className="primary" to="/">
            Explore the radar →
          </Link>
        </section>
      ) : (
        <>
          <p className="caption">
            {entries.length} saved repositories · Measured 1h and 6h growth
          </p>
          <HistoryPreviewsProvider
            intervalMinutes={query.data?.collection.intervalMinutes ?? 15}
            demo={query.data?.mode === "demo"}
          >
            <div className="repository-list">
              {entries.map((entry) => {
                const repo = query.data?.items.find((r) => r.id === entry.id);
                return repo ? (
                  <RepositoryRow key={entry.id} repo={repo} demo={query.data?.mode === "demo"} />
                ) : (
                  <article className="unavailable-repo" key={entry.id}>
                    <div>
                      <h3>{entry.fullName}</h3>
                      <p>
                        {query.data
                          ? "No current public data"
                          : query.isError
                            ? "Current public data is unavailable"
                            : "Checking current public data…"}
                      </p>
                    </div>
                    <button
                      onClick={() => toggle(entry)}
                      aria-label={`Remove ${entry.fullName} from watchlist`}
                    >
                      Remove
                    </button>
                  </article>
                );
              })}
            </div>
          </HistoryPreviewsProvider>
        </>
      )}
    </>
  );
}
