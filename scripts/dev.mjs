import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));

// Fail before starting either service; never reuse or kill someone else's listener.
async function requireFreePort(port) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', () => reject(new Error(`Port ${port} is already in use. Stop the existing dev server, or use dev:client / dev:api separately.`)));
    server.listen(port, '127.0.0.1', resolve);
  });
  await new Promise(resolve => server.close(resolve));
}

export async function runDev({
  apiPort = 4321,
  clientPort = 4320,
  apiCommand = [process.execPath, resolve(root, 'node_modules/tsx/dist/cli.mjs'), 'watch', '--env-file-if-exists=.env', 'server/src/index.ts'],
  clientCommand = [process.execPath, resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1'],
  timeoutMs = 15_000,
  stdio = 'inherit',
} = {}) {
  await requireFreePort(apiPort);
  await requireFreePort(clientPort);
  const children = [];
  let finish;
  let stopping = false;
  const stopped = new Promise(resolve => { finish = resolve; });
  const stop = code => {
    if (stopping) return;
    stopping = true;
    finish(code);
  };
  const interrupt = () => stop(0);
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  const launch = (command, cwd, env) => {
    const child = spawn(command[0], command.slice(1), {
      cwd, env, stdio, detached: process.platform !== 'win32',
    });
    const exited = new Promise(resolve => {
      child.once('error', () => { stop(1); resolve(); });
      child.once('exit', code => { stop(code || 1); resolve(); });
    });
    children.push({ child, exited });
  };
  const signal = (child, name) => {
    if (!child.pid) return;
    try {
      if (process.platform === 'win32') child.kill(name);
      else process.kill(-child.pid, name);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  };
  try {
    // Only the API loads root .env. No collector process is started here.
    launch(apiCommand, root, { ...process.env, HOST: '127.0.0.1', PORT: String(apiPort) });
    const deadline = Date.now() + timeoutMs;
    let ready = false;
    while (!stopping && Date.now() < deadline) {
      try {
        const response = await fetch(`http://127.0.0.1:${apiPort}/healthz`, { signal: AbortSignal.timeout(500) });
        ready = response.ok && (await response.json()).ok === true;
      } catch { /* The API is still starting. */ }
      if (ready) break;
      await Promise.race([stopped, new Promise(resolve => setTimeout(resolve, 100))]);
    }
    if (!stopping && !ready) {
      console.error('API startup timed out. Check the API error above and server-only .env configuration.');
      stop(1);
    }
    if (!stopping) launch(clientCommand, resolve(root, 'client'), process.env);
    return await stopped;
  } finally {
    for (const { child } of children) signal(child, 'SIGTERM');
    const force = setTimeout(() => {
      for (const { child } of children) signal(child, 'SIGKILL');
    }, 2_000);
    await Promise.all(children.map(({ exited }) => exited));
    clearTimeout(force);
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await runDev(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
