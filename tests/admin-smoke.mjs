import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {chromium} from 'playwright';
const base='http://127.0.0.1:8978';
const server=spawn('python3',['-m','http.server','8978','--bind','127.0.0.1'],{stdio:'ignore'});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const id='99999999-9999-4999-8999-999999999999',email='synthetic-ops@example.invalid';
let allow=false,replyCount=0,updatedStatus='open';
try{
 let ready=false;
 for(let i=0;i<30;i++){try{if((await fetch(base+'/')).ok){ready=true;break}}catch{}await sleep(140)}
 assert.ok(ready);
 const page=await browser.newPage();
 await page.addInitScript(data=>localStorage.setItem('chance.auth.v1',JSON.stringify({
  access_token:'fake-admin-token',refresh_token:'fake-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user_id:data.id,email:data.email
 })),{id,email});
 await page.route('https://unapiwajmgqqtdkixaab.supabase.co/**',route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
  const send=body=>route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify(body)});
  if(method==='OPTIONS')return send({});
  if(path==='/auth/v1/user')return send({id,email});
  if(path==='/rest/v1/chance_admins')return send(allow?[{role:'owner',active:true}]:[]);
  if(path==='/rest/v1/chance_support_tickets'){
   if(method==='GET')return send([{id:'22222222-2222-4222-8222-222222222222',user_id:id,app_slug:'invoice-proof',subject:'合成測試客服問題',description:'客服後台權限測試',status:updatedStatus,created_at:new Date().toISOString()}]);
   if(method==='PATCH'){updatedStatus=req.postDataJSON().status;return send([{status:updatedStatus}])}
  }
  if(path==='/rest/v1/chance_trial_requests')return send([{id:'aaaa',user_id:id,app_slug:'invoice-proof',plan_name:'付費試用',note:'僅模擬',status:'new',created_at:new Date().toISOString()}]);
  if(path==='/rest/v1/chance_support_replies'){
   if(method==='GET')return send([]);
   if(method==='POST'){replyCount++;return send([req.postDataJSON()])}
  }
  throw Error('Unexpected '+method+' '+path);
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/admin/',{waitUntil:'load'});
 await page.locator('#adm-reuse').click();
 await page.waitForFunction(()=>document.querySelector('#adm-status')?.textContent.includes('尚未加入'),null,{timeout:8000});
 assert.equal(await page.locator('#admin-content').isVisible(),false,'nonstaff cannot see users');
 allow=true;
 await page.locator('#adm-reuse').click();
 await page.waitForFunction(()=>!document.querySelector('#admin-content').hidden,null,{timeout:8000});
 assert.equal(await page.locator('#adm-count').innerText(),'1');
 assert.ok((await page.locator('#adm-trials').innerText()).includes('invoice-proof'));
 await page.locator('#adm-tickets textarea').fill('這是模擬管理員站內回覆，不會傳送真實資料。');
 await page.locator('#adm-tickets button.primary').click();
 for(let i=0;i<40&&replyCount===0;i++)await sleep(100);
 assert.equal(replyCount,1,'staff reply creates private message');
 assert.equal(updatedStatus,'answered','staff reply moves ticket to answered');
 assert.deepEqual(errors,[],'no runtime errors');
 console.log('PASS admin deny-by-default, verified allowlist, private ticket read and human reply');
 await page.close();
}finally{await browser.close();server.kill('SIGTERM')}
