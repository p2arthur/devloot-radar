import type { ChartWindow } from "../lib/history";
const labels: Record<ChartWindow, string> = {"1h":"1 hour", "6h":"6 hours", "24h":"24 hours", "7d":"7 days"};
export default function ChartRangeControls({window, onChange}: {window: ChartWindow; onChange: (window: ChartWindow) => void}) {
  return <div className="chart-toolbar"><div className="view-switch chart-ranges" aria-label="Chart time range">
    {(["1h", "6h", "24h", "7d"] as const).map(period => <button key={period} aria-pressed={window === period} onClick={() => onChange(period)}>{labels[period]}</button>)}
  </div></div>;
}
