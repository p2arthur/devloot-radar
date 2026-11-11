import { HistoryPreviewsProvider } from "../hooks/useHistoryPreviews";
import { usePageTitle } from "../hooks/usePageTitle";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCatalog } from "../hooks/useCatalog";
import { DataStatus } from "../components/DataStatus";
import RepositoryRow from "../components/RepositoryRow";
import {
  defaults,
  discover,
  facets,
  filterParams,
  readFilters,
  type Filters,
} from "../lib/discovery";
import { dateTime, relative } from "../lib/format";
export default function Discover() {
  usePageTitle("DevLoot Radar · Open source, in motion");
  const query = useCatalog();
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const canonical = filterParams(filters).toString();
  const [text, setText] = useState(filters.q);
  const [pagination, setPagination] = useState({ key: canonical, count: 25 });
  const visible = pagination.key === canonical ? pagination.count : 25;
  useEffect(() => setPagination({ key: canonical, count: 25 }), [canonical]);
  useEffect(() => {
    if (params.toString() !== canonical)
      setParams(canonical, { replace: true });
  }, [canonical, params, setParams]);
  useEffect(() => setText(filters.q), [filters.q]);
  useEffect(() => {
    if (text === filters.q) return;
    const timer = setTimeout(
      () => setParams(filterParams({ ...filters, q: text }), { replace: true }),
      250,
    );
    return () => clearTimeout(timer);
  }, [text, canonical]);
  const update = (change: Partial<Filters>) => {
    setText(change.q ?? filters.q);
    setParams(filterParams({ ...filters, ...change }));
  };
  const result = discover(query.data?.items ?? [], filters, query.now);
  const options = facets(query.data?.items ?? [], query.now);
  const ranked = result.ranked.slice(0, visible);
  const baseline = result.baseline.slice(
    0,
    Math.max(0, visible - ranked.length),
  );
  const breakouts = result.ranked
    .filter((r) => r.signal === "emerging")
    .slice(0, 3);
  return (
    <>
      <section className="hero surface-hero surface-hero-map">
        <p className="eyebrow">OPEN SOURCE, IN MOTION</p>
        <h1>
          Find your next <em>open-source obsession.</em>
        </h1>
        <p className="intro">
          Follow measured momentum. Understand the evidence. Keep your own
          radar.
        </p>
      </section>
      <DataStatus
        catalog={query.data}
        error={query.isError}
        retry={() => void query.refetch()}
      />
      {query.data && (
        <>
          <p className="coverage-line">
            Observed repositories, not all of GitHub{" "}
            <span>
              · Latest completed collection{" "}
              <time title={dateTime(query.data.lastCollectionAt)}>
                {relative(query.data.lastCollectionAt, query.now)}
              </time>
            </span>
          </p>
          <section aria-labelledby="discover-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">THE DISCOVERY DESK</p>
                <h2 id="discover-title">On the radar</h2>
              </div>
              <p aria-live="polite">
                {result.count} matching repos · {result.ranked.length} ranked
              </p>
            </div>
            <label className="search">
              <span>Search the observed catalog</span>
              <input
                type="search"
                value={text}
                maxLength={200}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setText("");
                    update({ q: "" });
                  }
                }}
                placeholder="Repository, topic, or language…"
              />
            </label>
            <div className="toolbar">
              <div className="view-switch" aria-label="Discovery view">
                {(["momentum", "growth", "small"] as const).map((view) => (
                  <button
                    key={view}
                    aria-pressed={filters.view === view}
                    onClick={() =>
                      update({
                        view,
                        window: view === "momentum" ? "1h" : filters.window,
                      })
                    }
                  >
                    {view === "momentum"
                      ? "Momentum"
                      : view === "growth"
                        ? "Growth"
                        : "Under the radar"}
                  </button>
                ))}
              </div>
              {filters.view === "momentum" ? (
                <p className="fixed-window">1h score · fixed window</p>
              ) : (
                <label>
                  Window
                  <select
                    aria-label="Window"
                    value={filters.window}
                    onChange={(e) =>
                      update({ window: e.target.value as Filters["window"] })
                    }
                  >
                    <option value="1h">1 hour</option>
                    <option value="6h">6 hours</option>
                    <option value="24h">24 hours</option>
                  </select>
                </label>
              )}
              <label>
                Language
                <select
                  aria-label="Language"
                  value={filters.language}
                  onChange={(e) => update({ language: e.target.value })}
                >
                  <option value="">All languages</option>
                  {[
                    ...new Set([
                      ...options.languages,
                      ...(filters.language ? [filters.language] : []),
                    ]),
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Topic
                <select
                  aria-label="Topic"
                  value={filters.topic}
                  onChange={(e) => update({ topic: e.target.value })}
                >
                  <option value="">All topics</option>
                  {[
                    ...new Set([
                      ...options.topics,
                      ...(filters.topic ? [filters.topic] : []),
                    ]),
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <button onClick={() => update(defaults)}>Reset</button>
            </div>
            <div className="filter-summary">
              {(["q", "language", "topic"] as const)
                .filter((k) => filters[k])
                .map((k) => (
                  <button
                    key={k}
                    onClick={() => update({ [k]: "" })}
                    aria-label={`Remove ${k} filter ${filters[k]}`}
                  >
                    {filters[k]} ×
                  </button>
                ))}
            </div>
            <HistoryPreviewsProvider
              intervalMinutes={query.data.collection.intervalMinutes}
              demo={query.data.mode === "demo"}
            >
              <div className="discovery-layout">
                <div>
                  <div className="list-heading">
                    <h3>
                      {filters.view === "momentum"
                        ? "Hourly momentum"
                        : filters.view === "growth"
                          ? `Growth over ~${filters.window}`
                          : "Under the radar"}
                    </h3>
                    <span>
                      {filters.view === "small"
                        ? `Under 2,000 stars · positive ~${filters.window} growth`
                        : filters.view === "momentum"
                          ? "Ranked by measured score"
                          : `Ranked by net stars · ~${filters.window}`}
                    </span>
                  </div>
                  {ranked.length > 0 ? (
                    <div className="repository-list">
                      {ranked.map((repo, i) => (
                        <RepositoryRow
                          key={repo.id}
                          repo={repo}
                          demo={query.data?.mode === "demo"}
                          rank={i + 1}
                          window={filters.window}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="empty">
                      <h3>
                        {!query.data.items.length
                          ? "No observed repositories yet."
                          : result.baseline.length
                            ? "This window is building a baseline."
                            : "No measured matches."}
                      </h3>
                      <p>
                        {result.baseline.length
                          ? "These repositories have recent observations, but no usable baseline for this window."
                          : "Try another filter or window. Older or untracked observations are not ranked."}
                      </p>
                      {filters.window === "1h" && (
                        <Link
                          className="text-link"
                          to={`/?${filterParams({ ...filters, view: "growth", window: "6h" })}`}
                        >
                          Inspect six-hour Growth →
                        </Link>
                      )}
                    </div>
                  )}
                  {baseline.length > 0 && (
                    <section className="baseline">
                      <h3>
                        Building a baseline{" "}
                        <span>· {result.baseline.length} unranked</span>
                      </h3>
                      <p>
                        Recent observations, without a matching ~
                        {filters.window} measurement. No rank assigned.
                      </p>
                      <div className="repository-list">
                        {baseline.map((repo) => (
                          <RepositoryRow
                            key={repo.id}
                            repo={repo}
                          demo={query.data?.mode === "demo"}
                            window={filters.window}
                            baseline
                          />
                        ))}
                      </div>
                    </section>
                  )}
                  {result.count > visible && (
                    <button
                      className="load-more"
                      onClick={() =>
                        setPagination({ key: canonical, count: visible + 25 })
                      }
                    >
                      Show 25 more{" "}
                      <span>({result.count - visible} remaining)</span>
                    </button>
                  )}
                </div>
                <aside className="rail">
                  <p className="eyebrow">READ THE SIGNAL</p>
                  {breakouts.length > 0 ? (
                    <>
                      <h3>Breaking out</h3>
                      <p>
                        At least +20 stars in ~1h, at least 3× the previous
                        pace.
                      </p>
                      {breakouts.map((r) => (
                        <Link
                          className="breakout"
                          key={r.id}
                          to={`/repo/${r.fullName}`}
                          state={{ from: "/?" + canonical }}
                        >
                          <strong>{r.fullName}</strong>
                          <span>
                            +{r.hour} in ~1h · {r.acceleration?.toFixed(1)}×
                            pace ↗
                          </span>
                        </Link>
                      ))}
                    </>
                  ) : (
                    <>
                      <h3>Evidence before a rank.</h3>
                      <p>
                        Missing growth is unknown, not zero. A repository needs
                        a recent observation and a matching baseline to enter
                        this list.
                      </p>
                    </>
                  )}
                  <div className="coverage-summary">
                    <strong>
                      {query.data.coverage.rankedHourly} /{" "}
                      {query.data.coverage.observed}
                    </strong>
                    <span>repositories with usable hourly data</span>
                  </div>
                  <Link className="text-link" to="/methodology">
                    How the radar works ↗
                  </Link>
                  <p className="rail-note">
                    Stars measure attention. They don’t establish quality or
                    explain what caused it.
                  </p>
                </aside>
              </div>
            </HistoryPreviewsProvider>
          </section>
        </>
      )}
    </>
  );
}
