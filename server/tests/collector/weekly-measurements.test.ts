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
