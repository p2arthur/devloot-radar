import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, test, vi } from 'vitest';
import { createTrendService } from '../../src/collector/trend-service';
const token='history_test_only_012345678901234567890123456789';
test('history is authenticated, read-only, bounded, and checks current eligibility',async()=>{
 const data=await mkdtemp(path.join(os.tmpdir(),'radar-history-'));
 const service=createTrendService({token,data,fetch:vi.fn()});const {app,collector}=service;
 const now=Date.now();const headers={authorization:`Bearer ${token}`};
 try{
  collector.store.put({id:42,fullName:'demo/example',description:'Example',language:'TypeScript',stars:14,forks:2,license:'MIT',topics:[],createdAt:'2026-01-01T00:00:00Z',pushedAt:'2026-01-01T00:00:00Z',firstSeen:now-100000,lastSeen:now,checkedAt:now,source:'test',saved:false,dismissed:false});
  const points=[{at:now-3_600_000,stars:12,forks:1},{at:now-1000,stars:14,forks:2}];
  for(const point of [...points,{at:now-25*3_600_000,stars:8,forks:0},{at:now+3_600_000,stars:15,forks:3}])collector.store.snapshot(42,point);
  expect((await app.inject('/api/trends/42/history?window=24h')).statusCode).toBe(401);
  expect((await app.inject({url:'/api/trends/42/history?window=24h',headers:{authorization:'Bearer wrong'}})).statusCode).toBe(401);
  const good=await app.inject({url:'/api/trends/42/history?window=24h',headers});expect(good.statusCode).toBe(200);expect(good.headers['cache-control']).toBe('no-store');expect(good.json()).toEqual({repositoryId:42,window:'24h',points});
  for(const url of ['/api/trends/42/history?window=30d','/api/trends/42/history','/api/trends/0/history?window=24h','/api/trends/9007199254740992/history?window=24h','/api/trends/1.5/history?window=24h'])expect((await app.inject({url,headers})).statusCode).toBe(400);
  expect((await app.inject({url:'/api/trends/999/history?window=24h',headers})).statusCode).toBe(404);
  collector.store.put({...collector.store.get(42)!,dismissed:true});expect((await app.inject({url:'/api/trends/42/history?window=24h',headers})).statusCode).toBe(404);
  expect(collector.store.history(42,now)).toHaveLength(4);
 }finally{await app.close();await rm(data,{recursive:true,force:true});}
});

test('seven-day reads preserve exact retained samples without changing scoring history or stored data', async () => {
 const data=await mkdtemp(path.join(os.tmpdir(),'radar-week-'));
 const {app,collector}=createTrendService({token,data,fetch:vi.fn()});
 const now=Date.now();vi.spyOn(Date,'now').mockReturnValue(now);
 const headers={authorization:`Bearer ${token}`};
 try {
  collector.store.put({id:42,fullName:'demo/week',description:'Example',language:null,stars:20,forks:2,license:'MIT',topics:[],createdAt:'2026-01-01T00:00:00Z',pushedAt:'2026-01-01T00:00:00Z',firstSeen:now-8*86400000,lastSeen:now,checkedAt:now,source:'test',saved:false,dismissed:false});
  const points=[{at:now-7*86400000,stars:10,forks:1},{at:now-3*86400000,stars:15,forks:1},{at:now-86400000,stars:18,forks:2},{at:now-1000,stars:20,forks:2}];
  for(const point of [...points,{at:now-7*86400000-1,stars:9,forks:1},{at:now+1,stars:21,forks:2}].reverse())collector.store.snapshot(42,point);
  const before=collector.store.db.prepare('SELECT * FROM trend_snapshots ORDER BY at').all();
  expect((await app.inject('/api/trends/42/history?window=7d')).statusCode).toBe(401);
  const week=await app.inject({url:'/api/trends/42/history?window=7d',headers});
  expect(week.statusCode).toBe(200);expect(week.json()).toEqual({repositoryId:42,window:'7d',points});
  const day=await app.inject({url:'/api/trends/42/history?window=24h',headers});
  expect(day.json().points).toEqual(points.slice(2));
  expect(collector.store.history(42,now).every(p=>p.at>=now-26*3600000)).toBe(true);
  expect(collector.store.db.prepare('SELECT * FROM trend_snapshots ORDER BY at').all()).toEqual(before);
  expect((await app.inject({url:'/api/trends/999/history?window=7d',headers})).statusCode).toBe(404);
  collector.store.put({...collector.store.get(42)!,dismissed:true});
  expect((await app.inject({url:'/api/trends/42/history?window=7d',headers})).statusCode).toBe(404);
 } finally {vi.restoreAllMocks();await app.close();await rm(data,{recursive:true,force:true});}
});
