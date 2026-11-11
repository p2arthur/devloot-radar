import { useReducedMotion } from "../hooks/useReducedMotion";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { History } from "@devloot-radar/shared/contracts";
import {
  chartPoints,
  windowPoints,
  windowMs,
  type ChartWindow,
} from "../lib/history";
import { dateTime, number, signed } from "../lib/format";
export default function GrowthChart({
  history,
  intervalMinutes,
  demo = false,
  window,
}: {
  history: History;
  intervalMinutes: number;
  demo?: boolean;
  window: ChartWindow;
}) {
  const reducedMotion = useReducedMotion();
  const points = windowPoints(history, window);
  const min = points.length
    ? Math.max(0, Math.min(...points.map((p) => p.stars)) - 1)
    : 0;
  return (
    <>
      <p className="caption">
        {demo ? "Fictional demo observations" : "Stored observations"} · Cumulative stars
      </p>
      {!points.length ? (
        <div className="empty">
          <h3>No observations in the last {window}.</h3>
          <p>Try a longer window. Missing samples are never estimated.</p>
        </div>
      ) : (
        <>
          <p className="chart-summary">
            {points.length === 1
              ? "Waiting for another observation."
              : `${signed(points.at(-1)!.stars - points[0].stars)} net stars between the first and last displayed observations.`}
          </p>
          <div
            className="chart"
            role="img"
            aria-label={`Cumulative stars, ${points.length} stored observations. Axis starts at ${min} stars. Exact values are in the table below.`}
          >
            <ResponsiveContainer width="100%" height={280} minWidth={0}>
              <LineChart
                key={window}
                data={chartPoints(points, intervalMinutes)}
                margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
              >
                <CartesianGrid
                  stroke="rgb(var(--border-muted))"
                  vertical={false}
                />
                <XAxis
                  dataKey="at"
                  type="number"
                  domain={[
                    history.fetchedAt - windowMs(window),
                    history.fetchedAt,
                  ]}
                  tickFormatter={(at) =>
                    new Date(at).toLocaleString(undefined, {
                      ...(window === "7d" ? { month: "short" as const, day: "numeric" as const } : {}),
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  }
                  tick={{ fontSize: 10, fill: "rgb(var(--text-secondary))" }}
                  minTickGap={40}
                />
                <YAxis
                  domain={[
                    min,
                    Math.max(...points.map((point) => point.stars)) + 1,
                  ]}
                  allowDataOverflow
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "rgb(var(--text-secondary))" }}
                  width={52}
                />
                <Tooltip
                  labelFormatter={(label) => dateTime(Number(label))}
                  contentStyle={{
                    background: "rgb(var(--bg-surface))",
                    borderColor: "rgb(var(--border-default))",
                    color: "rgb(var(--text-primary))",
                  }}
                />
                <Line
                  name="Stars"
                  type="linear"
                  dataKey="stars"
                  stroke="rgb(var(--accent-color))"
                  strokeWidth={2}
                  dot={{ r: window === "7d" ? 2 : 3 }}
                  connectNulls={false}
                  isAnimationActive={!reducedMotion}
                  animationDuration={650}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="caption">
            Cumulative stars over the last {window} · Axis starts at{" "}
            {number(min)} stars. Lines break across gaps longer than{" "}
            {Math.max(2 * intervalMinutes, 45)} minutes. No interpolated
            observations.
          </p>
          <p className="caption history-coverage">
            {points.length} stored observations · {dateTime(points[0].at)} to {dateTime(points.at(-1)!.at)}.
            {" "}Only available observations are shown; this may cover less than the selected window.
            {window === "7d" && " Up to 2,000 exact stored samples are retained; denser histories are sampled without interpolation."}
          </p>
          <details>
            <summary>
              View {points.length} stored observations as a table
            </summary>
            <div className="table-scroll">
              <table>
                <caption>
                  Exact stored points · times shown in your local timezone
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Observed at</th>
                    <th scope="col">Stars</th>
                    <th scope="col">Forks</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr key={point.at}>
                      <th scope="row">
                        <time dateTime={new Date(point.at).toISOString()}>
                          {new Date(point.at).toLocaleString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            fractionalSecondDigits: 3,
                          })}
                        </time>
                      </th>
                      <td>{number(point.stars)}</td>
                      <td>{number(point.forks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </>
  );
}
