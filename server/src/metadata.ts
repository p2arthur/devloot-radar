import type { Catalog } from "@devloot-radar/shared/contracts";
import { repoPath } from "@devloot-radar/shared/contracts";
export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function publicOrigin(input: string) {
  const url = new URL(input);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error("PUBLIC_ORIGIN must be an origin");
  return url.origin;
}
export function routeMetadata(path: string, catalog?: Catalog) {
  const common = {
    title: "DevLoot Radar · Open source, in motion",
    description:
      "Discover observed open-source repositories, understand measured momentum, and keep a browser-local watchlist.",
    path: "/",
    status: 200,
  };
  if (path === "/") return common;
  if (path === "/methodology")
    return {
      ...common,
      title: "How the radar works · DevLoot Radar",
      description:
        "Net stars, baseline tolerance, acceleration, ranking, and observation coverage explained.",
      path,
    };
  if (path === "/watchlist")
    return {
      ...common,
      title: "Your browser watchlist · DevLoot Radar",
      description: "Repositories saved in this browser.",
      path,
    };
  const match = path.match(/^\/repo\/([^/]+)\/([^/]+)$/);
  if (match) {
    let name = "";
    try {
      name =
        `${decodeURIComponent(match[1])}/${decodeURIComponent(match[2])}`.toLowerCase();
    } catch {
      /* not found */
    }
    const repo = catalog?.items.find((r) => r.fullName.toLowerCase() === name);
    if (repo)
      return {
        ...common,
        title: `${repo.fullName} · DevLoot Radar`,
        description:
          repo.description.slice(0, 300) ||
          "Measured repository observations on DevLoot Radar.",
        path: repoPath(repo),
      };
  }
  return {
    ...common,
    title: "Page not found · DevLoot Radar",
    description: "Only observed repositories are in the Radar catalog.",
    path,
    status: 404,
  };
}
export function renderMetadata(
  template: string,
  meta: ReturnType<typeof routeMetadata>,
  origin: string,
) {
  const url = origin + meta.path;
  return template
    .replace(
      /<title>[\s\S]*?<\/title>/,
      `<title>${escapeHtml(meta.title)}</title>`,
    )
    .replace(
      /<meta name="description"[^>]*>/,
      `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    )
    .replace(
      "</head>",
      `<link rel="canonical" href="${escapeHtml(url)}" /><meta property="og:type" content="website" /><meta property="og:title" content="${escapeHtml(meta.title)}" /><meta property="og:description" content="${escapeHtml(meta.description)}" /><meta property="og:url" content="${escapeHtml(url)}" /></head>`,
    );
}
