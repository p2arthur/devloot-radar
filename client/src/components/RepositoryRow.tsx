import RepositoryAvatar from "./RepositoryAvatar";
import GrowthPreview from "./GrowthPreview";
import VoteButton from "./VoteButton";
import { Link, useLocation } from "react-router-dom";
import { repoPath, type Repository } from "@devloot-radar/shared/contracts";
import { metric, type Window } from "../lib/discovery";
import { dateTime, number, signed } from "../lib/format";
import SaveButton from "./SaveButton";
import SignalBadge from "./SignalBadge";
export default function RepositoryRow({
  repo,
  rank,
  window = "1h",
  baseline = false,
  demo = false,
}: {
  repo: Repository;
  rank?: number;
  window?: Window;
  baseline?: boolean;
  demo?: boolean;
}) {
  const location = useLocation();
  const value = baseline ? null : metric(repo, window);
  return (
    <article className="repository">
      <div className="rank" aria-label={rank ? `Rank ${rank}` : undefined}>
        {rank ? String(rank).padStart(2, "0") : "—"}
      </div>
      <RepositoryAvatar fullName={repo.fullName} demo={demo} className="repo-mark" />
      <div className="repo-copy">
        <div className="repo-title">
          <RepositoryAvatar fullName={repo.fullName} demo={demo} className="repo-inline-avatar" />
          <h3>
            <Link
              to={repoPath(repo)}
              state={{
                from:
                  location.pathname === "/"
                    ? "/" + location.search
                    : "/watchlist",
              }}
            >
              {repo.fullName}
            </Link>
          </h3>
        </div>
        <p>{repo.description || "No description supplied."}</p>
        <div className="repo-meta">
          <span>{repo.language ?? "Unspecified language"}</span>
          <span>☆ {number(repo.stars)} stars</span>
          {repo.topics.slice(0, 3).map((topic) => (
            <Link
              className="topic"
              key={topic}
              to={`/?topic=${encodeURIComponent(topic)}`}
            >
              {topic}
            </Link>
          ))}
        </div>
      </div>
      <div className="row-measurements">
        <div className="row-deltas" aria-label="Observed net star changes">
          {(
            [
              "1h",
              "6h",
              ...(window === "24h" ? ["24h" as const] : []),
            ] as Window[]
          ).map((period) => {
            const change = metric(repo, period);
            return (
              <div
                key={period}
                className={`mini-metric ${period === window ? "selected" : ""}`}
              >
                <span>~{period} stars</span>
                <strong
                  className={
                    change === null
                      ? ""
                      : change > 0
                        ? "positive"
                        : change < 0
                          ? "negative"
                          : ""
                  }
                >
                  {signed(change)}
                </strong>
                {change === null && (
                  <small>
                    {repo.signal === "stale" ? "Expired" : "No baseline"}
                  </small>
                )}
              </div>
            );
          })}
        </div>
        <GrowthPreview repo={repo} window={window} />
      </div>
      <div className="row-actions">
        <VoteButton repo={repo} />
        <SaveButton repo={repo} />
      </div>
      <div className="evidence">
        <SignalBadge repo={repo} />
        <span>
          {repo.signal === "stale"
            ? `Last observed ${dateTime(repo.checkedAt)}`
            : baseline
              ? "Not ranked until a matching observation is available."
              : `${signed(value)} net stars in ~${window}${repo.acceleration !== null ? ` · ${repo.acceleration.toFixed(1)}× previous hourly pace` : ""}`}
        </span>
      </div>
    </article>
  );
}
