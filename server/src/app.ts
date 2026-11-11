import { HistoryError } from "./history";
import compress from "@fastify/compress";
import Fastify from "fastify";
import {
  repoPath,
  segmentSchema,
  type Catalog,
  type History,
  type HistoryWindow,
  historyWindowSchema,
} from "@devloot-radar/shared/contracts";

export function createApp(
  readCatalog: () => Promise<Catalog>,
  readHistory?: (id: number, window: HistoryWindow) => Promise<History>,
) {
  const app = Fastify({ logger: false });
  app.register(compress);
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
  });
  app.get("/healthz", async () => ({ ok: true }));
  app.get("/api/v1/catalog", async (_request, reply) => {
    try {
      return reply
        .header("Cache-Control", "no-store")
        .send(await readCatalog());
    } catch {
      return reply.code(503).header("Cache-Control", "no-store").send({
        error: "Trend data is temporarily unavailable. Please try again.",
      });
    }
  });
  app.get<{ Params: { owner: string; name: string } }>(
    "/api/v1/repos/:owner/:name",
    async (request, reply) => {
      if (
        ![request.params.owner, request.params.name].every(
          (p) => segmentSchema.safeParse(p).success,
        )
      )
        return reply.code(400).send({ error: "Invalid repository path" });
      try {
        const catalog = await readCatalog();
        const name =
          `${request.params.owner}/${request.params.name}`.toLowerCase();
        const repository = catalog.items.find(
          (r) => r.fullName.toLowerCase() === name,
        );
        return repository
          ? reply
              .header("Cache-Control", "no-store")
              .send({ repository, canonicalPath: repoPath(repository) })
          : reply.code(404).send({ error: "Repository not found" });
      } catch {
        return reply
          .code(503)
          .send({ error: "Trend data is temporarily unavailable." });
      }
    },
  );
  app.get<{ Params: { id: string }; Querystring: { window?: string } }>(
    "/api/v1/repos/:id/history",
    async (request, reply) => {
      reply.header("Cache-Control", "no-store");
      const id = Number(request.params.id);
      const window = historyWindowSchema.safeParse(request.query.window);
      if (
        !/^[1-9]\d*$/.test(request.params.id) ||
        !Number.isSafeInteger(id) ||
        !window.success
      )
        return reply.code(400).send({
          error: "A valid repository ID and window=24h or window=7d are required.",
        });
      try {
        const catalog = await readCatalog();
        if (!catalog.items.some((r) => r.id === id))
          return reply.code(404).send({ error: "Repository not found" });
        if (!readHistory) throw new HistoryError(501);
        return await readHistory(id, window.data);
      } catch (error) {
        const status = error instanceof HistoryError ? error.status : 503;
        return reply.code(status).send({
          repositoryId: id,
          window: window.data,
          availability: "unavailable",
          code:
            status === 501 ? "HISTORY_NOT_AVAILABLE" : "HISTORY_UNAVAILABLE",
          error: "Observation history is unavailable.",
        });
      }
    },
  );
  app.get<{ Querystring: { ids?: string } }>(
    "/api/v1/history",
    async (request, reply) => {
      const raw = request.query.ids ?? "";
      const ids = raw.split(",").map(Number);
      if (
        !/^[1-9]\d*(,[1-9]\d*)*$/.test(raw) ||
        ids.length > 25 ||
        ids.some((id) => !Number.isSafeInteger(id)) ||
        new Set(ids).size !== ids.length
      )
        return reply
          .code(400)
          .send({ error: "Provide 1–25 distinct safe repository IDs." });
      try {
        const catalog = await readCatalog();
        const allowed = new Set(catalog.items.map((repo) => repo.id));
        const items: Array<{
          repositoryId: number;
          history: History | null;
          availability: string;
        }> = [];
        // Keep collector fan-out bounded; the history reader coalesces concurrent visitors.
        for (let index = 0; index < ids.length; index += 4)
          items.push(
            ...(await Promise.all(
              ids.slice(index, index + 4).map(async (id) => {
                if (!allowed.has(id))
                  return {
                    repositoryId: id,
                    history: null,
                    availability: "missing",
                  };
                try {
                  if (!readHistory) throw new HistoryError(501);
                  const history = await readHistory(id, "24h");
                  return {
                    repositoryId: id,
                    history,
                    availability: history.availability,
                  };
                } catch {
                  return {
                    repositoryId: id,
                    history: null,
                    availability: "unavailable",
                  };
                }
              }),
            )),
          );
        return { items };
      } catch {
        return reply
          .code(503)
          .send({ error: "Observation history is unavailable." });
      }
    },
  );
  return app;
}
