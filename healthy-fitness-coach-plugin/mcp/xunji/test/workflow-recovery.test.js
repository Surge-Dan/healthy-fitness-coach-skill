 'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createTrainingService } = require('../src/server.js');
const { OperationStore } = require('../src/operation-store.js');
const records = ['2026-10-20,id:1,胸部训练,1.卧推,1组,60kg,10次,source:xunji'];
function cache() { const m=new Map(); return {async get(d){return m.get(d);},async set(d,v){m.set(d,v);}}; }
function fixture(options={}) {
 let clock=Date.parse('2026-10-21T01:00:00Z'), calls=0, reads=0;
 const service=createTrainingService({cache:cache(),credentialProvider:async()=>'SYNTHETIC_ACCOUNT_A',now:()=>clock,today:()=> '2026-10-21',client:{async fetchDay(){reads++;return {records};},async upsertRecords(){calls++;return {records};}},...options});
 return {service,advance(ms){clock+=ms;},get calls(){return calls;},get reads(){return reads;}};
}
async function submit(service, data=records) {const preview=await service.previewTrainingUpsert({records:data});return service.upsertTrainingRecords({records:data,confirm:true,preview_id:preview.preview_id});}
test('write requires matching preview; changed data and expired previews never reach network', async()=>{
 const f=fixture();
 assert.equal((await f.service.upsertTrainingRecords({records,confirm:true})).error.code,'preview_required');
 const p=await f.service.previewTrainingUpsert({records});
 assert.equal((await f.service.upsertTrainingRecords({records:['2026-10-20,id:2,title'],confirm:true,preview_id:p.preview_id})).error.code,'preview_required');
 f.advance(600001);
 assert.equal((await f.service.upsertTrainingRecords({records,confirm:true,preview_id:p.preview_id})).error.code,'preview_required');assert.equal(f.calls,0);
});
test('two confirmed previews for same batch yield only one network write',async()=>{
 const f=fixture(); const a=await f.service.previewTrainingUpsert({records}),b=await f.service.previewTrainingUpsert({records});
 const results=await Promise.all([a,b].map(p=>f.service.upsertTrainingRecords({records,confirm:true,preview_id:p.preview_id})));
 assert.equal(f.calls,1);assert.ok(results.some(r=>r.outcome==='confirmed'));assert.ok(results.some(r=>r.outcome==='reconciliation_required'));
});
test('confirmed server write remains confirmed after cache failure',async()=>{
 const f=fixture({cache:{async get(){return null;},async set(){throw new Error('disk');}}});
 const r=await submit(f.service);assert.equal(r.outcome,'confirmed');assert.equal(r.cache_saved,false);
 assert.equal((await submit(f.service)).outcome,'reconciliation_required');assert.equal(f.calls,1);
});
test('timeout blocks replay; fresh reconciliation and explicit user resolution permit a new preview',async()=>{
 let calls=0,reads=0;
 const f=fixture({client:{async upsertRecords(){calls++;throw Object.assign(new Error('timeout'),{code:'network_error'});},async fetchDay(){reads++;return {records:[]};}}});
 assert.equal((await submit(f.service)).outcome,'unknown');assert.equal((await submit(f.service)).outcome,'reconciliation_required');assert.equal(calls,1);
 assert.equal((await f.service.reconcileTrainingUpsert({records,confirm_not_applied:true})).outcome,'unknown');
 const proof=await f.service.reconcileTrainingUpsert({records}); assert.equal(reads,1);assert.ok(proof.verification_id);
 assert.equal((await f.service.reconcileTrainingUpsert({records,verification_id:proof.verification_id,confirm_not_applied:true})).outcome,'verified_not_applied');
 assert.equal((await submit(f.service)).outcome,'unknown');assert.equal(calls,2);
});
test('account change invalidates a preview',async()=>{
 let account='SYNTHETIC_A';const f=fixture({credentialProvider:async()=>account});
 const p=await f.service.previewTrainingUpsert({records});account='SYNTHETIC_B';
 assert.equal((await f.service.upsertTrainingRecords({records,confirm:true,preview_id:p.preview_id})).error.code,'preview_required');assert.equal(f.calls,0);
});
test('historical correction can refresh only the requested date and respects throttle',async()=>{
 const f=fixture();await f.service.getTrainingDay({date:'2026-10-20'});f.advance(91000);
 const r=await f.service.getTrainingRange({start_date:'2026-10-20',end_date:'2026-10-20',refresh_dates:['2026-10-20']});
 assert.equal(r.network_fetches,1);assert.equal(f.reads,2);
 assert.equal((await f.service.getTrainingRange({start_date:'2026-10-20',end_date:'2026-10-20',refresh_all:true})).error.code,'rate_limited');
});
test('recent window expires after five minutes without explicit refresh',async()=>{
 const f=fixture();await f.service.getTrainingDay({date:'2026-10-20'});f.advance(300001);
 const r=await f.service.getTrainingDay({date:'2026-10-20'});assert.equal(r.cache_hit,false);assert.equal(f.reads,2);
});
test('durable unknown submission survives service restart without training payload in journal',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'fitness-operations-'));
 try {
  let calls=0;const client={async upsertRecords(){calls++;throw new Error('timeout');}};
  const a=fixture({operationStore:new OperationStore(root),client});await submit(a.service);
  const b=fixture({operationStore:new OperationStore(root),client});assert.equal((await submit(b.service)).outcome,'reconciliation_required');assert.equal(calls,1);
  const files=await fs.readdir(root);const body=await fs.readFile(path.join(root,files[0]),'utf8');assert.equal(body.includes('SYNTHETIC'),false);assert.equal(body.includes('60kg'),false);
 } finally {await fs.rm(root,{recursive:true,force:true});}
});
