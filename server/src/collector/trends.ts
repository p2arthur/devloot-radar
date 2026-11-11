import type { TrendAuthMode, TrendRepository, TrendsResponse } from './shared/trends';
import { TrendStore } from './trend-store';
import { GitHubAppAuth, GitHubAuthError } from './github-auth';
import { eligibleRepository, HOUR, parseTrending, scoreTrend } from './trend-score';
import { ArchiveError, archiveHour, readArchive } from './gh-archive';

interface GitHubRepo {
  id: number; full_name: string; description: string | null; language: string | null;
  stargazers_count: number; forks_count: number; topics?: string[];
  created_at: string; pushed_at: string; license: { spdx_id: string } | null;
  private: boolean; fork: boolean; archived: boolean; disabled?: boolean;
}
class GitHubError extends Error { constructor(message: string, readonly status: number) { super(message); } }
type Options = { token: string; auth?: GitHubAppAuth; maxRepos?: number; enabled: boolean; archiveEnabled?: boolean; fetch?: typeof fetch; now?: () => number };

export class TrendCollector {
  readonly interval: number;
  private readonly authenticatedMode: boolean;
  private readonly authMode: TrendAuthMode;
  readonly capacity: number;
  private timer?: ReturnType<typeof setInterval>;
  private task: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private readonly request: typeof fetch;
  private readonly now: () => number;
  private stopped = false;
  private archiveRunning = false;
  constructor(readonly store: TrendStore, private options: Options) {
    this.authMode = options.auth ? 'app' : options.token ? 'token' : 'anonymous';
    this.authenticatedMode = this.authMode !== 'anonymous';
    this.interval = (this.authenticatedMode ? 15 : 30) * 60_000;
    const limit = options.maxRepos ?? 300;
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('TRENDS_MAX_REPOS must be an integer between 1 and 1000.');
    this.capacity = this.authenticatedMode ? limit : 10;
    this.request = options.fetch || fetch;
    this.now = options.now || Date.now;
  }
  start() {
    if (this.timer || !this.options.enabled) return;
    this.stopped = false;
    const state = this.store.state();
    // A change in authentication can resolve a previous failure. Keep rate-limit cooldowns and pauses intact.
    const authChanged = state.lastAuthMode !== this.authMode;
    const canReschedule = !state.paused && (state.error
      ? authChanged && state.blockedUntil <= this.now()
      : state.lastRun > 0);
    this.store.updateState({
      lastAuthMode: this.authMode,
      ...(canReschedule ? { nextRun: Math.min(state.nextRun, state.lastRun ? state.lastRun + this.interval : 0) } : {}),
    });
    void this.scan();
    this.timer = setInterval(() => { void this.scan(); }, 30_000);
    this.timer.unref();
  }
  async stop() {
    this.stopped = true;
    clearInterval(this.timer); this.timer = undefined;
    this.controller?.abort();
    await this.task;
  }
  async pause(paused: boolean) {
    this.store.updateState({ paused });
    if (paused) { this.controller?.abort(); await this.task; }
    else void this.scan();
  }
  response(imported: Map<string, string> = new Map()): TrendsResponse {
    const now = this.now();
    const tracked = new Set(this.active().map(repo => repo.id));
    const items = this.store.repositories().map(repo => ({ ...repo, ...scoreTrend(this.store.history(repo.id, now), now), projectId: imported.get(repo.fullName.toLowerCase()) || null, tracking: tracked.has(repo.id) }));
    items.sort((a, b) => b.score - a.score || b.firstSeen - a.firstSeen || b.stars - a.stars);
    const { pending, failures: _failures, ...archive } = this.store.archiveState();
    const { lastAuthMode: _lastAuthMode, ...state } = this.store.state();
    return { items, archive: { ...archive, pending: pending.length, enabled: this.archiveEnabled, running: this.archiveRunning }, collector: { ...state, running: !!this.task, authenticated: this.options.auth ? this.options.auth.status().ready : !!this.options.token, authMode: this.authMode, tokenExpiresAt: this.options.auth?.status().expiresAt || null, enabled: this.options.enabled, intervalMinutes: this.interval / 60_000, capacity: this.capacity, tracked: tracked.size } };
  }
  private get archiveEnabled() { return this.options.enabled && this.authenticatedMode && this.options.archiveEnabled !== false; }
  private active() {
    const now = this.now();
    return this.store.repositories().filter(r => !r.dismissed).map(repo => ({ repo, metrics: scoreTrend(this.store.history(repo.id, now), now) }))
      .sort((a, b) => Number(b.repo.saved) - Number(a.repo.saved)
        || Number(['emerging', 'growing'].includes(b.metrics.signal)) - Number(['emerging', 'growing'].includes(a.metrics.signal))
        || Number(now - b.repo.firstSeen < 6 * HOUR || (b.repo.priorityUntil || 0) > now) - Number(now - a.repo.firstSeen < 6 * HOUR || (a.repo.priorityUntil || 0) > now)
        || b.metrics.score - a.metrics.score || b.repo.lastSeen - a.repo.lastSeen || a.repo.checkedAt - b.repo.checkedAt)
      .slice(0, this.capacity).map(r => r.repo);
  }
  scan(manual = false): Promise<void> {
    const state = this.store.state(), now = this.now();
    if (this.task) return this.task;
    if (this.stopped || !this.options.enabled || state.paused || now < state.blockedUntil || now < state.nextRun) return Promise.resolve();
    // Manual checks use the same cadence and budget as automatic checks.
    void manual;
    this.controller = new AbortController();
    this.task = this.collect().finally(() => { this.task = null; this.controller = null; });
    return this.task;
  }
  private async github<T>(route: string, redirects = 0, refreshed = false): Promise<T> {
    this.controller?.signal.throwIfAborted();
    const state = this.store.state(), now = this.now();
    if (state.blockedUntil > now) throw new GitHubError('GitHub requests are waiting for the rate limit to reset.', 429);
    const token = this.options.auth ? await this.options.auth.getToken(this.controller?.signal) : this.options.token;
    const response = await this.request(`https://api.github.com${route}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'DevLoot-Trend-Collector', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      redirect: 'manual', signal: this.signal(),
    });
    const remainingHeader = response.headers.get('x-ratelimit-remaining');
    const remaining = remainingHeader === null ? null : Number(remainingHeader);
    const resetAt = Number(response.headers.get('x-ratelimit-reset') || 0) * 1000;
    const search = route.startsWith('/search/');
    if (!search) this.store.updateState({ remaining, resetAt });
    if ([301, 302, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      const next = location ? new URL(location, 'https://api.github.com') : null;
      if (!next || next.origin !== 'https://api.github.com' || next.username || next.password || redirects >= 3) throw new GitHubError('GitHub returned an unsupported redirect.', response.status);
      return this.github<T>(`${next.pathname}${next.search}`, redirects + 1, refreshed);
    }
    if (response.status === 401) {
      if (this.options.auth) {
        this.options.auth.invalidate(token);
        if (!refreshed) return this.github<T>(route, redirects, true);
      }
      this.store.updateState({ blockedUntil: now + HOUR });
      throw new GitHubError(this.options.auth ? 'GitHub rejected the renewed installation token. Check the App installation and permissions.' : 'GitHub rejected GITHUB_TOKEN. Update it in .env and restart the server.', 401);
    }
    const lowBudget = remaining !== null && remaining <= (search ? 1 : 10);
    if ([403, 429].includes(response.status) || lowBudget) {
      const retry = response.headers.get('retry-after');
      const retryAt = retry ? (/^\d+$/.test(retry) ? now + Number(retry) * 1000 : Date.parse(retry)) : 0;
      const backoff = Math.min(HOUR, 60_000 * 2 ** this.store.state().failures);
      const blockedUntil = Math.max(now + backoff, Number.isFinite(retryAt) ? retryAt : 0, lowBudget ? resetAt + 1000 : 0);
      this.store.updateState({ blockedUntil });
      // Preserve a successful last response before stopping further requests.
      if (!response.ok) throw new GitHubError('GitHub rate limit or access restriction. Collection will retry automatically.', response.status);
    }
    if (!response.ok) throw new GitHubError(`GitHub returned ${response.status}.`, response.status);
    return response.json() as Promise<T>;
  }
  private signal() {
    return this.controller ? AbortSignal.any([this.controller.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000);
  }
  private record(raw: GitHubRepo, source: string) {
    if (!Number.isSafeInteger(raw.id) || !/^[\w.-]+\/[\w.-]+$/.test(raw.full_name) || !Number.isFinite(raw.stargazers_count) || !Number.isFinite(raw.forks_count)) throw new Error('GitHub returned invalid repository metadata.');
    const previous = this.store.get(raw.id);
    if (!eligibleRepository(raw)) {
      if (previous) this.store.put({ ...previous, dismissed: true });
      return;
    }
    const now = this.now();
    const repo: TrendRepository = {
      id: raw.id, fullName: raw.full_name, description: (raw.description || '').slice(0, 1000), language: raw.language,
      stars: raw.stargazers_count, forks: raw.forks_count, license: raw.license!.spdx_id, topics: (raw.topics || []).slice(0, 20),
      createdAt: raw.created_at, pushedAt: raw.pushed_at, firstSeen: previous?.firstSeen || now, lastSeen: source === 'tracking' ? previous?.lastSeen || now : now,
      checkedAt: now, source: source === 'tracking' ? previous?.source || source : source, saved: previous?.saved || false, dismissed: previous?.dismissed || false,
      archiveSeenAt: source === 'GH Archive' ? now : previous?.archiveSeenAt,
      priorityUntil: previous && now - previous.checkedAt >= 6 * HOUR && raw.stargazers_count - previous.stars >= 20 ? now + 6 * HOUR : previous?.priorityUntil,
    };
    this.store.put(repo);
    this.store.snapshot(repo.id, { at: now, stars: repo.stars, forks: repo.forks });
  }
  private async discover() {
    const state = this.store.state(), now = this.now();
    const date = (days: number) => new Date(now - days * 24 * HOUR).toISOString().slice(0, 10);
    const queries = [
      `created:>=${date(30)} stars:>=20`, `created:>=${date(180)} stars:50..2000`,
      'topic:developer-tools stars:50..10000', 'topic:self-hosted stars:50..10000',
      'language:TypeScript stars:50..2000', 'language:Python stars:50..2000',
      'topic:automation stars:50..10000', 'language:Rust stars:50..10000',
    ];
    for (let offset = 0; offset < 4; offset++) {
      const query = queries[(state.queryCursor + offset) % queries.length];
      const params = new URLSearchParams({ q: `${query} pushed:>=${date(30)} archived:false fork:false is:public`, sort: 'stars', order: 'desc', per_page: this.authenticatedMode ? '100' : '30' });
      const result = await this.github<{ items: GitHubRepo[]; incomplete_results?: boolean }>(`/search/repositories?${params}`);
      if (!Array.isArray(result.items)) throw new Error('GitHub search returned an unexpected response.');
      for (const repo of result.items) this.record(repo, 'GitHub search');
      if (result.incomplete_results) this.store.updateState({ warnings: [...this.store.state().warnings, 'A GitHub search was incomplete; coverage may be reduced.'] });
    }
    this.store.updateState({ lastDiscovery: this.now(), queryCursor: (state.queryCursor + 4) % queries.length });
  }
  private async trending() {
    const names = new Set<string>();
    for (const period of ['daily', 'weekly']) {
      const response = await this.request(`https://github.com/trending?since=${period}`, { headers: { 'User-Agent': 'DevLoot-Trend-Collector' }, signal: this.signal() });
      if (!response.ok) throw new Error(`GitHub Trending is unavailable (${response.status}).`);
      for (const name of parseTrending(await response.text())) names.add(name);
    }
    const known = new Map(this.store.repositories().map(repo => [repo.fullName.toLowerCase(), repo]));
    let fetched = 0;
    for (const name of names) {
      const cached = known.get(name.toLowerCase());
      const existing = cached ? this.store.get(cached.id) : undefined;
      if (existing) {
        this.store.put({ ...existing, lastSeen: this.now(), source: 'GitHub Trending' });
      } else if (fetched < (this.authenticatedMode ? 50 : 4)) {
        fetched++;
        try { this.record(await this.github<GitHubRepo>(`/repos/${name}`), 'GitHub Trending'); }
        catch (error) { if (!(error instanceof GitHubError && error.status === 404)) throw error; }
      }
    }
  }
  private async archive() {
    if (!this.archiveEnabled) return;
    const state = this.store.archiveState(), now = this.now(), hour = archiveHour(now);
    if (now >= state.nextRun && hour > state.lastHour) {
      this.archiveRunning = true;
      try {
        const batch = await readArchive(hour, this.request, this.controller?.signal, this.store.archiveKnown(now));
        this.store.updateArchive({ lastHour: hour, lastSuccess: this.now(), nextRun: hour + 3 * HOUR, events: batch.events,
          candidateCount: batch.candidateCount, pending: batch.candidates, error: null, failures: 0 });
      } catch (error) {
        if (this.controller?.signal.aborted) throw error;
        this.store.updateArchive({ error: error instanceof ArchiveError ? error.message : 'GH Archive download failed. It will retry automatically; GitHub checks continue.',
          failures: Math.min(state.failures + 1, 6), nextRun: this.now() + Math.min(HOUR, 15 * 60_000 * 2 ** state.failures) });
      } finally { this.archiveRunning = false; }
    }
    // Reuse the API's serial request and cooldown path. The durable queue survives
    // rate limits/restarts. A new hourly batch replaces any stale leftovers.
    for (let fetched = 0; fetched < 25; fetched++) {
      const candidate = this.store.archiveState().pending[0];
      if (!candidate) break;
      try {
        if (!this.store.get(candidate.id)) this.record(await this.github<GitHubRepo>(`/repositories/${candidate.id}`), 'GH Archive');
      } catch (error) {
        if (!(error instanceof GitHubError && [404, 451].includes(error.status))) throw error;
      }
      this.store.archiveChecked(candidate.id, this.now());
      this.store.updateArchive({ pending: this.store.archiveState().pending.slice(1) });
    }
  }
  private async collect() {
    this.store.updateState({ error: null, warnings: [] });
    try {
      if (this.options.auth) await this.options.auth.getToken(this.controller?.signal);
      else if (/[\r\n]/.test(this.options.token)) throw new GitHubAuthError('GITHUB_TOKEN must contain a single-line access token. Configure a GitHub App private key separately.');
      // Measure existing candidates first, so discovery does not starve their observations.
      const candidates = this.active();
      const activeIds = new Set(candidates.map(repo => repo.id));
      const quiet = this.store.repositories().filter(r => !r.dismissed && !activeIds.has(r.id) && this.now() - r.checkedAt >= 24 * HOUR)
        .sort((a, b) => a.checkedAt - b.checkedAt).slice(0, this.authenticatedMode ? 50 : 0);
      for (const repo of [...candidates, ...quiet]) {
        if (this.now() - repo.checkedAt < this.interval - 30_000) continue;
        try { this.record(await this.github<GitHubRepo>(`/repos/${repo.fullName}`), 'tracking'); }
        catch (error) {
          if (error instanceof GitHubError && [404, 451].includes(error.status)) this.store.put({ ...(this.store.get(repo.id) || repo), dismissed: true });
          else if (error instanceof GitHubError && ![401, 403, 429].includes(error.status)) {
            this.store.updateState({ warnings: [...this.store.state().warnings.slice(0, 9), `Could not refresh ${repo.fullName} (${error.status}). Other repositories are still being checked.`] });
          } else throw error;
        }
      }
      if (this.now() - this.store.state().lastDiscovery >= HOUR / 2) await this.discover();
      if (this.now() - this.store.state().lastTrending >= HOUR) {
        // A scraper failure must not stop API-based collection; retry it on the next hour.
        this.store.updateState({ lastTrending: this.now() });
        try { await this.trending(); }
        catch (error) {
          if (this.controller?.signal.aborted || error instanceof GitHubError || error instanceof GitHubAuthError) throw error;
          this.store.updateState({ warnings: [...this.store.state().warnings, (error as Error).message] });
        }
      }
      await this.archive();
      this.store.prune(this.now());
      this.store.updateState({ lastRun: this.now(), nextRun: this.now() + this.interval, failures: 0 });
    } catch (error) {
      if (this.controller?.signal.aborted) return;
      const state = this.store.state();
      const backoff = Math.min(HOUR, 60_000 * 2 ** state.failures);
      this.store.updateState({ error: error instanceof GitHubError || error instanceof GitHubAuthError ? error.message : 'Collection failed. Check the network connection; the collector will retry automatically.', failures: Math.min(state.failures + 1, 8), blockedUntil: Math.max(state.blockedUntil, error instanceof GitHubAuthError ? error.retryAt : 0), nextRun: Math.max(this.now() + backoff, state.blockedUntil, error instanceof GitHubAuthError ? error.retryAt : 0) });
    }
  }
}
