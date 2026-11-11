import { DatabaseSync } from 'node:sqlite';
import type { TrendAuthMode, TrendRepository, TrendSnapshot, TrendState } from './shared/trends';
import { HOUR } from './trend-score';
import type { ArchiveCandidate } from './gh-archive';

interface ArchiveState {
  lastHour: number; lastSuccess: number; nextRun: number; events: number; candidateCount: number;
  pending: ArchiveCandidate[]; error: string | null; failures: number;
}
type StoredTrendState = TrendState & { lastAuthMode?: TrendAuthMode };

export class TrendStore {
  readonly db: DatabaseSync;
  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS trend_repositories (id INTEGER PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS trend_snapshots (repo_id INTEGER NOT NULL, at INTEGER NOT NULL, stars INTEGER NOT NULL, forks INTEGER NOT NULL, PRIMARY KEY(repo_id, at));
      CREATE TABLE IF NOT EXISTS trend_state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS trend_archive_state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS trend_archive_checked (repo_id INTEGER PRIMARY KEY, at INTEGER NOT NULL);`);
  }
  repositories(): TrendRepository[] { return this.db.prepare('SELECT data FROM trend_repositories').all().map(r => JSON.parse(String(r.data))); }
  get(id: number): TrendRepository | undefined {
    const row = this.db.prepare('SELECT data FROM trend_repositories WHERE id=?').get(id);
    return row ? JSON.parse(String(row.data)) : undefined;
  }
  put(repo: TrendRepository) { this.db.prepare('INSERT OR REPLACE INTO trend_repositories VALUES (?,?)').run(repo.id, JSON.stringify(repo)); }
  snapshot(id: number, point: TrendSnapshot) {
    this.db.prepare('INSERT OR REPLACE INTO trend_snapshots VALUES (?,?,?,?)').run(id, point.at, point.stars, point.forks);
  }
  history(id: number, now: number): TrendSnapshot[] {
    return this.db.prepare('SELECT at,stars,forks FROM trend_snapshots WHERE repo_id=? AND at>=? ORDER BY at').all(id, now - 26 * HOUR) as unknown as TrendSnapshot[];
  }
  // Public chart reads use fixed windows; scoring keeps its original 26-hour history.
  chartHistory(id: number, now: number, window: '24h' | '7d'): TrendSnapshot[] {
    if (window !== '24h' && window !== '7d') throw new Error('Invalid history window');
    const hours = window === '7d' ? 7 * 24 : 24;
    return this.db.prepare('SELECT at,stars,forks FROM trend_snapshots WHERE repo_id=? AND at>=? AND at<=? ORDER BY at').all(id, now - hours * HOUR, now) as unknown as TrendSnapshot[];
  }
  state(): StoredTrendState {
    const row = this.db.prepare('SELECT data FROM trend_state WHERE id=1').get();
    return { paused: false, lastRun: 0, lastDiscovery: 0, lastTrending: 0, nextRun: 0, blockedUntil: 0, error: null, warnings: [], queryCursor: 0, remaining: null, resetAt: 0, failures: 0, ...(row ? JSON.parse(String(row.data)) : {}) };
  }
  updateState(update: Partial<StoredTrendState>) {
    const next = { ...this.state(), ...update };
    this.db.prepare('INSERT OR REPLACE INTO trend_state VALUES (1,?)').run(JSON.stringify(next));
    return next;
  }
  archiveState(): ArchiveState {
    const row = this.db.prepare('SELECT data FROM trend_archive_state WHERE id=1').get();
    return { lastHour: 0, lastSuccess: 0, nextRun: 0, events: 0, candidateCount: 0, pending: [], error: null, failures: 0, ...(row ? JSON.parse(String(row.data)) : {}) };
  }
  updateArchive(update: Partial<ArchiveState>) {
    const next = { ...this.archiveState(), ...update };
    this.db.prepare('INSERT OR REPLACE INTO trend_archive_state VALUES (1,?)').run(JSON.stringify(next));
    return next;
  }
  archiveKnown(now: number) {
    return new Set([...this.repositories().map(repo => repo.id), ...this.db.prepare('SELECT repo_id FROM trend_archive_checked WHERE at>=?').all(now - 24 * HOUR).map(row => Number(row.repo_id))]);
  }
  archiveChecked(id: number, now: number) { this.db.prepare('INSERT OR REPLACE INTO trend_archive_checked VALUES (?,?)').run(id, now); }
  prune(now: number) {
    this.db.prepare('DELETE FROM trend_archive_checked WHERE at<?').run(now - 24 * HOUR);
    this.db.prepare('DELETE FROM trend_snapshots WHERE at<?').run(now - 8 * 24 * HOUR);
    // Keep user decisions, but discard inactive discovery records after 30 days.
    for (const repo of this.repositories()) if (!repo.saved && !repo.dismissed && repo.lastSeen < now - 30 * 24 * HOUR) {
      this.db.prepare('DELETE FROM trend_repositories WHERE id=?').run(repo.id);
      this.db.prepare('DELETE FROM trend_snapshots WHERE repo_id=?').run(repo.id);
    }
  }
  close() { this.db.close(); }
}
