import { afterAll, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync, verify } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GitHubAppAuth } from '../../src/collector/github-auth';
import { TrendCollector } from '../../src/collector/trends';
import { TrendStore } from '../../src/collector/trend-store';
const dir = mkdtempSync(path.join(tmpdir(), 'devloot-auth-test-'));
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKeyPath = path.join(dir, 'test.pem');
writeFileSync(privateKeyPath, privateKey.export({ type: 'pkcs1', format: 'pem' }), { mode: 0o600 });
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const start = Date.parse('2026-11-08T12:00:00Z');
const json = (body: unknown, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
function setup(installations: unknown = [{ id: 123, suspended_at: null }]) {
  let now = start, issued = 0;
  const fetcher = vi.fn(async (url: string | URL | Request, _options?: RequestInit) => String(url).includes('/access_tokens') ? json({ token: `test-installation-${++issued}`, expires_at: new Date(now + 3_600_000).toISOString() }) : json(installations));
  const auth = new GitHubAppAuth({ clientId: 'test-client', privateKeyPath, fetch: fetcher, now: () => now });
  return { auth, fetcher, advance: (ms: number) => { now += ms; } };
}
describe('GitHub App authentication', () => {
  it('signs a verifiable RS256 JWT and requests only public access', async () => {
    const { auth, fetcher } = setup();
    await auth.getToken();
    const headers = new Headers(fetcher.mock.calls[0][1]?.headers);
    const jwt = headers.get('authorization')!.slice(7);
    const [head, payload, signature] = jwt.split('.');
    expect(verify('RSA-SHA256', Buffer.from(`${head}.${payload}`), publicKey, Buffer.from(signature, 'base64url'))).toBe(true);
    expect(JSON.parse(Buffer.from(payload, 'base64url').toString())).toEqual({ iss: 'test-client', iat: start / 1000 - 60, exp: start / 1000 + 540 });
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'POST', redirect: 'error', body: JSON.stringify({ permissions: {} }) });
    expect(auth.status()).toMatchObject({ ready: true, installationId: '123' });
    expect(JSON.stringify(auth.status())).not.toContain('test-installation');
  });
  it('shares concurrent refreshes, caches tokens and renews before expiry', async () => {
    const { auth, fetcher, advance } = setup();
    const tokens = await Promise.all([auth.getToken(), auth.getToken(), auth.getToken()]);
    expect(new Set(tokens).size).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    advance(54 * 60_000);
    expect(await auth.getToken()).toBe(tokens[0]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    advance(2 * 60_000);
    expect(await auth.getToken()).not.toBe(tokens[0]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('does not let an old failed request invalidate a newer token', async () => {
    const { auth, fetcher } = setup();
    const old = await auth.getToken();
    auth.invalidate(old);
    const fresh = await auth.getToken();
    auth.invalidate(old);
    expect(await auth.getToken()).toBe(fresh);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('requires explicit selection for multiple installations', async () => {
    const { auth, fetcher } = setup([{ id: 1 }, { id: 2 }]);
    await expect(auth.getToken()).rejects.toThrow('multiple installations');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('reports an uninstalled or suspended app without minting a token', async () => {
    for (const installations of [[], [{ id: 1, suspended_at: '2026-11-08' }]]) {
      const { auth, fetcher } = setup(installations);
      await expect(auth.getToken()).rejects.toThrow('Install the GitHub App');
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it('uses a configured installation without discovery and validates its ID', async () => {
    const { fetcher } = setup();
    const privateKeyPem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const auth = new GitHubAppAuth({ clientId: 'client', privateKeyPem, installationId: '123', fetch: fetcher, now: () => start });
    await auth.getToken();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('https://api.github.com/app/installations/123/access_tokens');
    const invalid = new GitHubAppAuth({ clientId: 'client', privateKeyPath, installationId: '../bad', fetch: fetcher });
    await expect(invalid.getToken()).rejects.toThrow('numeric');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('sanitizes key and provider failures and honors auth rate limits', async () => {
    const invalidKey = new GitHubAppAuth({ clientId: 'client', privateKeyPath: '/missing/secret-path' });
    await expect(invalidKey.getToken()).rejects.toThrow('Cannot read');
    const fetcher = vi.fn(async () => json({ message: 'DO NOT EXPOSE THIS PROVIDER BODY' }, 429, { 'retry-after': '120' }));
    const auth = new GitHubAppAuth({ clientId: 'client', privateKeyPath, installationId: '123', fetch: fetcher, now: () => start });
    await expect(auth.getToken()).rejects.toMatchObject({ message: 'GitHub App authentication failed (429). The collector will retry automatically.', retryAt: start + 120_000 });
    expect(auth.status().ready).toBe(false);
  });
  it('does not cache malformed or expired tokens', async () => {
    const fetcher = vi.fn(async () => json({ token: 'expired', expires_at: new Date(start).toISOString() }));
    const auth = new GitHubAppAuth({ clientId: 'client', privateKeyPath, installationId: '123', fetch: fetcher, now: () => start });
    await expect(auth.getToken()).rejects.toThrow('invalid or expiring');
    await expect(auth.getToken()).rejects.toThrow('invalid or expiring');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('retries a revoked token once and never leaks it into collector status', async () => {
    const { auth, fetcher: authFetch } = setup();
    let calls = 0;
    const apiFetch = vi.fn(async (url: string | URL | Request) => {
      if (String(url).includes('github.com/trending')) return new Response('<article><h2><a href="/owner/repo">repo</a></h2></article>');
      if (++calls === 1) return json({}, 401);
      if (String(url).includes('/search/')) return json({ items: [] });
      return json({}, 404);
    });
    const store = new TrendStore(':memory:');
    const collector = new TrendCollector(store, { token: 'ignored-token', auth, maxRepos: 800, enabled: true, archiveEnabled: false, fetch: apiFetch, now: () => start });
    try {
      await collector.scan();
      expect(authFetch).toHaveBeenCalledTimes(3);
      expect(collector.response().collector).toMatchObject({ authenticated: true, authMode: 'app', capacity: 800, intervalMinutes: 15, error: null });
      expect(JSON.stringify(collector.response())).not.toMatch(/test-installation|ignored-token|BEGIN RSA/);
    } finally { await collector.stop(); store.close(); }
  });
  it('stops after a second 401 instead of looping', async () => {
    const { auth, fetcher: authFetch } = setup();
    const apiFetch = vi.fn(async () => json({}, 401));
    const store = new TrendStore(':memory:');
    const collector = new TrendCollector(store, { token: '', auth, enabled: true, archiveEnabled: false, fetch: apiFetch, now: () => start });
    try {
      await collector.scan();
      expect(apiFetch).toHaveBeenCalledTimes(2);
      expect(authFetch).toHaveBeenCalledTimes(3);
      expect(collector.response().collector.error).toContain('renewed installation token');
    } finally { await collector.stop(); store.close(); }
  });
});
