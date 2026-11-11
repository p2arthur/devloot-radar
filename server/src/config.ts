import { collectorOrigin } from "./catalog";
import { publicOrigin } from "./metadata";
export function readConfig(env: NodeJS.ProcessEnv) {
  const mode = env.DATA_MODE ?? "demo";
  if (mode !== "demo" && mode !== "live")
    throw new Error("DATA_MODE must be demo or live");
  if (env.NODE_ENV === "production" && mode !== "live")
    throw new Error("Production requires DATA_MODE=live");
  const origin = env.TRENDS_REMOTE_URL ?? "";
  const token = env.TRENDS_API_TOKEN ?? "";
  const allowLoopbackHttp = env.NODE_ENV !== "production" && env.ALLOW_LOCAL_COLLECTOR === "true";
  if (mode === "live") collectorOrigin(origin, token, allowLoopbackHttp);
  if (env.NODE_ENV === "production" && !env.PUBLIC_ORIGIN)
    throw new Error("Production requires PUBLIC_ORIGIN");
  const port = Number(env.PORT ?? 4321);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  return {
    mode,
    allowLoopbackHttp,
    origin,
    token,
    port,
    host: env.HOST ?? "127.0.0.1",
    publicOrigin: publicOrigin(env.PUBLIC_ORIGIN ?? `http://127.0.0.1:${port}`),
  };
}
