import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import staticFiles from "@fastify/static";
import type { Catalog } from "@devloot-radar/shared/contracts";
import { publicOrigin, renderMetadata, routeMetadata } from "./metadata";
export async function registerWeb(
  app: FastifyInstance,
  readCatalog: () => Promise<Catalog>,
  root: string,
  origin: string,
) {
  const trustedOrigin = publicOrigin(origin);
  const template = await readFile(join(root, "index.html"), "utf8");
  await app.register(staticFiles, { root, index: false });
  // Public indexing remains disabled until an explicitly approved release passes all live-data gates.
  app.get("/robots.txt", async (_req, reply) =>
    reply.type("text/plain").send("User-agent: *\nDisallow: /\n"),
  );
  app.get("/sitemap.xml", async (_req, reply) =>
    reply
      .type("application/xml")
      .send(
        '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
      ),
  );
  const render = async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split("?")[0];
    if (
      (request.method !== "GET" && request.method !== "HEAD") ||
      path.startsWith("/api/") ||
      /^\/(assets|brand)\//.test(path) ||
      (/\.[a-z0-9]{2,6}$/i.test(path) && !path.startsWith("/repo/"))
    )
      return reply.code(404).send({ error: "Not found" });
    try {
      const catalog = path.startsWith("/repo/")
        ? await readCatalog()
        : undefined;
      const meta = routeMetadata(path, catalog);
      if (meta.status === 200 && meta.path !== path)
        return reply.redirect(meta.path, 308);
      return reply
        .code(meta.status)
        .header("Cache-Control", "no-store")
        .header("X-Robots-Tag", "noindex, nofollow")
        .type("text/html")
        .send(renderMetadata(template, meta, trustedOrigin));
    } catch {
      return reply
        .code(503)
        .type("text/plain")
        .send("Repository data is temporarily unavailable. Please try again.");
    }
  };
  for (const path of ["/", "/methodology", "/watchlist", "/repo/:owner/:name"])
    app.get(path, render);
  app.setNotFoundHandler(render);
}
