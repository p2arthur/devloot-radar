import { useWatchlist } from "../hooks/useWatchlist";
export default function SaveButton({
  repo,
}: {
  repo: { id: number; fullName: string };
}) {
  const { entries, toggle } = useWatchlist();
  const saved = entries.some((e) => e.id === repo.id);
  return (
    <button
      className={`save-button ${saved ? "saved" : ""}`}
      aria-pressed={saved}
      aria-label={`${saved ? "Remove" : "Save"} ${repo.fullName}${saved ? " from watchlist" : " to watchlist"}`}
      onClick={() => toggle(repo)}
    >
      <span aria-hidden="true">{saved ? "✓" : "+"}</span>{" "}
      {saved ? "Saved" : "Save"}
    </button>
  );
}
