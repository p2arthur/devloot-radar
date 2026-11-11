import { createServer } from 'node:net';
import { afterEach, expect, it } from 'vitest';
import { runDev } from './dev.mjs';

const servers = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
});
async function port() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}
const command = source => [process.execPath, '--input-type=module', '-e', source];
const api = command(`import {createServer} from 'node:http'; createServer((req,res) => { res.setHeader('Content-Type','application/json');res.end('{"ok":true}'); }).listen(Number(process.env.PORT),'127.0.0.1');`);

it('waits for API readiness and stops the API when the client fails', async () => {
  const apiPort = await port();
  const clientPort = await port();
  const client = command(`const r=await fetch('http://127.0.0.1:${apiPort}/healthz'); process.exit((await r.json()).ok ? 7 : 8);`);
  expect(await runDev({apiPort,clientPort,apiCommand:api,clientCommand:client,stdio:'ignore'})).toBe(7);
  await expect(fetch(`http://127.0.0.1:${apiPort}/healthz`)).rejects.toThrow();
});

it('returns an API failure without starting the client', async () => {
  const apiPort = await port();
  const clientPort = await port();
  expect(await runDev({apiPort,clientPort,apiCommand:command('process.exit(9)'),clientCommand:command('process.exit(8)'),stdio:'ignore'})).toBe(9);
});

it('times out an API that never becomes ready and cleans it up', async () => {
  expect(await runDev({apiPort:await port(),clientPort:await port(),apiCommand:command('setInterval(()=>{},1000)'),timeoutMs:100,stdio:'ignore'})).toBe(1);
});

it('refuses an occupied port without stopping the existing listener', async () => {
  const server=createServer(); servers.push(server);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const apiPort=server.address().port;
  await expect(runDev({apiPort,clientPort:await port(),stdio:'ignore'})).rejects.toThrow('already in use');
  expect(server.listening).toBe(true);
});
