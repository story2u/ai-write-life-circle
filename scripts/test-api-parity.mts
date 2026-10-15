/** Differential oracle: actual Node handler over HTTP versus independently compiled Go. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, readFile, cp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApiHandler, type ApiActor } from '../apps/api/src/http.js'

const repo = fileURLToPath(new URL('..', import.meta.url))
const goRoot = join(repo, 'apps/api-go')
const binary = join(goRoot, 'dist/parity-server')
const built = spawnSync('go', ['build', '-tags=parity', '-o', binary, './cmd/parity'], { cwd: goRoot, stdio: 'inherit' })
assert.equal(built.status, 0)
const temp = await mkdtemp(join(tmpdir(), 'writer-go-parity-'))
const harness = join(temp, 'harness')
await mkdir(join(harness, 'manuscript'), { recursive: true })
await mkdir(join(harness, 'book'), { recursive: true })
await mkdir(join(harness, 'inbox'), { recursive: true })
const body = 'Fixture 😀中文\r\n\r\n> quote & < >\r\n\r\n- item  \r\nline\\\r\n\r\n\ufeff\u0085 tail  \r\n'
const header = '# Test chapter\r\nID: CH-001\r\nvolumeId: VOL-01\r\norder: 2\r\nmeta: Fixture\r\n\r\n'
const chapterFile = join(harness, 'manuscript/CH-001.md')
await writeFile(chapterFile, header + body)
await writeFile(join(harness, 'manuscript/CH-002.md'), '# Second\nID: CH-002\nvolumeId: VOL-01\norder: 1\n\nSecond fixture.\n')
await writeFile(join(harness, 'book/WORLD-001.md'), '# World\nID: WORLD-001\nsource: inbox/source.md#SRC-1\nrelated: CH-001, CH-002\nstatus: confirmed（部分）\n\n## Rule\n\nunknown\n')
await writeFile(join(harness, 'inbox/source.md'), '# Source\n\nReference only.\n')
let goProcesses: ReturnType<typeof spawn>[] = []
let servers: ReturnType<typeof createServer>[] = []
let checks = 0
async function nodeServer(state: string, environment: 'development' | 'test' = 'development') {
 const handler = createApiHandler({ harnessRoot: harness, projectId: 'parity/中文', stateDirectory: state, environment, resolveActor: async (r) => r.headers.get('x-parity-role') === 'none' ? null : ({ id: 'local-author', role: (r.headers.get('x-parity-role') || 'author') as ApiActor['role'] }) })
 const server = createServer(async (incoming, outgoing) => {
  const chunks: Buffer[] = []; for await (const chunk of incoming) chunks.push(Buffer.from(chunk))
  const request = new Request(`http://localhost${incoming.url}`, { method: incoming.method, headers: incoming.headers as Record<string, string>, ...(!['GET', 'HEAD'].includes(incoming.method!) ? { body: Buffer.concat(chunks) } : {}) })
  const response = await handler(request); outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(Buffer.from(await response.arrayBuffer()))
 }); servers.push(server); await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));return `http://127.0.0.1:${(server.address() as {port:number}).port}`
}
async function goServer(state: string, environment = 'development') {
 const child = spawn(binary, [], { env: { ...process.env, NODE_ENV: 'development', WRITER_AGENT_ENV: environment, WRITER_AGENT_STATE_DIR: state, WRITER_AGENT_HARNESS_ROOT: harness, WRITER_AGENT_PROJECT_ID: 'parity/中文' }, stdio: ['ignore','pipe','pipe'] }); goProcesses.push(child)
 return await new Promise<string>((res,rej) => {let output='';const timer=setTimeout(()=>rej(new Error(output)),15000);child.stderr!.on('data',c=>{output+=c});child.stdout!.on('data',c=>{output+=c;const m=output.match(/PARITY_PORT=(\d+)/);if(m){clearTimeout(timer);res(`http://127.0.0.1:${m[1]}`)}});child.on('error',rej);child.once('exit',code=>{clearTimeout(timer);rej(new Error(`Go parity exited ${code}: ${output}`))})})
}
async function stopAll(){for(const s of servers)await new Promise<void>(r=>s.close(()=>r()));servers=[];for(const p of goProcesses){if(p.exitCode===null){const exit=new Promise(r=>p.once('exit',r));p.kill('SIGTERM');await exit}}goProcesses=[]}
const prefix='/v1/projects/'+encodeURIComponent('parity/中文')
const aliases = [new Map<string,string>(), new Map<string,string>()]
function normalize(value: unknown, side: number, key = ""): unknown {
 if(typeof value === 'string') { if (['at','createdAt','updatedAt'].includes(key) && /^\d{4}-\d\d-\d\dT\d\d:\d\d.*Z$/.test(value)) return '<timestamp>'; if(/^(draft:)?[a-f0-9]{8}-[a-f0-9-]{27}$/.test(value)){if(!aliases[side].has(value))aliases[side].set(value,`<random-${aliases[side].size}>`);return aliases[side].get(value)};let result=value;for(const [id,alias]of aliases[side])result=result.replaceAll(id,alias);return result }
 if(Array.isArray(value))return value.map(v=>normalize(v,side))
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,normalize((value as Record<string,unknown>)[k],side,k)]))
 return value
}
async function request(base:string,path:string,method='GET',body?:unknown,headers:Record<string,string>={},raw=false){const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...headers},...(body===undefined?{}:{body:raw?String(body):JSON.stringify(body)})});return {status:r.status,headers:Object.fromEntries(['content-type','cache-control','x-request-id','etag'].filter(k=>r.headers.has(k)).map(k=>[k,r.headers.get(k)])),body:await r.json() as any}}
const nodeState=join(temp,'node'),goState=join(temp,'go')
let node=await nodeServer(nodeState),go=await goServer(goState)
async function pair(label:string,path:string|[string,string],method='GET',b?:unknown,headers:Record<string,string>={},expected?:number,raw=false){
 const twin=b as {node?:unknown,go?:unknown}|null;const bodies=twin&&typeof twin==='object'&&'node'in twin&&'go'in twin?[twin.node,twin.go]:[b,b];const paths=Array.isArray(path)?path:[path,path];const n=await request(node,paths[0],method,bodies[0],headers,raw),g=await request(go,paths[1],method,bodies[1],headers,raw)
 assert.deepEqual(normalize(g,1),normalize(n,0),label);if(expected!==undefined)assert.equal(n.status,expected,label);checks++;return [n.body,g.body]
}
const noteInput={content:'Note 😀 <>&\u2028\u2029 " \\ \n\uD800 end\uDC00',chapterId:'CH-001',purpose:'note'}
try {
 await pair('health','/healthz');await pair('unknown','/unknown', 'GET',undefined,{},404)
 await pair('wrong project','/v1/projects/other/notes','GET',undefined,{},404)
 await pair('bad UTF-8 project','/v1/projects/%FF/workspace','GET',undefined,{},400)
 await pair('workspace initial',prefix+'/workspace')
 await pair('workspace patch',prefix+'/workspace','PATCH',{theme:'dark',lastView:'kb',layout:{focus:true,unknown:1},kbRecent:['a'],currentBranchBySession:{'session':'branch'},unknown:'stripped'}, {},200)
 await pair('workspace merge',prefix+'/workspace','PATCH',{layout:{rightOpen:true}}, {},200)
 for(const invalid of [null,[],{theme:null},{layout:null},{layout:{leftW:199}},{kbRecent:['a','b','c','d','e','f','g']},{currentBranchBySession:{a:1}}])await pair('invalid workspace',prefix+'/workspace','PATCH',invalid,{},422)
 for(const role of ['none','agent','system'])for(const route of ['/workspace','/notes','/chapters/CH-001/revisions'])await pair(`role ${role} ${route}`,prefix+route,'GET',undefined,{'x-parity-role':role},role==='none'?401:403)
 await pair('agent chapter list',prefix+'/chapters','GET',undefined,{'x-parity-role':'agent'},200)
 await pair('diagnostic','/internal/projects/'+encodeURIComponent('parity/中文')+'/harness-projection')
 await pair('chapter list',prefix+'/chapters')
 let [nd,gd]=await pair('chapter detail',prefix+'/chapters/CH-001');assert.equal(nd.headRevision.markdown,body);assert.equal(gd.headRevision.contentHash,nd.headRevision.contentHash)
 await pair('chapter history initial',prefix+'/chapters/CH-001/revisions?limit=0x10&cursor=0e1')
 for(const query of ['limit=0','limit=201','cursor=-1','limit=1.5','cursor=nope','limit=1_0','cursor=0x%2B10'])await pair('invalid page',prefix+'/chapters/CH-001/revisions?'+query,'GET',undefined,{},422)
 const original=[nd.headRevision.revisionId,gd.headRevision.revisionId]
 const revisionPath=prefix+'/chapters/CH-001/revisions';const payloads=(bases:string[],markdown:string)=>({node:{baseRevisionId:bases[0],markdown,trigger:'manual'},go:{baseRevisionId:bases[1],markdown,trigger:'manual'}})
 const saveHeaders=(key:string)=>({'Idempotency-Key':key,'x-request-id':'parity-save'})
 await pair('agent denied save',revisionPath,'POST',payloads(original,body),{...saveHeaders('denied'),'x-parity-role':'agent'},403)
 await pair('no-op',revisionPath,'POST',payloads(original,body),saveHeaders('noop'),200)
 await pair('no-op replay',revisionPath,'POST',payloads(original,body),saveHeaders('noop'),200)
 await pair('no-op reuse',revisionPath,'POST',payloads(original,'different'),saveHeaders('noop'),422)
 await pair('invalid revision',revisionPath,'POST',{markdown:'body'},saveHeaders('invalid'),422)
 await pair('invalid JSON',revisionPath,'POST','{"markdown":',saveHeaders('json'),422,true)
 await pair('bad key',revisionPath,'POST',payloads(original,body),saveHeaders('x'.repeat(129)),422)
 const draft='Draft 😀\r\n\r\n> data  \r\n\u0085\ufeff\u2028<>&';const [nr,gr]=await pair('save',revisionPath,'POST',payloads(original,draft),saveHeaders('draft'),201)
 await pair('save replay',revisionPath,'POST',payloads(original,draft),saveHeaders('draft'),200)
 await pair('key reuse changed base',revisionPath,'POST',payloads([nr.revisionId,gr.revisionId],draft),saveHeaders('draft'),422)
 await pair('stale',revisionPath,'POST',payloads(original,'stale'),saveHeaders('stale'),409)
 await pair('history',revisionPath+'?limit=1')
 await writeFile(chapterFile,header+draft)
 const [adoptedN,adoptedG]=await pair('source adopted',prefix+'/chapters/CH-001')
 await pair('history adopted',revisionPath)
 const [n2,g2]=await pair('save after adoption',revisionPath,'POST',payloads([adoptedN.headRevision.revisionId,adoptedG.headRevision.revisionId],'After adoption'),saveHeaders('after'),201)
 await pair('lineage after adoption',revisionPath)
 await writeFile(chapterFile,header+'divergent source')
 await pair('divergent read',prefix+'/chapters/CH-001','GET',undefined,{},409)
 await pair('divergent save',revisionPath,'POST',payloads([n2.revisionId,g2.revisionId],'attempt'),saveHeaders('diverge'),409)
 await writeFile(chapterFile,header+draft)
 const [nn,gn]=await pair('note create',prefix+'/notes','POST',noteInput,{'Idempotency-Key':'note'},201)
 await pair('note detail',[prefix+'/notes/'+nn.noteId,prefix+'/notes/'+gn.noteId])
 await pair('note replay',prefix+'/notes','POST',noteInput,{'Idempotency-Key':'note'},201)
 await pair('note reused',prefix+'/notes','POST',{...noteInput,content:'changed'},{'Idempotency-Key':'note'},422)
 await pair('notes list',prefix+'/notes')
 const paths:[string,string]=[prefix+'/notes/'+nn.noteId,prefix+'/notes/'+gn.noteId]
 const updated={...noteInput,content:'Updated',baseVersion:1,status:'archived'}
 await pair('note archive',paths,'PATCH',updated,{'Idempotency-Key':'archive'},200)
 await pair('note replay update',paths,'PATCH',updated,{'Idempotency-Key':'archive'},200)
 await pair('note stale',paths,'PATCH',updated,{'Idempotency-Key':'stale-note'},409)
 await pair('note restore',paths,'PATCH',{...updated,baseVersion:2,status:'active'},{'Idempotency-Key':'restore'},200)
 await pair('plan',prefix+'/notes','POST',{content:'Plan',purpose:'next_writing'},{'Idempotency-Key':'plan'},201)
 await pair('plan uniqueness',prefix+'/notes','POST',{content:'Second plan',purpose:'next_writing'},{'Idempotency-Key':'plan2'},409)
 for(const input of [null,[],{content:' '},{content:'a',canon:true},{content:'x'.repeat(20001)},{content:'😀'.repeat(20001)},{content:'a',chapterId:''},{content:'a',purpose:null}])await pair('invalid note',prefix+'/notes','POST',input,{'Idempotency-Key':'bad'},422)
 await pair('note chapter missing',prefix+'/notes','POST',{content:'n',chapterId:'CH-404'},{'Idempotency-Key':'missing'},404)
 await pair('missing note',prefix+'/notes/missing','GET',undefined,{},404)
 await pair('unsupported note method',prefix+'/notes','DELETE',undefined,{},405)
 await pair('note invalid JSON',prefix+'/notes','POST','{bad',{'Idempotency-Key':'bad-json'},422,true)
 await pair('body bounded',prefix+'/notes','POST',{content:'x'.repeat(32*1024*1024+1)},{'Idempotency-Key':'large'},422)
 // Compare audit fields, correlations and failure classification; only random values are normalized.
 const auditN=(await readFile(join(nodeState,'audit.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line))
 const auditG=(await readFile(join(goState,'audit.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line))
 assert.deepEqual(normalize(auditG,1),normalize(auditN,0),'chapter audit parity');checks++
 // Invalid Harness fixtures are never silently accepted.
 await writeFile(chapterFile,(header+draft).replace('order: 2','order: 0'))
 await pair('invalid chapter order',prefix+'/chapters','GET',undefined,{},422)
 await writeFile(chapterFile,header+draft)
 await writeFile(join(harness,'manuscript/CH-001-copy.md'),header+draft)
 await pair('duplicate chapter',prefix+'/chapters','GET',undefined,{},409)
 await rm(join(harness,'manuscript/CH-001-copy.md'))
 await stopAll();node=await nodeServer(nodeState,'test');go=await goServer(goState,'test')
 await pair('diagnostic closed outside development','/internal/projects/'+encodeURIComponent('parity/中文')+'/harness-projection','GET',undefined,{},404)
 await pair('restart workspace',prefix+'/workspace')
 await pair('restart note',paths)
 await stopAll()
 // Real legacy data test. A fresh Node writes state, then stops before Go touches its copy.
 const legacy=join(temp,'legacy');node=await nodeServer(legacy)
 const initial=await request(node,prefix+'/chapters/CH-002');const base=initial.body.headRevision.revisionId
 const legacyNoteInput={content:'Legacy 😀\n<>&\u2028\u2029\uD800',chapterId:null,purpose:'note'}
 const legacyNote=await request(node,prefix+'/notes','POST',legacyNoteInput,{'Idempotency-Key':'legacy-create'})
 await request(node,prefix+'/workspace','PATCH',{theme:'dark',layout:{focus:true}})
 const oldDraft=await request(node,prefix+'/chapters/CH-002/revisions','POST',{baseRevisionId:base,markdown:'Legacy draft 😀'},saveHeaders('legacy-draft'))
 await request(node,prefix+'/chapters/CH-002/revisions','POST',{baseRevisionId:oldDraft.body.revisionId,markdown:'Legacy draft 😀'},saveHeaders('legacy-noop'))
 await stopAll();const migrated=join(temp,'migrated');await cp(legacy,migrated,{recursive:true});go=await goServer(migrated)
 const inherited=await request(go,prefix+'/chapters/CH-002');assert.equal(inherited.body.headRevision.revisionId,oldDraft.body.revisionId)
 assert.deepEqual((await request(go,prefix+'/notes','POST',legacyNoteInput,{'Idempotency-Key':'legacy-create'})).body,legacyNote.body)
 assert.equal((await request(go,prefix+'/chapters/CH-002/revisions','POST',{baseRevisionId:base,markdown:'Legacy draft 😀'},saveHeaders('legacy-draft'))).body.revisionId,oldDraft.body.revisionId)
 assert.equal((await request(go,prefix+'/chapters/CH-002/revisions','POST',{baseRevisionId:oldDraft.body.revisionId,markdown:'Legacy draft 😀'},saveHeaders('legacy-noop'))).status,200)
 const edit={...legacyNoteInput,content:'Go edited legacy note',baseVersion:1,status:'archived'}
 const changed=await request(go,prefix+'/notes/'+legacyNote.body.noteId,'PATCH',edit,{'Idempotency-Key':'go-update'});assert.equal(changed.status,200)
 const goDraft=await request(go,prefix+'/chapters/CH-002/revisions','POST',{baseRevisionId:oldDraft.body.revisionId,markdown:'Go draft after legacy'},saveHeaders('go-draft'));assert.equal(goDraft.status,201)
 await stopAll();go=await goServer(migrated)
 assert.deepEqual((await request(go,prefix+'/notes/'+legacyNote.body.noteId)).body,changed.body)
 assert.equal((await request(go,prefix+'/chapters/CH-002')).body.headRevision.revisionId,goDraft.body.revisionId)
 assert.deepEqual((await request(go,prefix+'/notes/'+legacyNote.body.noteId,'PATCH',edit,{'Idempotency-Key':'go-update'})).body,changed.body)
 await stopAll();node=await nodeServer(migrated)
 assert.deepEqual((await request(node,prefix+'/notes/'+legacyNote.body.noteId,'PATCH',edit,{'Idempotency-Key':'go-update'})).body,changed.body)
 assert.equal((await request(node,prefix+'/chapters/CH-002')).body.headRevision.revisionId,goDraft.body.revisionId)
 assert.equal((await request(node,prefix+'/chapters/CH-002/revisions','POST',{baseRevisionId:oldDraft.body.revisionId,markdown:'Go draft after legacy'},saveHeaders('go-draft'))).body.revisionId,goDraft.body.revisionId)
 checks+=12
 assert.equal(await readFile(chapterFile,'utf8'),header+draft)
 console.log(JSON.stringify({checks,legacyDataRead:true,goRestart:true,nodeRollbackRead:true,bodyHashStable:true},null,2))
} finally {await stopAll();await rm(temp,{recursive:true,force:true})}
