import { usePageTitle } from "../hooks/usePageTitle";
import { Link } from "react-router-dom";
export default function NotFound() {
  usePageTitle("Page not found · DevLoot Radar");
  return (
    <section className="empty not-found">
      <p className="eyebrow">404 / OFF THE RADAR</p>
      <h1>No repository or page here.</h1>
      <p>
        Only observed repositories are in this catalog. A renamed or unavailable
        repository may no longer have this address.
      </p>
      <Link className="primary" to="/">
        Back to discovery →
      </Link>
    </section>
  );
}
