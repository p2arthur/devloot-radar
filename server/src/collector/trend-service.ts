import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import { TrendStore } from './trend-store';
import { TrendCollector } from './trends';
import { localTrendBackend, trendRoutes } from './trend-routes';
import type { GitHubAppAuth } from './github-auth';

export function createTrendService(options: { token: string; data: string; githubToken?: string; githubAuth?: GitHubAppAuth; maxRepos?: number; archiveEnabled?: boolean; fetch?: typeof fetch }) {
  if (!/^[A-Za-z0-9_-]{32,}$/.test(options.token)) throw new Error('Set TRENDS_API_TOKEN to a random base64url token of at least 32 characters.');
  const hash = (value: string) => createHash('sha256').update(value).digest();
  const expected = hash(`Bearer ${options.token}`);
  mkdirSync(options.data, { recursive: true });
  const store = new TrendStore(path.join(options.data, 'trends.sqlite'));
  let collector: TrendCollector;
  try {
    collector = new TrendCollector(store, { token: options.githubToken?.trim() || '', auth: options.githubAuth, enabled: true, maxRepos: options.maxRepos, archiveEnabled: options.archiveEnabled === true, fetch: options.fetch });
  } catch (error) { store.close(); throw error; }
  const app = Fastify({ bodyLimit: 4096, requestTimeout: 15_000, forceCloseConnections: 'idle' });
  app.get('/healthz', async () => ({ ok: true }));
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const status = error.statusCode || 500;
    return reply.code(status).send({ error: status >= 500 ? 'Trend collector failed to handle the request.' : error.message });
  });
  app.register(async scope => {
    scope.addHook('onRequest', async (request, reply) => {
      if (!timingSafeEqual(hash(request.headers.authorization || ''), expected)) {
        return reply.code(401).headers({ 'Cache-Control': 'no-store', 'WWW-Authenticate': 'Bearer' }).send({ error: 'Unauthorized' });
      }
    });
    trendRoutes(scope, localTrendBackend(collector));
  });
  app.addHook('onClose', async () => { await collector.stop(); store.close(); });
  return { app, collector };
}
