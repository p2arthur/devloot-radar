import { afterEach, describe, expect, it, vi } from 'vitest';
import { gzipSync } from 'node:zlib';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { archiveHour, archiveUrl, readArchive } from '../../src/collector/gh-archive';
import { TrendCollector } from '../../src/collector/trends';
import { TrendStore } from '../../src/collector/trend-store';
import { HOUR } from '../../src/collector/trend-score';

const now = Date.parse('2026-11-08T12:00:00Z'), hour = archiveHour(now);
const event = (id: number, actor = id, repo = 1, type = 'WatchEvent') => ({ id: String(id), type, actor: { id: actor }, repo: { id: repo, name: `owner/repo${repo}` }, payload: { action: 'started' }, created_at: new Date(hour + 1000).toISOString() });
const archive = (events: unknown[]) => new Response(gzipSync(events.map(e => JSON.stringify(e)).join('\n')));
const json = (data: unknown, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });
const raw = (id: number, extra = {}) => ({ id, full_name: `owner/repo${id}`, description: 'Useful tool', language: 'Rust', stargazers_count: 100, forks_count: 10, license: { spdx_id: 'MIT' }, topics: [], created_at: '2026-10-01T00:00:00Z', pushed_at: '2026-11-07T00:00:00Z', private: false, fork: false, archived: false, ...extra });
const resources: { store: TrendStore; collector: TrendCollector }[] = [];
const dirs: string[] = [];
function setup(fetcher: typeof fetch, token = 'test') {
  const store = new TrendStore(':memory:');
  let time = now;
  store.updateState({ lastDiscovery: now, lastTrending: now });
  const collector = new TrendCollector(store, { token, enabled: true, maxRepos: 2, fetch: fetcher, now: () => time });
  resources.push({ store, collector });
  return { store, collector, advance: (ms: number) => { time += ms; store.updateState({ lastDiscovery: time, lastTrending: time }); } };
}
afterEach(async () => {
  for (const { collector, store } of resources.splice(0)) { await collector.stop(); store.close(); }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('GH Archive streaming discovery', () => {
  it('uses UTC filenames and leaves a publication delay across midnight', () => {
    expect(archiveUrl(archiveHour(Date.parse('2026-11-08T00:20:00Z')))).toBe('https://data.gharchive.org/2026-11-07-22.json.gz');
  });
  it('deduplicates events, requires distinct actors, ignores pushes and out-of-hour events', async () => {
    const input = [event(1), event(1), event(2, 1), event(3, 2, 1, 'ForkEvent'), event(4, 3, 2), event(5, 3, 2), event(6, 4, 2, 'PushEvent'), { ...event(7, 5, 2), created_at: new Date(hour - 1).toISOString() }, { ...event(8), repo: { id: 8, name: '../bad/path' } }];
    const result = await readArchive(hour, vi.fn(async () => archive(input)));
    expect(result).toMatchObject({ events: 9, candidateCount: 1, candidates: [{ id: 1, actors: 2, watchEvents: 2, forkEvents: 1 }] });
    expect(JSON.stringify(result)).not.toContain('people');
  });
  it('handles gzip and Unicode split across chunks, including the final unterminated line', async () => {
    const compressed = gzipSync([event(1), { ...event(2), text: 'café — tool' }].map(e => JSON.stringify(e)).join('\n'));
    const body = new ReadableStream({ start(controller) { for (let i = 0; i < compressed.length; i += 7) controller.enqueue(compressed.subarray(i, i + 7)); controller.close(); } });
    expect((await readArchive(hour, vi.fn(async () => new Response(body)))).candidates).toHaveLength(1);
  });
  it('bounds the shortlist and excludes known repos before choosing new candidates', async () => {
    const events = Array.from({ length: 105 }, (_, i) => [event(i * 2 + 1, 1, i + 1), event(i * 2 + 2, 2, i + 1)]).flat();
    const result = await readArchive(hour, vi.fn(async () => archive(events)), undefined, new Set([1, 2, 3]));
    expect(result.candidateCount).toBe(105);
    expect(result.candidates).toHaveLength(100);
    expect(result.candidates[0].id).toBe(4);
  });
  it('rejects corrupt, truncated, oversized and unpublished files without returning partial candidates', async () => {
    for (const body of [gzipSync('{bad json'), gzipSync(JSON.stringify(event(1))).subarray(0, 15)]) {
      await expect(readArchive(hour, vi.fn(async () => new Response(body)))).rejects.toThrow();
    }
    await expect(readArchive(hour, vi.fn(async () => new Response('x', { headers: { 'content-length': String(257 * 1024 * 1024) } })))).rejects.toThrow('download limit');
    await expect(readArchive(hour, vi.fn(async () => new Response(null, { status: 404 })))).rejects.toThrow('not published');
  });
});

describe('archive collector integration', () => {
  it('verifies totals and licenses without forwarding credentials or inventing growth', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
      if (String(url).includes('gharchive.org')) {
        expect(new Headers(options?.headers).has('authorization')).toBe(false);
        return archive([event(1), event(2), event(3, 3, 2), event(4, 4, 2)]);
      }
      expect(new Headers(options?.headers).get('authorization')).toBe('Bearer test');
      return String(url).endsWith('/2') ? json(raw(2, { license: null })) : json(raw(1));
    });
    const { collector, store } = setup(fetcher);
    await collector.scan();
    expect(collector.response().items).toHaveLength(1);
    expect(collector.response().items[0]).toMatchObject({ id: 1, stars: 100, hour: null, score: 0, source: 'GH Archive', archiveSeenAt: now });
    expect(collector.response().archive).toMatchObject({ lastHour: hour, events: 4, pending: 0, error: null });
    expect(store.archiveKnown(now).has(2)).toBe(true);
    expect(store.archiveKnown(now + 25 * HOUR).has(2)).toBe(false);
  });
  it('spreads verification across scans and never downloads the same completed hour twice', async () => {
    const events = Array.from({ length: 30 }, (_, i) => [event(i * 2 + 1, 1, i + 1), event(i * 2 + 2, 2, i + 1)]).flat();
    const fetcher = vi.fn(async (url: string | URL | Request) => String(url).includes('gharchive.org') ? archive(events) : json(raw(Number(String(url).split('/').at(-1)))));
    const { collector, store, advance } = setup(fetcher);
    await collector.scan();
    expect(store.repositories()).toHaveLength(25);
    expect(store.archiveState().pending).toHaveLength(5);
    advance(HOUR / 4);
    // Existing watchlist requests use /repos/owner/repoN; serve them as well.
    fetcher.mockImplementation(async url => String(url).includes('gharchive.org') ? archive(events) : json(raw(Number(String(url).match(/(?:repo)?(\d+)$/)![1]))));
    await collector.scan();
    expect(store.repositories()).toHaveLength(30);
    expect(store.archiveState().pending).toHaveLength(0);
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes('gharchive.org'))).toHaveLength(1);
  });
  it('keeps the queue on GitHub cooldown and persists it across database reopen', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => String(url).includes('gharchive.org') ? archive([event(1), event(2)]) : json({}, 429, { 'retry-after': '3600' }));
    const { collector, store } = setup(fetcher);
    await collector.scan();
    expect(store.archiveState()).toMatchObject({ lastHour: hour, pending: [{ id: 1 }] });
    expect(store.state().blockedUntil).toBe(now + HOUR);
    const dir = mkdtempSync(path.join(tmpdir(), 'devloot-archive-')); dirs.push(dir);
    const filename = path.join(dir, 'archive.sqlite');
    const first = new TrendStore(filename); first.updateArchive(store.archiveState()); first.archiveChecked(7, now); first.close();
    const reopened = new TrendStore(filename);
    try { expect(reopened.archiveState()).toEqual(store.archiveState()); expect(reopened.archiveKnown(now).has(7)).toBe(true); }
    finally { reopened.close(); }
  });
  it('isolates archive failure and retries without advancing its cursor', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 404 }));
    const { collector, store, advance } = setup(fetcher);
    await collector.scan();
    expect(store.state()).toMatchObject({ error: null, lastRun: now });
    expect(store.archiveState()).toMatchObject({ lastHour: 0, nextRun: now + HOUR / 4, error: expect.stringContaining('not published') });
    advance(HOUR / 4);
    fetcher.mockImplementation(async () => archive([event(1, 1, 1, 'PushEvent')]));
    await collector.scan();
    // Anchor to the next UTC hour, not an hour after the retry finished.
    expect(store.archiveState()).toMatchObject({ lastHour: hour, nextRun: now + HOUR, error: null });
  });
  it('does not download in anonymous mode or while paused', async () => {
    const fetcher = vi.fn(async () => archive([]));
    const { collector } = setup(fetcher, '');
    await collector.scan();
    expect(collector.response().archive.enabled).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    const authenticated = setup(fetcher);
    await authenticated.collector.pause(true);
    await authenticated.collector.scan();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('pause cancels an in-flight download without completing the hour', async () => {
    let started!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const cancelled = vi.fn();
    const fetcher = vi.fn(async () => {
      const body = new ReadableStream({ start() { started(); }, cancel: cancelled });
      return new Response(body);
    });
    const { collector, store } = setup(fetcher);
    const task = collector.scan();
    await ready;
    await collector.pause(true);
    await task;
    expect(cancelled).toHaveBeenCalled();
    expect(store.archiveState().lastHour).toBe(0);
    expect(collector.response().archive.running).toBe(false);
  });
  it('returns a quiet repo to fast monitoring when the daily refresh finds growth', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => String(url).includes('gharchive.org')
      ? archive([event(1, 1, 1, 'PushEvent')]) : json(raw(3, { stargazers_count: 130 })));
    const { collector, store } = setup(fetcher);
    for (const id of [1, 2, 3]) {
      store.put({ id, fullName: `owner/repo${id}`, description: '', language: 'Rust', stars: 100, forks: 10, license: 'MIT', topics: [],
        createdAt: '2026-01-01', pushedAt: '2026-11-01', firstSeen: now - 48 * HOUR, lastSeen: id === 3 ? now - 48 * HOUR : now,
        checkedAt: id === 3 ? now - 24 * HOUR : now, source: 'GitHub search', saved: id === 1, dismissed: false });
      store.snapshot(id, { at: id === 3 ? now - 24 * HOUR : now, stars: 100, forks: 10 });
    }
    expect(collector.response().items.find(repo => repo.id === 3)?.tracking).toBe(false);
    await collector.scan();
    expect(store.get(3)?.priorityUntil).toBe(now + 6 * HOUR);
    expect(collector.response().items.find(repo => repo.id === 3)).toMatchObject({ tracking: true, hour: null, day: 30 });
  });
});
