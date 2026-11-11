import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { StringDecoder } from 'node:string_decoder';
import { createGunzip } from 'node:zlib';
import { HOUR } from './trend-score';

export interface ArchiveCandidate {
  id: number; fullName: string; actors: number; watchEvents: number; forkEvents: number;
}
export interface ArchiveBatch { hour: number; events: number; candidateCount: number; candidates: ArchiveCandidate[] }
export class ArchiveError extends Error {}

// Leave an hour after the file closes for publication. Resume at the recent hour,
// rather than downloading a backlog after the studio has been offline.
export const archiveHour = (now: number) => Math.floor(now / HOUR) * HOUR - 2 * HOUR;
export function archiveUrl(hour: number) {
  const date = new Date(hour);
  return `https://data.gharchive.org/${date.toISOString().slice(0, 10)}-${date.getUTCHours()}.json.gz`;
}

export async function readArchive(hour: number, request: typeof fetch = fetch, signal?: AbortSignal, known: ReadonlySet<number> = new Set()): Promise<ArchiveBatch> {
  const abort = AbortSignal.any([AbortSignal.timeout(180_000), ...(signal ? [signal] : [])]);
  const response = await request(archiveUrl(hour), {
    headers: { 'User-Agent': 'DevLoot-Trend-Collector', 'Accept-Encoding': 'identity' },
    redirect: 'error', signal: abort,
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new ArchiveError(response.status === 404 ? 'The latest GH Archive file is not published yet.' : `GH Archive is unavailable (${response.status}).`);
  }
  const maxCompressed = 256 * 1024 * 1024, maxExpanded = 2 * 1024 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > maxCompressed) {
    await response.body.cancel();
    throw new ArchiveError('GH Archive exceeded the download limit.');
  }
  let compressed = 0, expanded = 0, events = 0, relevant = 0, pending = '';
  const decoder = new StringDecoder('utf8');
  const repos = new Map<number, ArchiveCandidate & { people: Set<number> }>();
  const seen = new Set<string>();
  function line(text: string) {
    if (!text.trim()) return;
    if (++events > 2_000_000) throw new ArchiveError('GH Archive exceeded the event limit.');
    let event;
    try { event = JSON.parse(text); } catch { throw new ArchiveError('GH Archive contained invalid event data.'); }
    if (!event || !['WatchEvent', 'ForkEvent'].includes(event.type)) return;
    if (event.type === 'WatchEvent' && event.payload?.action !== 'started') return;
    const at = Date.parse(event.created_at);
    if (!Number.isFinite(at) || at < hour || at >= hour + HOUR) return;
    const id = event.repo?.id, name = event.repo?.name, actor = event.actor?.id;
    if (!Number.isSafeInteger(id) || id <= 0 || typeof name !== 'string' || name.length > 200 || !/^[\w.-]+\/[\w.-]+$/.test(name)
      || !Number.isSafeInteger(actor) || actor <= 0 || typeof event.id !== 'string') return;
    if (seen.has(event.id)) return;
    if (++relevant > 250_000) throw new ArchiveError('GH Archive exceeded the candidate event limit.');
    seen.add(event.id);
    let repo = repos.get(id);
    if (!repo) {
      if (repos.size >= 100_000) throw new ArchiveError('GH Archive exceeded the repository limit.');
      repo = { id, fullName: name, actors: 0, watchEvents: 0, forkEvents: 0, people: new Set() };
      repos.set(id, repo);
    }
    repo.fullName = name;
    repo.people.add(actor);
    repo.actors = repo.people.size;
    if (event.type === 'WatchEvent') repo.watchEvents++; else repo.forkEvents++;
  }
  function consume(text: string) {
    pending += text;
    let start = 0, end;
    while ((end = pending.indexOf('\n', start)) !== -1) {
      if (end - start > 4 * 1024 * 1024) throw new ArchiveError('GH Archive exceeded the event size limit.');
      line(pending.slice(start, end)); start = end + 1;
    }
    pending = pending.slice(start);
    if (pending.length > 4 * 1024 * 1024) throw new ArchiveError('GH Archive exceeded the event size limit.');
  }
  await pipeline(
    Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
    new Transform({ transform(chunk, _encoding, callback) {
      compressed += chunk.length;
      callback(compressed > maxCompressed ? new ArchiveError('GH Archive exceeded the download limit.') : null, chunk);
    } }),
    createGunzip(),
    new Writable({ write(chunk, _encoding, callback) {
      try {
        expanded += chunk.length;
        if (expanded > maxExpanded) throw new ArchiveError('GH Archive exceeded the expanded size limit.');
        consume(decoder.write(chunk)); callback();
      } catch (error) { callback(error as Error); }
    }, final(callback) {
      try { consume(decoder.end()); if (pending) line(pending); callback(); }
      catch (error) { callback(error as Error); }
    } }),
    { signal: abort },
  );
  if (!events) throw new ArchiveError('GH Archive contained no events.');
  const candidates = [...repos.values()].filter(repo => repo.actors >= 2)
    .sort((a, b) => b.actors - a.actors || b.watchEvents - a.watchEvents || a.id - b.id);
  return { hour, events, candidateCount: candidates.length, candidates: candidates.filter(repo => !known.has(repo.id)).slice(0, 100).map(({ people: _people, ...repo }) => repo) };
}
