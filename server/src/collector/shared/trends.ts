export interface TrendSnapshot { at: number; stars: number; forks: number }
export interface TrendRepository {
  id: number; fullName: string; description: string; language: string | null;
  stars: number; forks: number; license: string; topics: string[];
  createdAt: string; pushedAt: string; firstSeen: number; lastSeen: number;
  checkedAt: number; source: string; saved: boolean; dismissed: boolean;
  archiveSeenAt?: number;
  priorityUntil?: number;
}
export interface TrendMetrics {
  hour: number | null; sixHours: number | null; day: number | null;
  acceleration: number | null; score: number; signal: 'emerging' | 'growing' | 'watching' | 'new' | 'stale'; reason: string;
}
export interface TrendItem extends TrendRepository, TrendMetrics { projectId: string | null; tracking: boolean }
export type TrendAuthMode = 'app' | 'token' | 'anonymous';
export interface TrendState {
  paused: boolean; lastRun: number; lastDiscovery: number; lastTrending: number;
  nextRun: number; blockedUntil: number; error: string | null; warnings: string[];
  queryCursor: number; remaining: number | null; resetAt: number; failures: number;
}
export interface TrendsResponse {
  items: TrendItem[];
  archive: { enabled: boolean; running: boolean; lastHour: number; lastSuccess: number; nextRun: number; events: number; candidateCount: number; pending: number; error: string | null };
  collector: TrendState & { running: boolean; authenticated: boolean; authMode: TrendAuthMode; tokenExpiresAt: number | null; enabled: boolean; intervalMinutes: number; capacity: number; tracked: number };
}
