import { Link, useLocation } from "react-router-dom";
import { repoPath, type Repository } from "@devloot-radar/shared/contracts";
import { useHistoryPreview } from "../hooks/useHistoryPreviews";
import { previewGeometry, type ChartWindow } from "../lib/history";
export default function GrowthPreview({
  repo,
  window,
}: {
  repo: Repository;
  window: ChartWindow;
}) {
  const location = useLocation();
  const { ref, entry, intervalMinutes, demo } = useHistoryPreview(repo.id);
  const geometry = entry?.history
    ? previewGeometry(entry.history, window, intervalMinutes)
    : null;
  return (
    <div ref={ref} className="growth-preview">
      <div className="preview-label">
        <span>
          {demo ? "Demo" : "Observed"} stars · {window}
        </span>
        <Link
          to={`${repoPath(repo)}#growth`}
          state={{
            from:
              location.pathname === "/" ? "/" + location.search : "/watchlist",
          }}
          aria-label={`View ${repo.fullName} growth chart`}
        >
          Details ↗
        </Link>
      </div>
      {geometry && geometry.points.length > 0 ? (
        <>
          <svg
            viewBox="0 0 200 56"
            role="img"
            aria-label={`${repo.fullName}: ${geometry.points.length} ${demo ? "fictional" : "stored"} observations over ${window}, ${geometry.minimum} to ${geometry.maximum} stars. Gaps are not connected.`}
          >
            <path d="M4 50H196" className="preview-grid" />
            {geometry.segments.map((segment, index) => (
              <g key={index}>
                {segment.length > 1 && (
                  <polyline
                    className="preview-line"
                    pathLength={1}
                    points={segment.map((p) => `${p.x},${p.y}`).join(" ")}
                  />
                )}{" "}
                {segment.map((point, i) => (
                  <circle
                    key={i}
                    cx={point.x}
                    cy={point.y}
                    r={1.8}
                    className="preview-dot"
                  />
                ))}
              </g>
            ))}
          </svg>
          <span className="preview-caption">
            {geometry.points.length === 1
              ? "Waiting for another observation"
              : `${geometry.points.length} stored samples · gaps preserved`}
          </span>
        </>
      ) : (
        <div className="preview-empty">
          {!entry
            ? "Loading observations…"
            : entry.history
              ? "No observations in this window"
              : "History unavailable"}
        </div>
      )}
    </div>
  );
}
