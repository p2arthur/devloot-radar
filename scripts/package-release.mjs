import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const artifact='artifacts/devloot-radar-monorepo.tar.gz';
await mkdir('artifacts/qa',{recursive:true});
const files=['client/dist','client/package.json','server/src','server/package.json','shared','package.json','package-lock.json','.nvmrc','.env.example','.env.collector.example','README.md','docs'];
const packed=spawnSync('tar',['-czf',artifact,...files],{stdio:'inherit',env:{...process.env,COPYFILE_DISABLE:'1'}});
if(packed.status!==0)throw Error('Packaging failed');
const content=await readFile(artifact);const sha256=createHash('sha256').update(content).digest('hex');
await writeFile(artifact+'.sha256',`${sha256}  devloot-radar-monorepo.tar.gz\n`);
const sizes=[];for(const name of await readdir('client/dist/assets'))if(/\.(js|css)$/.test(name)){const data=await readFile('client/dist/assets/'+name);sizes.push({name,bytes:data.length,gzipBytes:gzipSync(data).length});}
await writeFile('artifacts/qa/build-sizes.json',JSON.stringify(sizes,null,2)+'\n');
console.log(JSON.stringify({artifact:resolve(artifact),bytes:content.length,sha256},null,2));
