import type { TrendMetrics, TrendSnapshot } from './shared/trends';
export const HOUR = 3_600_000;

// A window needs a real observation near its boundary. Never extrapolate across downtime.
export function scoreTrend(points: TrendSnapshot[], now: number): TrendMetrics {
  const sorted = [...points].sort((a, b) => a.at - b.at);
  const latest = sorted.at(-1);
  const empty: TrendMetrics = { hour: null, sixHours: null, day: null, acceleration: null, score: 0, signal: 'new', reason: 'Collecting a baseline. Growth appears after an hour of observations.' };
  if (!latest) return empty;
  if (now - latest.at > 2 * HOUR) return { ...empty, signal: 'stale', reason: 'No recent observation. Waiting for the collector to check this repository.' };
  function baseline(hours: number) {
    const target = latest!.at - hours * HOUR;
    // At most a 20% error, capped at 30 minutes; require the full window.
    return sorted.filter(p => p.at <= target && target - p.at <= Math.min(hours * HOUR * .2, HOUR / 2)).at(-1);
  }
  const one = baseline(1), six = baseline(6), day = baseline(24);
  const hour = one ? latest.stars - one.stars : null;
  const sixHours = six ? latest.stars - six.stars : null;
  const daily = day ? latest.stars - day.stars : null;
  if (hour === null) return { ...empty, sixHours, day: daily };
  const hourlyRate = hour / ((latest.at - one!.at) / HOUR);
  const previousRate = six && one && one.at > six.at ? Math.max(0, one.stars - six.stars) / ((one.at - six.at) / HOUR) : null;
  const acceleration = previousRate === null ? null : hourlyRate / Math.max(previousRate, 1);
  const emerging = hour >= 20 && acceleration !== null && acceleration >= 3;
  const signal = emerging ? 'emerging' : hour >= 5 ? 'growing' : 'watching';
  const score = Math.round(10 * Math.log1p(Math.max(0, hourlyRate)) + 8 * Math.min(10, Math.max(0, acceleration || 0)) + 20 * Math.min(1, Math.max(0, hour) / Math.max(100, one!.stars)));
  const reason = `${hour >= 0 ? '+' : ''}${hour} net stars in ~1h${acceleration !== null ? ` · ${acceleration.toFixed(1)}× previous pace` : ' · building a 6h baseline'}`;
  return { hour, sixHours, day: daily, acceleration, score, signal, reason };
}

// GitHub's recognized common OSI licenses. Missing/custom licenses are excluded from this MVP.
const licenses = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'GPL-2.0', 'GPL-3.0', 'GPL-2.0-only', 'GPL-3.0-only', 'GPL-2.0-or-later', 'GPL-3.0-or-later', 'AGPL-3.0', 'AGPL-3.0-only', 'AGPL-3.0-or-later', 'LGPL-2.1', 'LGPL-3.0', 'LGPL-2.1-only', 'LGPL-3.0-only', 'LGPL-2.1-or-later', 'LGPL-3.0-or-later', 'MPL-2.0', 'ISC', 'Unlicense', 'BSL-1.0', 'EPL-2.0', 'Zlib', 'Artistic-2.0', 'OSL-3.0']);
export function eligibleRepository(repo: { private?: boolean; fork?: boolean; archived?: boolean; disabled?: boolean; license?: { spdx_id?: string } | null }) {
  return !repo.private && !repo.fork && !repo.archived && !repo.disabled && licenses.has(repo.license?.spdx_id || '');
}

export function parseTrending(html: string): string[] {
  const names = [...html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/gi)].flatMap(([article]) => {
    const heading = article.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1];
    const name = heading?.match(/href=["']\/([\w.-]+\/[\w.-]+)["']/i)?.[1];
    return name && !name.split('/').some(p => p === '.' || p === '..') ? [name] : [];
  });
  if (!names.length) throw new Error('GitHub Trending returned no repository links. API discovery is still available.');
  return [...new Set(names)].slice(0, 50);
}
