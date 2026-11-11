import { VotesProvider } from "./hooks/useVotes";
import { lazy, Suspense, useEffect } from "react";
import { Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useTheme } from "./hooks/useTheme";
import Discover from "./pages/Discover";
import { WatchlistProvider, useWatchlist } from "./hooks/useWatchlist";
import Watchlist from "./pages/Watchlist";
import Methodology from "./pages/Methodology";
import NotFound from "./pages/NotFound";
const Repository = lazy(() => import("./pages/Repository"));
function Shell() {
  const { dark, toggle } = useTheme();
  const { entries, persistent, message } = useWatchlist();
  const location = useLocation();
  useEffect(() => {
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="header">
        <Link className="brand" to="/" aria-label="DevLoot Radar home">
          <img
            src={`/brand/devloot_mascot_${dark ? "white" : "black"}.svg`}
            alt=""
          />
          <b>
            devloot<span>radar</span>
          </b>
        </Link>
        <nav aria-label="Main navigation">
          <NavLink to="/" end>
            Discover
          </NavLink>
          <NavLink to="/watchlist">
            Watchlist <span className="nav-count">{entries.length}</span>
          </NavLink>
          <NavLink to="/methodology">How it works</NavLink>
        </nav>
        <button
          className="theme-button"
          onClick={toggle}
          aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
        >
          {dark ? "☀" : "◐"}
          <span>{dark ? "Light" : "Dark"}</span>
        </button>
      </header>
      <main id="main" tabIndex={-1}>
        {!persistent && (
          <p className="notice" role="status">
            Browser storage is unavailable. Saves are kept for this session
            only.
          </p>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        <Suspense
          fallback={<div className="skeleton">Loading repository…</div>}
        >
          <Routes>
            <Route path="/" element={<Discover />} />
            <Route path="/repo/:owner/:name" element={<Repository />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <footer>
        <Link className="footer-brand" to="/">
          devloot radar
        </Link>
        <span>Observed repositories. Measured movement.</span>
        <Link to="/methodology">Read the methodology ↗</Link>
      </footer>
    </>
  );
}
export default function App() {
  return (
    <WatchlistProvider>
      <VotesProvider>
        <Shell />
      </VotesProvider>
    </WatchlistProvider>
  );
}
