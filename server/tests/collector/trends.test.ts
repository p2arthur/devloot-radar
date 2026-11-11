import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { HOUR, scoreTrend, eligibleRepository, parseTrending } from '../../src/collector/trend-score';
import { TrendStore } from '../../src/collector/trend-store';
import { TrendCollector } from '../../src/collector/trends';

const now = Date.parse('2026-11-08T12:00:00Z');
const point = (hoursAgo: number, stars: number) => ({ at: now - hoursAgo * HOUR, stars, forks: 5 });
const raw = (id = 1, extra = {}) => ({ id, full_name: `owner/repo${id}`, description: 'A useful development tool', language: 'TypeScript', stargazers_count: 100, forks_count: 10, license: { spdx_id: 'MIT' }, topics: ['developer-tools'], created_at: '2026-10-01T00:00:00Z', pushed_at: '2026-11-07T00:00:00Z', private: false, fork: false, archived: false, ...extra });
const json = (body: unknown, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const html = '<article class="Box-row"><h2><a href="/owner/repo1"> owner / repo1 </a></h2></article>';
const stores: TrendStore[] = [];
const collectors: TrendCollector[] = [];
const dirs: string[] = [];
function setup(fetcher: typeof fetch, token = 'test-token') {
  const store = new TrendStore(':memory:'); stores.push(store);
  let time = now;
  const collector = new TrendCollector(store, { token, enabled: true, archiveEnabled: false, fetch: fetcher, now: () => time }); collectors.push(collector);
  return { store, collector, advance: (ms: number) => { time += ms; } };
}
const defaultFetch = vi.fn(async (input: string | URL | Request) => {
  const url = String(input);
  if (url.startsWith('https://github.com/')) return new Response(html);
  if (url.includes('/search/')) return json({ items: [raw()] });
  return json(raw());
});
afterEach(async () => {
  for (const collector of collectors.splice(0)) await collector.stop();
  for (const store of stores.splice(0)) store.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe('trend evidence and scoring', () => {
  it('requires observed history and does not turn popularity into momentum', () => {
    expect(scoreTrend([point(0, 100_000)], now)).toMatchObject({ hour: null, acceleration: null, score: 0, signal: 'new' });
  });
  it('detects a breakout against the preceding five-hour pace', () => {
    expect(scoreTrend([point(24, 50), point(6, 100), point(1, 110), point(0, 140)], now)).toMatchObject({ hour: 30, sixHours: 40, day: 90, acceleration: 15, signal: 'emerging' });
  });
  it('does not flag tiny changes or fabricate acceleration without six hours', () => {
    expect(scoreTrend([point(6, 100), point(1, 100), point(0, 102)], now).signal).toBe('watching');
    expect(scoreTrend([point(1, 100), point(0, 140)], now)).toMatchObject({ signal: 'growing', acceleration: null });
  });
  it('rejects stale windows and preserves negative net growth', () => {
    expect(scoreTrend([point(4, 100), point(0, 500)], now).hour).toBeNull();
    expect(scoreTrend([point(6, 100), point(3, 500)], now).signal).toBe('stale');
    expect(scoreTrend([point(1, 100), point(0, 90)], now)).toMatchObject({ hour: -10, score: 0, signal: 'watching' });
  });
  it('filters public-but-unlicensed repositories, forks, and archives', () => {
    expect(eligibleRepository(raw())).toBe(true);
    for (const change of [{ private: true }, { fork: true }, { archived: true }, { disabled: true }, { license: null }, { license: { spdx_id: 'NOASSERTION' } }]) expect(eligibleRepository(raw(1, change))).toBe(false);
  });
  it('parses repository headings and fails visibly when HTML changes', () => {
    expect(parseTrending(`<a href="/login">Login</a>${html}${html}`)).toEqual(['owner/repo1']);
    expect(() => parseTrending('<html>Sign in</html>')).toThrow('no repository links');
  });
});

describe('persistent collector', () => {
  it('discovers, deduplicates and preserves user decisions during later refreshes', async () => {
    const { collector, store, advance } = setup(defaultFetch);
    await collector.scan();
    expect(store.repositories()).toHaveLength(1);
    expect(collector.response().items[0].signal).toBe('new');
    store.put({ ...store.get(1)!, saved: true, dismissed: true });
    advance(HOUR);
    await collector.scan();
    expect(store.get(1)).toMatchObject({ saved: true, dismissed: true });
    expect(collector.response(new Map([['owner/repo1', 'project-id']])).items[0].projectId).toBe('project-id');
  });
  it('serializes overlapping runs and manual checks cannot bypass cadence', async () => {
    const { collector } = setup(defaultFetch);
    const first = collector.scan();
    expect(collector.scan(true)).toBe(first);
    await first;
    const calls = defaultFetch.mock.calls.length;
    await collector.scan(true);
    expect(defaultFetch).toHaveBeenCalledTimes(calls);
  });
  it('collects again on schedule and measures growth from stored snapshots', async () => {
    let stars = 100;
    const fetcher = vi.fn(async (url: string | URL | Request) => String(url).includes('github.com/trending') ? new Response(html) : String(url).includes('/search/') ? json({ items: [raw(1, { stargazers_count: stars })] }) : json(raw(1, { stargazers_count: stars })));
    const { collector, advance } = setup(fetcher);
    await collector.scan();
    for (let i = 0; i < 4; i++) { advance(HOUR / 4); stars += 10; await collector.scan(); }
    expect(collector.response().items[0]).toMatchObject({ hour: 40, signal: 'growing' });
  });
  it('halts on rate limits, honors retry-after and survives a restart', async () => {
    const fetcher = vi.fn(async () => json({}, 429, { 'retry-after': '180', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String((now + HOUR) / 1000) }));
    const { collector, store, advance } = setup(fetcher);
    await collector.scan();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(store.state().blockedUntil).toBeGreaterThanOrEqual(now + HOUR);
    advance(5 * 60_000);
    const restarted = new TrendCollector(store, { token: 'test', enabled: true, fetch: fetcher, now: () => now + 5 * 60_000 }); collectors.push(restarted);
    await restarted.scan(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('reserves requests for other studio operations and stores a last successful response', async () => {
    const fetcher = vi.fn(async () => json({ items: [raw()] }, 200, { 'x-ratelimit-remaining': '1', 'x-ratelimit-reset': String((now + HOUR) / 1000) }));
    const { collector, store } = setup(fetcher);
    await collector.scan();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(store.repositories()).toHaveLength(1);
    expect(store.state().blockedUntil).toBeGreaterThan(now);
  });
  it('keeps API discovery when Trending markup is unavailable', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => String(url).includes('github.com/trending') ? new Response('<html>Unavailable</html>') : json({ items: [raw()] }));
    const { collector, store } = setup(fetcher);
    await collector.scan();
    expect(store.state()).toMatchObject({ lastRun: now, error: null });
    expect(store.state().warnings[0]).toContain('no repository links');
    expect(store.repositories()).toHaveLength(1);
  });
  it('uses a bounded anonymous mode and never sends credentials to the scraper', async () => {
    const fetcher = vi.fn(defaultFetch);
    const { collector } = setup(fetcher, '');
    await collector.scan();
    expect(collector.response().collector).toMatchObject({ capacity: 10, intervalMinutes: 30, authenticated: false });
    for (const call of fetcher.mock.calls as unknown as [string, RequestInit][]) expect(new Headers(call[1].headers).has('authorization')).toBe(false);
  });
  it('persists snapshots, decisions, pause and cooldown across database reopen', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'devloot-trends-')); dirs.push(dir);
    const filename = path.join(dir, 'test.sqlite');
    const first = new TrendStore(filename);
    first.snapshot(1, point(0, 100));
    first.updateState({ paused: true, blockedUntil: now + HOUR });
    first.close();
    const second = new TrendStore(filename); stores.push(second);
    expect(second.state()).toMatchObject({ paused: true, blockedUntil: now + HOUR });
    expect(second.history(1, now)).toEqual([point(0, 100)]);
  });
  it('adopts the shorter authenticated cadence after a restart without bypassing cooldowns', async () => {
    const { collector, store } = setup(defaultFetch);
    store.updateState({ lastRun: now - 20 * 60_000, nextRun: now + 10 * 60_000 });
    collector.start();
    await collector.scan();
    expect(defaultFetch).toHaveBeenCalled();
    await collector.stop();
    defaultFetch.mockClear();
    store.updateState({ lastRun: now - 20 * 60_000, nextRun: now + 10 * 60_000, blockedUntil: now + HOUR });
    collector.start();
    await collector.scan();
    expect(defaultFetch).not.toHaveBeenCalled();
  });
  it('retries a failed scan after changing authentication without retrying again on each restart', async () => {
    const { collector, store } = setup(defaultFetch);
    const failed = { lastRun: now - HOUR, nextRun: now + HOUR, error: 'Collection failed', failures: 2 };
    store.updateState({ ...failed, lastAuthMode: 'anonymous' });
    collector.start();
    await collector.scan();
    expect(store.state().lastRun).toBe(now);
    await collector.stop();

    store.updateState(failed);
    collector.start();
    await collector.scan();
    expect(store.state()).toMatchObject(failed);
  });
  it('runs unattended on the timer without a browser request', async () => {
    vi.useFakeTimers();
    try {
      const { collector, advance } = setup(defaultFetch);
      collector.start();
      await collector.scan();
      const calls = defaultFetch.mock.calls.length;
      advance(HOUR / 4);
      await vi.advanceTimersByTimeAsync(30_000);
      await collector.scan();
      expect(defaultFetch.mock.calls.length).toBeGreaterThan(calls);
      await collector.stop();
    } finally { vi.useRealTimers(); }
  });
  it('follows repository renames only within the GitHub API origin', async () => {
    let redirect = false;
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      if (!redirect) return defaultFetch(url);
      if (String(url).endsWith('/repos/owner/repo1')) return new Response(null, { status: 301, headers: { location: 'https://api.github.com/repositories/1' } });
      return json(raw(1, { full_name: 'owner/renamed', stargazers_count: 130 }));
    });
    const { collector, store, advance } = setup(fetcher);
    await collector.scan();
    redirect = true;
    advance(HOUR / 4);
    await collector.scan();
    expect(store.get(1)?.fullName).toBe('owner/renamed');
    expect(store.repositories()).toHaveLength(1);
  });
  it('does not forward the token to a redirect on another origin', async () => {
    let redirect = false;
    const fetcher = vi.fn(async (url: string | URL | Request) => !redirect ? defaultFetch(url) : new Response(null, { status: 301, headers: { location: 'https://example.invalid/steal' } }));
    const { collector, store, advance } = setup(fetcher);
    await collector.scan();
    redirect = true;
    advance(HOUR / 4);
    await collector.scan();
    expect(fetcher.mock.calls.every(([url]) => !String(url).includes('example.invalid'))).toBe(true);
    expect(store.state().warnings.join(' ')).toContain('301');
  });
  it('removes old snapshots but keeps saved and dismissed decisions', async () => {
    const { collector, store, advance } = setup(defaultFetch);
    await collector.scan();
    store.put({ ...store.get(1)!, saved: true, dismissed: true });
    advance(40 * 24 * HOUR);
    store.prune(now + 40 * 24 * HOUR);
    expect(store.get(1)).toMatchObject({ saved: true, dismissed: true });
    expect(store.history(1, now + 40 * 24 * HOUR)).toEqual([]);
  });
  it('does not poll while paused or disabled', async () => {
    const { collector, store } = setup(defaultFetch);
    await collector.pause(true);
    await collector.scan(true);
    expect(defaultFetch).not.toHaveBeenCalled();
    expect(store.state().paused).toBe(true);
    const disabled = new TrendCollector(store, { token: '', enabled: false, fetch: defaultFetch }); collectors.push(disabled);
    await disabled.scan();
    expect(defaultFetch).not.toHaveBeenCalled();
  });
});
