import { createTrendService } from './trend-service';
import { GitHubAppAuth } from './github-auth';

const volume = process.env.RAILWAY_VOLUME_MOUNT_PATH;
if (process.env.RAILWAY_ENVIRONMENT_ID && !volume) throw new Error('Attach a Railway volume before starting the trend collector.');
const port = Number(process.env.PORT || 8080);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
const clientId = process.env.GITHUB_APP_CLIENT_ID?.trim() || '';
const privateKeyPem = process.env.GITHUB_APP_PRIVATE_KEY?.trim();
const githubAuth = clientId || privateKeyPem ? new GitHubAppAuth({
  clientId,
  privateKeyPem,
  installationId: process.env.GITHUB_APP_INSTALLATION_ID?.trim(),
}) : undefined;
const { app, collector } = createTrendService({
  token: process.env.TRENDS_API_TOKEN || '',
  data: volume || process.env.TRENDS_DATA_DIR || './data/hosted-trends',
  githubToken: process.env.GITHUB_TOKEN,
  githubAuth,
  maxRepos: Number(process.env.TRENDS_MAX_REPOS || 300),
  archiveEnabled: process.env.TRENDS_ARCHIVE_ENABLED === 'true',
});
try {
  await app.listen({ host: process.env.HOST || '127.0.0.1', port });
} catch (error) { await app.close(); throw error; }
collector.start();
console.log(`Trend collector listening on port ${port}.`);
async function stop() { await app.close(); }
process.once('SIGINT', () => { void stop(); });
process.once('SIGTERM', () => { void stop(); });
