import { readFile } from 'node:fs/promises';
import { createPrivateKey, sign } from 'node:crypto';

export class GitHubAuthError extends Error {
  constructor(message: string, readonly retryAt = 0) { super(message); }
}
export interface GitHubAppOptions {
  clientId: string; privateKeyPath?: string; privateKeyPem?: string; installationId?: string;
  fetch?: typeof fetch; now?: () => number;
}
export class GitHubAppAuth {
  private cached: { token: string; expiresAt: number } | null = null;
  private pending: Promise<string> | null = null;
  private installationId: string;
  private request: typeof fetch;
  private now: () => number;
  constructor(private options: GitHubAppOptions) {
    this.installationId = options.installationId || '';
    this.request = options.fetch || fetch;
    this.now = options.now || Date.now;
  }
  status() {
    return { ready: !!this.cached && this.cached.expiresAt > this.now(), installationId: this.installationId || null, expiresAt: this.cached?.expiresAt || null };
  }
  invalidate(token: string) { if (this.cached?.token === token) this.cached = null; }
  getToken(signal?: AbortSignal): Promise<string> {
    if (this.cached && this.cached.expiresAt > this.now() + 5 * 60_000) return Promise.resolve(this.cached.token);
    if (this.pending) return this.pending;
    this.pending = this.refresh(signal).finally(() => { this.pending = null; });
    return this.pending;
  }
  private async appRequest(route: string, jwt: string, signal?: AbortSignal, body?: object) {
    const response = await this.request(`https://api.github.com${route}`, {
      method: body ? 'POST' : 'GET', redirect: 'error',
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json', 'User-Agent': 'DevLoot-Trend-Collector', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      const reset = response.headers.get('x-ratelimit-remaining') === '0' ? Number(response.headers.get('x-ratelimit-reset') || 0) * 1000 : 0;
      const retry = response.headers.get('retry-after');
      const retryAt = retry ? (/^\d+$/.test(retry) ? this.now() + Number(retry) * 1000 : Date.parse(retry)) : 0;
      const waitUntil = Math.max(reset, Number.isFinite(retryAt) ? retryAt : 0);
      // Never forward provider bodies, request headers, JWTs, or key material to logs/UI.
      throw new GitHubAuthError(response.status === 401 ? 'GitHub rejected the App credentials. Check the client ID and private key.' : response.status === 404 ? 'GitHub App installation was not found. Check that the App is installed and the installation ID is correct.' : `GitHub App authentication failed (${response.status}). The collector will retry automatically.`, waitUntil);
    }
    return response.json();
  }
  private async refresh(signal?: AbortSignal): Promise<string> {
    const { clientId, privateKeyPath, privateKeyPem } = this.options;
    if (!clientId || (!privateKeyPem && !privateKeyPath)) throw new GitHubAuthError('Set GITHUB_APP_CLIENT_ID and provide a GitHub App private key.');
    let key;
    try {
      const material = privateKeyPem || (privateKeyPath && await readFile(privateKeyPath));
      if (!material) throw new Error('Missing key');
      key = createPrivateKey(material);
      if (key.asymmetricKeyType !== 'rsa') throw new Error('Unsupported key');
    } catch {
      throw new GitHubAuthError(privateKeyPem
        ? 'Cannot read the GitHub App RSA private key. Check GITHUB_APP_PRIVATE_KEY for a complete PEM.'
        : 'Cannot read the GitHub App RSA private key. Check GITHUB_APP_PRIVATE_KEY_PATH and file permissions.');
    }
    signal?.throwIfAborted();
    const seconds = Math.floor(this.now() / 1000);
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const input = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: seconds - 60, exp: seconds + 540, iss: clientId })}`;
    const jwt = `${input}.${sign('RSA-SHA256', Buffer.from(input), key).toString('base64url')}`;
    if (!this.installationId) {
      const installations = await this.appRequest('/app/installations?per_page=100', jwt, signal);
      if (!Array.isArray(installations)) throw new GitHubAuthError('GitHub returned an unexpected installation response.');
      const active = installations.filter(i => !i.suspended_at);
      if (!active.length) throw new GitHubAuthError('Install the GitHub App on your account or organization to enable tracking. The collector will detect it automatically on a retry.');
      if (active.length !== 1 || installations.length >= 100) throw new GitHubAuthError('This GitHub App has multiple installations. Set GITHUB_APP_INSTALLATION_ID to choose the intended account.');
      this.installationId = String(active[0].id);
    }
    if (!/^\d+$/.test(this.installationId)) throw new GitHubAuthError('GITHUB_APP_INSTALLATION_ID must be a numeric installation ID.');
    const result = await this.appRequest(`/app/installations/${this.installationId}/access_tokens`, jwt, signal, { permissions: {} });
    const expiresAt = Date.parse(result.expires_at);
    if (typeof result.token !== 'string' || !result.token || !Number.isFinite(expiresAt) || expiresAt <= this.now() + 5 * 60_000) throw new GitHubAuthError('GitHub returned an invalid or expiring installation token.');
    this.cached = { token: result.token, expiresAt };
    return result.token;
  }
}
