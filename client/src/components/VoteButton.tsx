import { useVotes } from "../hooks/useVotes";
export default function VoteButton({
  repo,
}: {
  repo: { id: number; fullName: string };
}) {
  const { ids, toggle, persistent, message } = useVotes();
  const voted = ids.includes(repo.id);
  return (
    <div className="vote-control">
      <button
        className={`vote-button ${voted ? "voted" : ""}`}
        aria-pressed={voted}
        aria-label={`${voted ? "Remove vote for" : "Upvote"} ${repo.fullName}`}
        title="Your vote in this browser. No shared public total."
        onClick={() => toggle(repo.id)}
      >
        <span aria-hidden="true">▴</span>
        {voted ? "Voted" : "Vote"}
      </button>
      <span className="vote-scope">
        {persistent ? "Browser-local" : "Session only"}
      </span>
      {message && (
        <span role="status" className="vote-message">
          {message}
        </span>
      )}
    </div>
  );
}
