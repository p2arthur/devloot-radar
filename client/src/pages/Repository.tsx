import ChartRangeControls from "../components/ChartRangeControls";
import type { ChartWindow } from "../lib/history";
import RepositoryAvatar from "../components/RepositoryAvatar";
import VoteButton from "../components/VoteButton";
import { usePageTitle } from "../hooks/usePageTitle";
import { lazy, Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { historySchema, repoPath } from "@devloot-radar/shared/contracts";
import { useCatalog } from "../hooks/useCatalog";
import { DataStatus } from "../components/DataStatus";
import SaveButton from "../components/SaveButton";
import SignalBadge from "../components/SignalBadge";
import NotFound from "./NotFound";
import { dateTime, number, relative, signed } from "../lib/format";
const GrowthChart = lazy(() => import("../components/GrowthChart"));
export default function Repository() {
  const { owner, name } = useParams();
  const catalog = useCatalog();
  const location = useLocation();
  const navigate = useNavigate();
  const repo = catalog.data?.items.find(
    (r) => r.fullName.toLowerCase() === `${owner}/${name}`.toLowerCase(),
  );
  usePageTitle(
    repo
      ? `${repo.fullName} · DevLoot Radar`
      : catalog.data
        ? "Page not found · DevLoot Radar"
        : "Repository · DevLoot Radar",
  );
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const [chartWindow, setChartWindow] = useState<ChartWindow>("7d");
  const historyWindow = chartWindow === "7d" ? "7d" : "24h";
  const history = useQuery({
    queryKey: ["history", catalog.data?.mode, repo?.id, historyWindow],
    enabled: !!repo,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/v1/repos/${repo!.id}/history?window=${historyWindow}`,
        { signal },
      );
      if (!response.ok) throw new Error("History unavailable");
      const data = historySchema.parse(await response.json());
      if (data.repositoryId !== repo!.id || data.window !== historyWindow) throw new Error("Invalid history response");
      return data;
    },
  });
  useEffect(() => {
    if (repo && location.pathname !== repoPath(repo))
      navigate(repoPath(repo), { replace: true, state: location.state });
  }, [repo?.fullName, location.pathname, navigate]);
  useEffect(() => {
    if (location.hash !== "#growth" || !repo) return;
    const frame = requestAnimationFrame(() =>
      document.getElementById("growth")?.scrollIntoView(),
    );
    return () => cancelAnimationFrame(frame);
  }, [location.key, repo?.id]);
  useEffect(() => {
    setCopy("idle");
  }, [repo?.id]);
  if (!catalog.data)
    return (
      <DataStatus
        error={catalog.isError}
        retry={() => void catalog.refetch()}
      />
    );
  if (!repo) return <NotFound />;
  const route = repoPath(repo);
  const link = new URL(route, window.location.origin).href;
  const from =
    typeof location.state?.from === "string" &&
    (/^\/\?/.test(location.state.from) ||
      ["/", "/watchlist"].includes(location.state.from))
      ? location.state.from
      : "/";
  const related = catalog.data.items
    .filter(
      (r) =>
        r.id !== repo.id &&
        r.tracking &&
        r.topics.some((t) => repo.topics.includes(t)),
    )
    .map((r) => ({
      repo: r,
      shared: r.topics.filter((t) => repo.topics.includes(t)),
    }))
    .sort((a, b) => b.shared.length - a.shared.length || a.repo.id - b.repo.id)
    .slice(0, 4);
  return (
    <>
      <Link className="breadcrumb" to={from}>
        ← Back to {from === "/watchlist" ? "watchlist" : "discovery"}
      </Link>
      <DataStatus
        catalog={catalog.data}
        error={catalog.isError}
        retry={() => void catalog.refetch()}
      />
      <section className="profile">
        <div className="profile-cover surface-hero surface-hero-map" />
        <div className="profile-body">
          <RepositoryAvatar fullName={repo.fullName} demo={catalog.data.mode === "demo"} className="profile-avatar" eager />
          <p className="eyebrow">REPOSITORY PROFILE · GITHUB DATA</p>
          <h1>{repo.fullName}</h1>
          <p className="profile-description">
            {repo.description || "No description supplied."}
          </p>
          <div className="profile-tags">
            <span>{repo.language ?? "Unspecified language"}</span>
            <span>{repo.license}</span>
            {repo.topics.map((topic) => (
              <Link
                className="topic"
                key={topic}
                to={`/?topic=${encodeURIComponent(topic)}`}
              >
                {topic}
              </Link>
            ))}
          </div>
          <div className="profile-actions">
            <VoteButton repo={repo} />
            <SaveButton repo={repo} />
            {catalog.data.mode === "demo" ? (
              <span className="caption">No GitHub page (fictional demo)</span>
            ) : (
            <a
              className="primary"
              href={`https://github.com/${repo.fullName}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub ↗
            </a>
            )}
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopy("copied");
                } catch {
                  setCopy("failed");
                }
              }}
            >
              Copy link
            </button>
            <span role="status">{copy === "copied" ? "Link copied." : ""}</span>
          </div>
          {copy === "failed" && (
            <label className="copy-fallback">
              Couldn’t copy automatically. Select this link:
              <input readOnly value={link} onFocus={(e) => e.target.select()} />
            </label>
          )}
          <dl className="profile-stats">
            <div>
              <dt>Last observed stars</dt>
              <dd>{number(repo.stars)}</dd>
            </div>
            <div>
              <dt>Forks</dt>
              <dd>{number(repo.forks)}</dd>
            </div>
            <div>
              <dt>Last push</dt>
              <dd className="date-stat">{dateTime(repo.pushedAt)}</dd>
            </div>
          </dl>
        </div>
      </section>
      <div className="profile-layout">
        <div>
          <section className="evidence-panel">
            <p className="eyebrow">THE EVIDENCE</p>
            <h2>What changed</h2>
            <p className="caption">
              Observed {relative(repo.checkedAt, catalog.now)} ·{" "}
              <time title={new Date(repo.checkedAt).toISOString()}>
                {dateTime(repo.checkedAt)}
              </time>
            </p>
            <dl className="delta-grid">
              {(
                [
                  ["1h", repo.hour],
                  ["6h", repo.sixHours],
                  ["24h", repo.day],
                ] as const
              ).map(([window, value]) => (
                <div key={window}>
                  <dt>~{window} net stars</dt>
                  <dd
                    className={
                      value !== null && value > 0
                        ? "positive"
                        : value !== null && value < 0
                          ? "negative"
                          : ""
                    }
                  >
                    {signed(value)}
                  </dd>
                  {value === null && (
                    <span>
                      {repo.signal === "stale"
                        ? "Observation expired"
                        : "Baseline unavailable"}
                    </span>
                  )}
                </div>
              ))}
            </dl>
          </section>
          <section className="evidence-panel">
            <h2 id="growth">Star growth</h2>
            <ChartRangeControls window={chartWindow} onChange={setChartWindow} />
            {history.isPending ? (
              <p className="chart-placeholder" role="status">
                Loading stored observations…
              </p>
            ) : history.isError || !history.data ? (
              <div className="history-unavailable">
                <h3>Observation history is unavailable.</h3>
                <p>
                  The catalog measurements above are still available. A chart
                  needs stored observations from the history service.
                  {historyWindow === "7d" && " Try a shorter window if seven-day history is not available yet."}
                </p>
                <button onClick={() => void history.refetch()}>
                  Retry history
                </button>
              </div>
            ) : (
              <Suspense
                fallback={<p className="chart-placeholder">Loading chart…</p>}
              >
                <GrowthChart
                  history={history.data}
                  window={chartWindow}
                  intervalMinutes={catalog.data.collection.intervalMinutes}
                  demo={catalog.data.mode === "demo"}
                />
              </Suspense>
            )}
          </section>
          <section className="evidence-panel">
            <h2>Repository details</h2>
            <dl className="metadata-grid">
              <dt>First observed</dt>
              <dd>{dateTime(repo.firstSeen)}</dd>
              <dt>Repository created</dt>
              <dd>{dateTime(repo.createdAt)}</dd>
              <dt>License</dt>
              <dd>{repo.license}</dd>
              <dt>Tracking</dt>
              <dd>
                {repo.tracking
                  ? "In the active observation set"
                  : "Not currently tracked"}
              </dd>
            </dl>
            <p className="caption">
              A repository profile assembled from GitHub data. It does not imply
              that the owner has joined DevLoot.
            </p>
          </section>
        </div>
        <aside className="rail">
          <p className="eyebrow">READ THE SIGNAL</p>
          <SignalBadge repo={repo} />
          <h3>
            {repo.signal === "stale"
              ? "An older observation."
              : repo.hour === null
                ? "The hourly baseline is missing."
                : `${signed(repo.hour)} net stars in ~1h.`}
          </h3>
          <p>
            {repo.signal === "stale"
              ? "Last-known totals remain visible, but expired changes are not ranked."
              : repo.acceleration === null
                ? "There is no measured previous pace to compare yet."
                : `${repo.acceleration.toFixed(1)}× the previous hourly pace, using a denominator of at least one star per hour. This is not a prediction.`}
          </p>
          <p>Last observed: {dateTime(repo.checkedAt)}.</p>
          <Link className="text-link" to="/methodology">
            Read the measurement rules ↗
          </Link>
          {related.length > 0 && (
            <section className="related">
              <h3>Related by topic</h3>
              {related.map(({ repo: r, shared }) => (
                <Link className="breakout" key={r.id} to={repoPath(r)}>
                  <strong>{r.fullName}</strong>
                  <span>{shared.join(" · ")}</span>
                </Link>
              ))}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
