import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {test,expect,vi} from "vitest";
import {createTrendService} from "../../src/collector/trend-service";
import {createCatalogReader,collectorOrigin} from "../../src/catalog";
import {createHistoryReader} from "../../src/history";
import {createApp} from "../../src/app";
import {readConfig} from "../../src/config";
const token="test_only_monorepo_012345678901234567890123456789";
test("the local collector and public adapter serve catalog and exact history without exposing write routes",async()=>{
 const data=await mkdtemp(join(tmpdir(),"radar-monorepo-"));const request=vi.fn();
 const {app:engine,collector}=createTrendService({token,data,fetch:request});
 const now=Date.now();
 const repo={id:42,fullName:"example/repo",description:"Test",language:"TypeScript",stars:14,forks:2,license:"MIT",topics:[],createdAt:"2026-01-01T00:00:00Z",pushedAt:"2026-01-01T00:00:00Z",firstSeen:now-7*86400000,lastSeen:now,checkedAt:now,source:"test",saved:true,dismissed:false};
 const points=[{at:now-3*86400000,stars:8,forks:1},{at:now-1000,stars:14,forks:2}];
 collector.store.put(repo);for(const point of points)collector.store.snapshot(42,point);
 const address=await engine.listen({host:"127.0.0.1",port:0});
 const api=createApp(createCatalogReader(address,token,fetch,Date.now,true),createHistoryReader(address,token,fetch,Date.now,true));
 try {
  expect((await engine.inject("/api/trends")).statusCode).toBe(401);
  const response=await api.inject("/api/v1/catalog");expect(response.statusCode).toBe(200);
  expect(response.json().mode).toBe("live");expect(response.json().items[0].fullName).toBe(repo.fullName);
  expect(response.body).not.toMatch(/saved|dismissed|projectId|test_only_monorepo/);
  expect((await api.inject("/api/v1/repos/42/history?window=7d")).json().points).toEqual(points);
  expect((await api.inject("/api/v1/repos/42/history?window=24h")).json().points).toEqual(points.slice(1));
  for(const [method,url] of [["POST","/api/trends/scan"],["PUT","/api/trends/collector"],["PATCH","/api/trends/42"]] as const){
   expect((await engine.inject({method,url,headers:{authorization:`Bearer ${token}`},payload:{saved:true,paused:true}})).statusCode).toBe(404);
   expect((await api.inject({method,url})).statusCode).toBe(404);
  }
  expect(request).not.toHaveBeenCalled();
 }finally{await api.close();await engine.close();await rm(data,{recursive:true,force:true});}
});
test("HTTP collector transport is opt-in, loopback-only and unavailable in production",()=>{
 expect(()=>collectorOrigin("http://127.0.0.1:4332",token)).toThrow();
 expect(collectorOrigin("http://127.0.0.1:4332",token,true).hostname).toBe("127.0.0.1");
 for(const origin of ["http://collector.example","http://192.168.1.1","http://127.0.0.1:4332/path","http://user:secret@127.0.0.1:4332"])
  expect(()=>collectorOrigin(origin,token,true)).toThrow();
 expect(()=>readConfig({NODE_ENV:"production",DATA_MODE:"live",ALLOW_LOCAL_COLLECTOR:"true",TRENDS_REMOTE_URL:"http://127.0.0.1:4332",TRENDS_API_TOKEN:token,PUBLIC_ORIGIN:"https://radar.example"})).toThrow();
});
