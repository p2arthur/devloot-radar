import { afterEach, expect, it } from 'vitest';
import { TrendStore } from '../../src/collector/trend-store';
import { HOUR } from '../../src/collector/trend-score';

const now = Date.parse('2026-11-16T16:00:00Z');
const store = new TrendStore(':memory:');
afterEach(() => store.db.exec('DELETE FROM trend_snapshots'));

it('measures a full week from actual observations, preserving negative and zero changes', () => {
  for (const [id, stars] of [[1, 150], [2, 100], [3, 90]]) {
    store.snapshot(id, { at: now - 168 * HOUR - 10 * 60000, stars: 100, forks: 1 });
    store.snapshot(id, { at: now, stars, forks: 1 });
    expect(store.weeklyDelta(id, now)).toBe(stars - 100);
  }
  expect(store.history(1, now)).toHaveLength(1);
});
it('does not label a partial week or a missing boundary as seven-day growth', () => {
  store.snapshot(1, { at: now - 167 * HOUR, stars: 100, forks: 1 });
  store.snapshot(1, { at: now, stars: 200, forks: 1 });
  expect(store.weeklyDelta(1, now)).toBeNull();
  store.snapshot(1, { at: now - 169 * HOUR, stars: 90, forks: 1 });
  expect(store.weeklyDelta(1, now)).toBeNull();
});
it('rejects stale measurements and future samples without changing retention', () => {
  store.snapshot(1, { at: now - 171 * HOUR, stars: 100, forks: 1 });
  store.snapshot(1, { at: now - 3 * HOUR, stars: 200, forks: 1 });
  store.snapshot(1, { at: now + HOUR, stars: 400, forks: 1 });
  expect(store.weeklyDelta(1, now)).toBeNull();
  expect(store.db.prepare('SELECT count(*) AS count FROM trend_snapshots').get()).toEqual({ count: 3 });
});

it.each([14, 31] as const)('measures %s-day deltas only with a complete boundary', days => {
  store.snapshot(1, { at: now - days * 24 * HOUR - 15 * 60000, stars: 100, forks: 1 });
  store.snapshot(1, { at: now, stars: 80, forks: 1 });
  expect(store.periodDelta(1, now, days)).toBe(-20);
  store.snapshot(2, { at: now - (days - 1) * 24 * HOUR, stars: 100, forks: 1 });
  store.snapshot(2, { at: now, stars: 100, forks: 1 });
  expect(store.periodDelta(2, now, days)).toBeNull();
  const window = days === 14 ? '14d' : '31d';
  expect(store.chartHistory(1, now, window)).toEqual([{ at: now, stars: 80, forks: 1 }]);
});
it('retains 31-day baseline samples and prunes only beyond the 32-day margin', () => {
  for (const days of [7, 14, 31, 32, 33]) store.snapshot(1, { at: now - days * 24 * HOUR, stars: days, forks: 1 });
  store.prune(now);
  expect(store.db.prepare('SELECT stars FROM trend_snapshots ORDER BY at').all()).toEqual([{stars:32},{stars:31},{stars:14},{stars:7}]);
});
