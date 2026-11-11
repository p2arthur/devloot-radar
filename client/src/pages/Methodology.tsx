import { usePageTitle } from "../hooks/usePageTitle";
import { useCatalog } from "../hooks/useCatalog";
import { DataStatus } from "../components/DataStatus";
export default function Methodology() {
  usePageTitle("How the radar works · DevLoot Radar");
  const query = useCatalog();
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">THE MEASUREMENT, EXPLAINED</p>
        <h1>How the radar works.</h1>
        <p>Observed change, with the gaps left visible.</p>
      </div>
      <DataStatus
        catalog={query.data}
        error={query.isError}
        retry={() => void query.refetch()}
      />
      <div className="methodology-layout">
        <article className="prose">
          <h2>What enters the catalog</h2>
          <p>
            Selected public open-source repositories with an allowed SPDX
            license. Private, forked, archived, disabled, unavailable, and
            dismissed records are excluded by the collector or public adapter.
            This is a curated observation set, not all of GitHub. Studio
            preferences can affect which repositories the collector tracks; your
            browser watchlist never does.
          </p>
          <h2>Net stars, not new people</h2>
          <p>
            A net change is the latest star total minus an earlier observed
            total. It can be positive, zero, or negative. A dash means the
            baseline is unavailable, never zero. Stars reflect attention; they
            do not establish quality or tell us what caused a change.
          </p>
          <h2>Why the windows say “about”</h2>
          <p>
            A baseline must fall at or before the latest observation minus the
            selected window. Its allowed distance from that boundary is the
            smaller of 20% of the window or 30 minutes: 12 minutes for 1h, and
            30 minutes for 6h and 24h. The actual measured interval can be
            slightly longer. Missing observations are not interpolated.
          </p>
          <h2>Momentum and acceleration</h2>
          <p>
            Hourly rate is net hourly change divided by actual elapsed hours.
            Acceleration compares it with the previous pace between the six-hour
            and one-hour baselines. The earlier rate is clamped to at least
            zero; its denominator is floored at one star per hour. A 3× ratio
            means three times that comparison pace, not a forecast.
          </p>
          <p>
            The collector-v1 score orders Momentum using hourly rate, capped
            acceleration, and relative growth. It is unbounded and is not a
            percentage, quality rating, or probability.
          </p>
          <pre className="formula">
            round(10 × log1p(max(0, hourlyRate))
            <br /> + 8 × min(10, max(0, acceleration ?? 0))
            <br /> + 20 × min(1, max(0, hour) / max(100, baselineStars)))
          </pre>
          <h2>Reading the signals</h2>
          <dl>
            <dt>Breaking out</dt>
            <dd>
              At least +20 net stars in ~1h and acceleration of at least 3×.
            </dd>
            <dt>Growing</dt>
            <dd>At least +5 net stars in ~1h, when not breaking out.</dd>
            <dt>Steady</dt>
            <dd>Other measured hourly changes, including zero and negative.</dd>
            <dt>Building baseline</dt>
            <dd>
              No usable hourly baseline. Six-hour or daily measurements may
              still exist. This does not mean the repository itself is new.
            </dd>
            <dt>No recent observation</dt>
            <dd>
              The latest observation is older than two hours. Growth becomes
              unavailable; last-observed totals remain dated.
            </dd>
          </dl>
          <h2>How lists are ordered</h2>
          <p>
            Momentum requires tracked, fresh, hourly-measured repositories and
            sorts by score, then hourly change, then numeric repository ID.
            Growth sorts by the selected net change, then ID. Under the radar
            uses the same ordering with fewer than 2,000 stars and positive
            selected growth. Baseline entries are unranked, newest
            first-observed first, then ID. Search, language, and topic filters
            combine.
          </p>
          <h2>Time and history</h2>
          <p>
            First observed is when the collector encountered a repository.
            Created is the GitHub repository creation date. Last push is a
            GitHub timestamp, not a health assessment. Last completed
            collection, each repository’s observation, and the adapter’s fetch
            time are separate clocks.
          </p>
          <p>
            The charts show stored cumulative star totals in 1h, 6h, 24h, or 7-day views, at
            actual sample timestamps. Lines break when the gap exceeds the
            larger of twice the configured interval or 45 minutes. A table
            exposes the same points. Missing history never becomes a synthetic
            chart.
          </p>
          <h2>Browser-local votes</h2>
          <p>
            A vote marks your interest in a repository in this browser. It is
            reversible, stays separate from your watchlist, and never changes
            GitHub stars or the collector. There are no shared totals and votes
            do not affect measured rankings. If browser storage is blocked,
            votes last only for the session.
          </p>
          <h2>Your watchlist</h2>
          <p>
            Up to 200 repositories are saved by numeric GitHub ID in this
            browser. Renames preserve the save. Missing public entries keep only
            their saved name and removal action. Saves do not synchronize to an
            account or change GitHub or the collector.
          </p>
        </article>
        <aside className="rail">
          <p className="eyebrow">CURRENT COVERAGE</p>
          <h3>
            {query.data?.mode === "demo"
              ? "Fictional demo catalog"
              : "Observed catalog"}
          </h3>
          {query.data ? (
            <>
              <dl className="coverage-table">
                <dt>Observed repositories</dt>
                <dd>{query.data.coverage.observed}</dd>
                <dt>Usable ~1h</dt>
                <dd>{query.data.coverage.rankedHourly}</dd>
                <dt>Usable ~6h</dt>
                <dd>{query.data.coverage.measured6h}</dd>
                <dt>Usable ~24h</dt>
                <dd>{query.data.coverage.measured24h}</dd>
              </dl>
              <p>
                Configured interval: {query.data.collection.intervalMinutes}{" "}
                minutes. This does not guarantee each repository is sampled at
                that cadence.
              </p>
            </>
          ) : (
            <p>Coverage is unavailable until the catalog loads.</p>
          )}
        </aside>
      </div>
    </>
  );
}
