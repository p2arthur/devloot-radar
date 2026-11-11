import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { createCatalogReader } from "./catalog";
import { createHistoryReader } from "./history";
import { readConfig } from "./config";
import { registerWeb } from "./web";
import { demoCatalog, demoHistory } from "@devloot-radar/shared/demo";
const config = readConfig(process.env);
const reader =
  config.mode === "live"
    ? createCatalogReader(config.origin, config.token, fetch, Date.now, config.allowLoopbackHttp)
    : async () => demoCatalog();
const app = createApp(
  reader,
  config.mode === "live"
    ? createHistoryReader(config.origin, config.token, fetch, Date.now, config.allowLoopbackHttp)
    : async (id, window) => demoHistory(id, Date.now(), window),
);
const root = fileURLToPath(new URL("../../client/dist/", import.meta.url));
if (existsSync(root)) await registerWeb(app, reader, root, config.publicOrigin);
await app.listen({ host: config.host, port: config.port });
console.log(
  `DevLoot Radar listening on port ${config.port} (${config.mode}, indexing disabled).`,
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void app.close();
  });
