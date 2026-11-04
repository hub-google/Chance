import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const root='http://127.0.0.1:8977';
const server=spawn('python3',['-m','http.server','8977','--bind','127.0.0.1'],{stdio:'ignore'});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const id='00000000-0000-4000-8000-111111111111',email='chance-browser-test@example.invalid';
let doc=null,events=[],tickets=[],replies=[],requests=0;
try{
 let online=false;
 for(let i=0;i<30;i++){try{if((await fetch(root+'/')).ok){online=true;break}}catch{}await sleep(150)}
 assert.ok(online,'local server ready');
 const page=await browser.newPage();
 await page.addInitScript(data=>{
   localStorage.setItem('chance.auth.v1',JSON.stringify({
     access_token:'synthetic-test-token',refresh_token:'synthetic-refresh-token',
     expires_at:Math.floor(Date.now()/1000)+3600,email:data.email,user_id:data.id
   }));
 },{email,id});
 await page.route('https://unapiwajmgqqtdkixaab.supabase.co/**',async route=>{
   requests++;
   const req=route.request(),u=new URL(req.url()),path=u.pathname,method=req.method();
   const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','content-type':'application/json'};
   const reply=(body,status=200)=>route.fulfill({status,headers,body:JSON.stringify(body)});
   if(method==='OPTIONS')return reply({});
   if(path==='/auth/v1/user')return reply({id,email});
   if(path==='/rest/v1/chance_documents'){
     if(method==='GET')return reply(doc?[doc]:[]);
     if(method==='POST'){
       assert.ok(!doc,'create only if missing');
       const body=req.postDataJSON();
       doc={...body,version:1,updated_at:new Date().toISOString()};
       events.unshift({action:'INSERT',document_version:1,record_count:doc.records.length,created_at:new Date().toISOString()});
       return reply({});
     }
     if(method==='PATCH'){
       const expected=Number((u.searchParams.get('version')||'').replace('eq.',''));
       if(!doc||doc.version!==expected)return reply([]);
       const payload=req.postDataJSON();
       doc={...doc,...payload,updated_at:new Date().toISOString()};
       events.unshift({action:'UPDATE',document_version:doc.version,record_count:doc.records.length,created_at:doc.updated_at});
       return reply([doc]);
     }
     if(method==='DELETE'){
       if(doc)events.unshift({action:'DELETE',document_version:doc.version,record_count:doc.records.length,created_at:new Date().toISOString()});
       doc=null;return reply({});
     }
   }
   if(path==='/rest/v1/chance_audit_events'&&method==='GET')return reply(events);
   if(path==='/rest/v1/chance_support_tickets'){
     if(method==='GET')return reply(tickets);
     if(method==='POST'){
       const value=req.postDataJSON();
       tickets.unshift({...value,id:'22222222-2222-4222-8222-222222222222',created_at:new Date().toISOString()});
       return reply({});
     }
   }
   if(path==='/rest/v1/chance_support_replies'&&method==='GET')return reply(replies);
   if(path==='/rest/v1/chance_entitlements'&&method==='GET')return reply([]);
   throw Error('Unexpected external request '+method+' '+u.pathname);
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root+'/invoice-proof/',{waitUntil:'load'});
 await page.waitForFunction(()=>!!document.querySelector('#cloud-user')&&!document.querySelector('#cloud-user').hidden,null,{timeout:10000});
 assert.ok((await page.locator('#chance-entitlement-status').innerText()).includes('未建立付費訂閱'));
 assert.ok(await page.locator('#chance-support-submit').isVisible());
 await page.click('#add');
 const input={project:'測試單據',client:'測試買家',amount:'3000',paid:'1000',due:'2030-01-01',status:'已驗收'};
 for(const [field,value] of Object.entries(input)){
   if(field==='status')await page.locator('#field-'+field).selectOption(value);
   else await page.locator('#field-'+field).fill(value);
 }
 await page.locator('#record-form button[type="submit"]').click();
 assert.equal(await page.locator('#metric-count').innerText(),'1');
 await page.click('#cloud-upload');
 await page.waitForFunction(()=>document.querySelector('#cloud-message')?.textContent.includes('已上傳'),null,{timeout:10000});
 assert.equal(doc?.records?.length,1,'private cloud backup created');
 assert.equal(events.length,1,'cloud insert audited');
 await page.click('#chance-sync-toggle');
 await page.waitForFunction(()=>document.querySelector('#chance-sync-toggle')?.textContent==='關閉自動同步',null,{timeout:10000});
 await page.locator('#records button[data-action="edit"]').click();
 await page.locator('#field-amount').fill('4000');
 await page.locator('#record-form button[type="submit"]').click();
 for(let i=0;i<70&&doc.version<2;i++)await sleep(150);
 assert.equal(doc.version,2,'autosync persisted edit with version increment');
 assert.equal(Number(doc.records[0].amount),4000,'correct record synced');
 await page.locator('#chance-support-subject').fill('測試問題回報');
 await page.locator('#chance-support-description').fill('這是只存在模擬伺服器的測試問題，請不要聯繫。');
 await page.click('#chance-support-submit');
 await page.waitForFunction(()=>document.querySelector('#chance-support-tickets')?.textContent.includes('測試問題回報'),null,{timeout:9000});
 assert.equal(tickets.length,1,'ticket saved in private backend');
 replies.push({ticket_id:tickets[0].id,content:'模擬真人站內回覆',created_at:new Date().toISOString()});
 await page.click('#chance-support-refresh');
 await page.waitForFunction(()=>document.querySelector('#chance-support-tickets')?.textContent.includes('模擬真人站內回覆'),null,{timeout:9000});
 page.on('dialog',d=>d.accept());
 await page.click('#chance-erase-cloud');
 await page.waitForFunction(()=>document.querySelector('#cloud-message')?.textContent.includes('已刪除'),null,{timeout:10000});
 assert.equal(doc,null,'cloud backup deleted, local untouched');
 assert.equal(await page.locator('#metric-count').innerText(),'1','local record preserved');
 assert.equal(events.at(0).action,'DELETE','database audit records deletion');
 assert.deepEqual(errors,[],'no browser runtime exceptions');
 assert.ok(requests>7);
 console.log('PASS mocked member login, private cloud backup, optimistic autosync, in-site support and cloud deletion');
 await page.close();
}finally{
 await browser.close();server.kill('SIGTERM');
}
