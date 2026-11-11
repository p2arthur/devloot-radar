import type { Repository } from "@devloot-radar/shared/contracts";
export const signals = {
  emerging: "Breaking out",
  growing: "Growing",
  watching: "Steady",
  new: "Building baseline",
  stale: "No recent observation",
};
export default function SignalBadge({ repo }: { repo: Repository }) {
  return (
    <span className={`signal signal-${repo.signal}`}>
      {signals[repo.signal]}
    </span>
  );
}
