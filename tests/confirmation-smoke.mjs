import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {chromium} from 'playwright';

const base='http://127.0.0.1:8979';
const server=spawn('python3',['-m','http.server','8979','--bind','127.0.0.1'],{stdio:'ignore'});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const token='a'.repeat(48),uuid='33333333-3333-4333-8333-333333333333';
const userId='77777777-7777-4777-8777-777777777777';
const row={_id:'test-order',order:'測試訂製桌',client:'客戶甲',total:32000,paid:0,due:'2030-02-01',approved:'否',_updated:'2030-01-01T00:00:00.000Z'};
let status='pending',record=null,invalidGuestCalls=0;
try{
 let ready=false;
 for(let i=0;i<35;i++){try{if((await fetch(base+'/')).ok){ready=true;break}}catch{}await sleep(150)}
 assert.ok(ready,'confirmation site server starts');
 const context=await browser.newContext();
 await context.route('https://unapiwajmgqqtdkixaab.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
  const reply=(body,code=200)=>route.fulfill({status:code,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify(body)});
  if(method==='OPTIONS')return reply({});
  if(path==='/auth/v1/user')return reply({id:userId,email:'synthetic@example.invalid'});
  if(path==='/rest/v1/rpc/chance_create_order_confirmation'){
   if(!req.headers().authorization)return reply({message:'Authentication required'},401);
   const data=req.postDataJSON();assert.equal(data.p_record_id,row._id);assert.ok(data.p_specs.length>=10);
   record={id:uuid,record_id:row._id,status:'pending',snapshot:{order:data.p_order,client:data.p_client,total:data.p_total,specs:data.p_specs},
    response_note:'',created_at:'2026-11-04T09:00:00Z',expires_at:'2030-01-01T00:00:00Z',responded_at:null};
   status='pending';
   return reply({ok:true,token,id:uuid,expires_at:record.expires_at});
  }
  if(path==='/rest/v1/chance_order_confirmations')return reply(record?[{...record,status}]:[]);
  if(path==='/rest/v1/rpc/chance_order_confirmation_preview'){
   assert.ok(!req.headers().authorization,'guest preview uses no owner token');
   const t=req.postDataJSON().p_token;
   if(t!==token||!record){invalidGuestCalls++;return reply({ok:false,status:'invalid'})}
   return reply({ok:true,status,snapshot:record.snapshot,expires_at:record.expires_at});
  }
  if(path==='/rest/v1/rpc/chance_order_confirmation_reply'){
   assert.ok(!req.headers().authorization,'guest reply uses no owner token');
   const body=req.postDataJSON();
   if(body.p_token!==token||status!=='pending')return reply({ok:false,status:'expired_or_used'});
   status=body.p_decision;return reply({ok:true,status});
  }
  if(path==='/rest/v1/rpc/chance_revoke_order_confirmation'){status='revoked';return reply(true)}
  if(path==='/rest/v1/chance_documents'||path==='/rest/v1/chance_support_tickets'||path==='/rest/v1/chance_support_replies'||path==='/rest/v1/chance_audit_events'||path==='/rest/v1/chance_entitlements'||path==='/rest/v1/chance_evidence_files')return reply([]);
  throw Error('Unexpected '+method+' '+path);
 });
 const owner=await context.newPage(),errors=[];
 owner.on('pageerror',e=>errors.push('Owner: '+e.message));
 await owner.addInitScript(({userId,row})=>{
  localStorage.setItem('chance.auth.v1',JSON.stringify({access_token:'synthetic-jwt',refresh_token:'synthetic-refresh',user_id:userId,email:'synthetic@example.invalid',expires_at:Math.floor(Date.now()/1000)+3600}));
  localStorage.setItem('chance-products:custom-order-payments:v1',JSON.stringify([row]));
 },{userId,row});
 await owner.goto(base+'/custom-order-payments/',{waitUntil:'load'});
 await owner.waitForFunction(()=>!!window.ChanceLocal&&!!window.ChanceCloudSession&&!!document.querySelector('.chance-order-confirmations'));
 await owner.locator('#chance-confirm-specs').fill('材質為實木，尺寸120×80公分，桌面自然色，交期請依合約');
 owner.once('dialog',d=>d.accept());
 await owner.locator('#chance-confirm-issue').click();
 await owner.waitForFunction(()=>!document.querySelector('#chance-confirm-link-wrap').hidden);
 const link=await owner.locator('#chance-confirm-link').inputValue();
 assert.ok(link.endsWith('/confirm/#'+token),'link carries one-time token only in URL fragment');
 assert.equal(status,'pending');
 const guest=await context.newPage();guest.on('pageerror',e=>errors.push('Guest: '+e.message));
 await guest.goto(link,{waitUntil:'load'});
 await guest.waitForFunction(()=>!document.querySelector('#confirm-details').hidden);
 assert.ok((await guest.locator('#confirm-specs').innerText()).includes('實木'));
 assert.equal(await guest.locator('#confirm-controls').isVisible(),true);
 guest.once('dialog',d=>d.accept());
 await guest.locator('#confirm-accept').click();
 await guest.waitForFunction(()=>document.querySelector('#confirm-outcome').textContent.includes('已記錄'));
 assert.equal(status,'confirmed','customer confirms once through server RPC');
 assert.equal(await guest.locator('#confirm-controls').isVisible(),false,'guest cannot submit twice');
 await owner.locator('#chance-confirm-refresh').click();
 await owner.waitForFunction(()=>document.querySelector('#chance-confirm-list')?.textContent.includes('客戶已確認'));
 owner.once('dialog',d=>d.accept());
 await owner.getByRole('button',{name:'核對後套用至本機訂單'}).click();
 assert.equal((await owner.evaluate(()=>window.ChanceLocal.read()[0])).approved,'是','confirmed owner manually applies to local order');
 const bad=await context.newPage();bad.on('pageerror',e=>errors.push('Bad guest: '+e.message));
 await bad.goto(base+'/confirm/#'+'b'.repeat(48),{waitUntil:'load'});
 await bad.waitForFunction(()=>document.querySelector('#confirm-notice')?.textContent.includes('失效'));
 assert.equal(await bad.locator('#confirm-details').isVisible(),false,'invalid token cannot read order details');
 assert.equal(invalidGuestCalls,1);
 assert.deepEqual(errors,[],'no browser runtime errors');
 console.log('PASS custom order owner invitation, guest approval, no-repeat token, owner apply, invalid-token isolation');
 await context.close();
}finally{await browser.close();server.kill('SIGTERM')}
