import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { TrendCollector } from './trends';
import type { TrendSnapshot, TrendsResponse } from './shared/trends';

type Window = '24h' | '7d';
export interface TrendBackend {
  history(id: number, window: Window): { repositoryId: number; window: Window; points: TrendSnapshot[] };
  response(): TrendsResponse;
}
export function localTrendBackend(collector: TrendCollector): TrendBackend {
  return {
    response: () => collector.response(),
    history: (id, window) => {
      const repo = collector.store.get(id);
      if (!repo || repo.dismissed) throw Object.assign(new Error('Repository not found'), {statusCode:404});
      return { repositoryId:id, window, points:collector.store.chartHistory(id, Date.now(), window) };
    },
  };
}
export function trendRoutes(app: FastifyInstance, backend: TrendBackend) {
  app.addHook('onRequest', async (_request, reply) => {reply.header('Cache-Control','no-store');});
  app.get('/api/trends', async () => backend.response());
  app.get<{Params:{id:string};Querystring:{window?:string}}>('/api/trends/:id/history', async request => {
    const id = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)).safeParse(request.params.id);
    const query = z.object({window:z.enum(['24h','7d'])}).strict().safeParse(request.query);
    if (!id.success || !query.success) throw Object.assign(new Error('A valid repository ID and window=24h or window=7d are required.'),{statusCode:400});
    return backend.history(id.data,query.data.window);
  });
}
