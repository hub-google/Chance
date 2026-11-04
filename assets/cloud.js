(() => {
'use strict';
const C=window.CHANCE_APP,local=window.ChanceLocal;
if(!C||!local)return;
const BASE='https://unapiwajmgqqtdkixaab.supabase.co',KEY='sb_publishable_L09XC4Tekm6cZaPTTczm3g_Aap-SOSy',SKEY='chance.auth.v1';
let session=null;
try{const v=JSON.parse(localStorage.getItem(SKEY)||'null');if(v&&v.access_token&&v.refresh_token)session=v}catch{}
const p=document.createElement('section');p.className='panel cloud-panel';
p.innerHTML=[
'<div class="toolbar"><div><h2>帳號、雲端備份與付費試用</h2><p class="note">跨裝置同步預設關閉，可自行啟用；手動覆蓋前需確認。此功能不會收款。</p></div><span id="cloud-status" class="pill">未登入</span></div>',
'<div id="cloud-guest"><div class="formgrid">',
'<div class="field"><label for="cloud-email">電子郵件</label><input id="cloud-email" type="email" autocomplete="email" placeholder="you@example.com"></div>',
'<div class="field"><label for="cloud-code">驗證碼</label><input id="cloud-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="請輸入郵件內的數字驗證碼"></div>',
'<div class="field"><label for="cloud-pass">密碼（另一種登入方式）</label><input id="cloud-pass" type="password" autocomplete="current-password" placeholder="註冊至少 6 碼"></div>',
'</div><div class="tools"><button class="btn" id="cloud-send">寄送驗證碼</button><button class="btn primary" id="cloud-verify">驗證碼登入</button><button class="btn" id="cloud-password">密碼登入</button><button class="btn" id="cloud-signup">註冊帳號</button></div>',
'<p class="note">首次註冊可能需要 Email 確認。若驗證信只有登入連結沒有數字碼，管理員須在 Supabase Auth 設定 OTP 郵件模板。</p></div>',
'<div id="cloud-user" hidden><p id="cloud-identity" class="muted"></p><div class="tools">',
'<button class="btn primary" id="cloud-upload">上傳本機紀錄至雲端</button><button class="btn" id="cloud-download">從雲端下載到本機</button><button class="btn" id="cloud-logout">登出</button></div>',
'<p id="cloud-info" class="note">尚未讀取備份狀態。</p><hr class="subtle"><h3>申請付費試用</h3><p class="note">定價假設：<span id="cloud-price"></span>。只記錄意願，不代表已付款或已開通。</p>',
'<div class="field"><label for="cloud-purpose">需求說明（選填）</label><input type="text" id="cloud-purpose" maxlength="400" placeholder="例如：使用於 3 個門市"></div>',
'<p><button class="btn" id="cloud-trial">送出試用申請</button></p></div><p id="cloud-message" class="note" role="status" aria-live="polite"></p>'
].join('');
const metrics=document.querySelector('main .metrics');if(metrics)metrics.before(p);else document.querySelector('main')?.prepend(p);
const $=id=>p.querySelector('#'+id);
$('cloud-price').textContent=C.price;
const report=(msg,error=false)=>{$('cloud-message').textContent=msg;$('cloud-message').style.color=error?'#b94136':'#087659'};
function render(){
  $('cloud-guest').hidden=!!session;$('cloud-user').hidden=!session;
  $('cloud-status').textContent=session?'已登入':'未登入';$('cloud-status').className='pill '+(session?'good':'warn');
  $('cloud-identity').textContent=session?'登入帳號：'+(session.email||'已驗證使用者'):'';
}
function saveSession(r){
 if(!r?.access_token||!r?.refresh_token)throw Error('登入回應缺少授權資訊');
 session={access_token:r.access_token,refresh_token:r.refresh_token,expires_at:Math.floor(Date.now()/1000)+(r.expires_in||3600),email:r.user?.email||session?.email||'',user_id:r.user?.id||session?.user_id||''};
 localStorage.setItem(SKEY,JSON.stringify(session));render();
}
async function req(path,method='GET',body=null,auth=null,prefer=''){
 const headers={'apikey':KEY,'Content-Type':'application/json'};
 if(auth)headers.Authorization='Bearer '+auth;
 if(prefer)headers.Prefer=prefer;
 const response=await fetch(BASE+path,{method,headers,body:body===null?undefined:JSON.stringify(body),cache:'no-store'});
 const raw=await response.text();let val;
 try{val=raw?JSON.parse(raw):null}catch{val={message:raw.slice(0,200)}}
 if(!response.ok)throw Error(val?.msg||val?.error_description||val?.message||val?.error||'HTTP '+response.status);
 return val;
}
async function getToken(){
 if(!session)throw Error('請先登入');
 if(Date.now()/1000<(session.expires_at||0)-90)return session.access_token;
 try{const result=await req('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:session.refresh_token});saveSession(result);return session.access_token}
 catch(e){session=null;localStorage.removeItem(SKEY);render();throw Error('登入已過期，請重新登入：'+e.message)}
}
async function user(){
 const u=await req('/auth/v1/user','GET',null,await getToken());
 if(!u?.id)throw Error('無法取得登入資訊');
 session.user_id=u.id;session.email=u.email||session.email;localStorage.setItem(SKEY,JSON.stringify(session));render();
 return u;
}
async function remote(){
 await user();
 const data=await req('/rest/v1/chance_documents?select=records,version,updated_at&app_slug=eq.'+encodeURIComponent(C.slug)+'&limit=1','GET',null,await getToken());
 return data?.[0]||null;
}
async function inspect(){
 try{const d=await remote();$('cloud-info').textContent=d?'雲端 '+(d.records?.length||0)+' 筆，版次 '+d.version+'；更新：'+new Date(d.updated_at).toLocaleString('zh-TW'):'此產品目前沒有雲端備份。'}
 catch(e){report('查詢失敗：'+e.message,true)}
}
async function action(id,task){$(id).disabled=true;try{await task()}catch(e){report(e.message,true)}finally{$(id).disabled=false}}
$('cloud-send').onclick=()=>action('cloud-send',async()=>{
 const email=$('cloud-email').value.trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('請填寫有效 Email');
 await req('/auth/v1/otp','POST',{email,create_user:true});
 report('已請求寄送，請查看信箱；若沒有數字驗證碼，需管理員設定 OTP 郵件模板。');
});
$('cloud-verify').onclick=()=>action('cloud-verify',async()=>{
 const email=$('cloud-email').value.trim().toLowerCase(),token=$('cloud-code').value.trim();
 if(!email||!token)throw Error('請輸入 Email 與驗證碼');
 saveSession(await req('/auth/v1/verify','POST',{email,token,type:'email'}));
 report('登入成功，請自行選擇上傳或下載資料');await inspect();
});
$('cloud-password').onclick=()=>action('cloud-password',async()=>{
 const email=$('cloud-email').value.trim().toLowerCase(),password=$('cloud-pass').value;
 if(!email||!password)throw Error('請填帳號與密碼');
 saveSession(await req('/auth/v1/token?grant_type=password','POST',{email,password}));
 $('cloud-pass').value='';report('登入成功，本機紀錄未改變');await inspect();
});
$('cloud-signup').onclick=()=>action('cloud-signup',async()=>{
 const email=$('cloud-email').value.trim().toLowerCase(),password=$('cloud-pass').value;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<6)throw Error('請填有效 Email 與至少 6 碼密碼');
 const r=await req('/auth/v1/signup','POST',{email,password});
 $('cloud-pass').value='';
 if(r?.access_token){saveSession(r);report('註冊並登入成功');await inspect()}
 else report('已送出註冊，請到信箱完成確認，再返回使用密碼登入。');
});
$('cloud-logout').onclick=()=>{
 const token=session?.access_token;session=null;localStorage.removeItem(SKEY);render();
 $('cloud-info').textContent='尚未讀取備份狀態';report('已登出雲端，本機資料未改變。');
 if(token)req('/auth/v1/logout','POST',null,token).catch(()=>{});
};
$('cloud-upload').onclick=()=>action('cloud-upload',async()=>{
 const u=await user(),prev=await remote(),records=local.read();
 if(records.length===0&&!confirm('本機沒有紀錄，確定要上傳空清單？'))return;
 if(prev&&!confirm('雲端有 '+prev.records.length+' 筆資料，上傳將改為本機 '+records.length+' 筆。請先備份！'))return;
 if(prev){
  const path='/rest/v1/chance_documents?user_id=eq.'+encodeURIComponent(u.id)+'&app_slug=eq.'+encodeURIComponent(C.slug)+'&version=eq.'+prev.version;
  const res=await req(path,'PATCH',{records,version:prev.version+1,updated_at:new Date().toISOString()},await getToken(),'return=representation');
  if(!Array.isArray(res)||!res.length)throw Error('雲端已由其他裝置更新，請重新核對');
 }else await req('/rest/v1/chance_documents','POST',{user_id:u.id,app_slug:C.slug,records},await getToken(),'return=minimal');
 report('已上傳 '+records.length+' 筆到私人雲端備份');await inspect();
});
$('cloud-download').onclick=()=>action('cloud-download',async()=>{
 const d=await remote();if(!d){report('雲端尚無備份');return}
 if(!Array.isArray(d.records))throw Error('雲端備份格式異常');
 if(local.count()>0&&!confirm('雲端 '+d.records.length+' 筆將覆蓋本機 '+local.count()+' 筆。建議先下載 JSON 備份。確定嗎？'))return;
 if(!local.replace(d.records))throw Error('無法將備份存到瀏覽器');
 report('已還原 '+d.records.length+' 筆雲端資料');await inspect();
});
$('cloud-trial').onclick=()=>action('cloud-trial',async()=>{
 const u=await user();
 await req('/rest/v1/chance_trial_requests','POST',{user_id:u.id,app_slug:C.slug,plan_name:'付費試用意願',note:$('cloud-purpose').value.trim(),status:'new'},await getToken(),'return=minimal');
 report('已記錄試用意願；沒有扣款，也尚未開通訂閱。');
});

const account=$('cloud-user');
const service=document.createElement('div');
service.className='chance-support';
service.innerHTML=[
 '<hr class="subtle"><h3>網站內客服與問題回報</h3>',
 '<p class="note">以網站表單送出並在此處查看處理狀態及真人回覆；不需要透過 Email 客服。請勿傳送身分證或支付卡資訊。</p>',
 '<div class="field"><label for="chance-support-subject">問題主題</label><input id="chance-support-subject" type="text" maxlength="120" placeholder="例：資料顯示錯誤"></div>',
 '<div class="field"><label for="chance-support-description">問題說明</label><textarea id="chance-support-description" maxlength="2000" rows="3" placeholder="請描述操作方式、錯誤文字與希望的協助。"></textarea></div>',
 '<div class="tools"><button class="btn primary" type="button" id="chance-support-submit">送出問題</button><button class="btn" type="button" id="chance-support-refresh">重新查詢回覆</button></div>',
 '<div id="chance-support-tickets" class="chance-support-list"></div>',
 '<hr class="subtle"><h3>雲端備份操作紀錄</h3>',
 '<p class="note">此處只記錄存檔類型、筆數及版次，不保存紀錄內容。由資料庫在寫入時自動產生。</p>',
 '<div id="chance-audit-list" class="chance-support-list"></div>'
].join('');
account.append(service);

const planBar=document.createElement('div');planBar.className='chance-account-extra';
const entitlementLine=document.createElement('p');entitlementLine.className='note';entitlementLine.id='chance-entitlement-status';entitlementLine.textContent='尚未確認訂閱資格。';
const erase=document.createElement('button');erase.className='btn danger';erase.id='chance-erase-cloud';erase.type='button';erase.textContent='刪除本產品雲端備份';
const deletionRequest=document.createElement('button');deletionRequest.className='btn danger';deletionRequest.id='chance-request-erasure';deletionRequest.type='button';deletionRequest.textContent='申請刪除會員平台資料';
planBar.append(entitlementLine,erase,deletionRequest);
account.insertBefore(planBar,service);
const legal=document.createElement('p');legal.className='note';legal.append('服務資料與風險說明：');
for(const [label,url] of [['方案／收費','../pricing/'],['隱私','../legal/privacy.html'],['條款','../legal/terms.html']]){
 const a=document.createElement('a');a.href=url;a.textContent=label;a.style.marginLeft='12px';legal.append(a);
}
p.append(legal);

const subj=$('chance-support-subject'),description=$('chance-support-description');
const ticketArea=$('chance-support-tickets'),auditArea=$('chance-audit-list');
const small=(tag,value,cls='')=>{const el=document.createElement(tag);el.textContent=String(value??'');if(cls)el.className=cls;return el};
async function loadSupport(){
 if(!session)return;
 try{
  const token=await getToken();
  const tickets=await req('/rest/v1/chance_support_tickets?select=id,subject,description,status,created_at&app_slug=eq.'+encodeURIComponent(C.slug)+'&order=created_at.desc&limit=20','GET',null,token);
  const replies=await req('/rest/v1/chance_support_replies?select=ticket_id,content,created_at&order=created_at.desc&limit=40','GET',null,token);
  ticketArea.replaceChildren();
  if(!tickets?.length){ticketArea.append(small('p','目前沒有客服問題紀錄。','note'));return}
  for(const t of tickets){
   const box=document.createElement('article');box.className='chance-support-ticket';
   box.append(small('strong',t.subject),small('span',({open:'待處理',in_review:'處理中',answered:'已回覆',closed:'已結案'})[t.status]||t.status,'pill'));
   box.append(small('p',t.description,'note'));
   box.append(small('p',new Date(t.created_at).toLocaleString('zh-TW'),'note'));
   for(const reply of (replies||[]).filter(r=>r.ticket_id===t.id)){
    const el=document.createElement('blockquote');
    el.append(small('strong','客服回覆　'),small('span',new Date(reply.created_at).toLocaleString('zh-TW')));
    el.append(small('p',reply.content));
    box.append(el);
   }
   ticketArea.append(box);
  }
 }catch(e){ticketArea.replaceChildren(small('p','客服紀錄讀取失敗：'+e.message,'note'))}
}
async function loadAudit(){
 if(!session)return;
 try{
  const data=await req('/rest/v1/chance_audit_events?select=action,document_version,record_count,created_at&app_slug=eq.'+encodeURIComponent(C.slug)+'&order=created_at.desc&limit=20','GET',null,await getToken());
  auditArea.replaceChildren();
  if(!data?.length){auditArea.append(small('p','尚未有雲端寫入紀錄。','note'));return}
  const ul=document.createElement('ul');
  for(const entry of data){
   ul.append(small('li',new Date(entry.created_at).toLocaleString('zh-TW')+'　'+({INSERT:'首次備份',UPDATE:'更新備份',DELETE:'刪除備份'})[entry.action]+'　'+entry.record_count+' 筆　版次 '+entry.document_version));
  }
  auditArea.append(ul);
 }catch(e){auditArea.replaceChildren(small('p','操作紀錄無法讀取：'+e.message,'note'))}
}
$('chance-support-submit').onclick=()=>action('chance-support-submit',async()=>{
 const subject=subj.value.trim(),body=description.value.trim();
 if(subject.length<3||subject.length>120)throw Error('主題長度需要 3～120 字');
 if(body.length<5||body.length>2000)throw Error('說明長度需要 5～2000 字');
 const u=await user();
 await req('/rest/v1/chance_support_tickets','POST',{user_id:u.id,app_slug:C.slug,subject,description:body,status:'open'},await getToken(),'return=minimal');
 subj.value='';description.value='';
 report('已收到問題並儲存於站內客服紀錄；請使用「重新查詢回覆」追蹤。');
 await loadSupport();
});
$('chance-support-refresh').onclick=()=>action('chance-support-refresh',async()=>{
 await Promise.all([loadSupport(),loadAudit()]);
 report('客服與雲端操作紀錄已更新。');
});

async function loadEntitlement(){
 if(!session)return;
 try{
  const data=await req('/rest/v1/chance_entitlements?select=plan_code,status,ends_at&app_slug=eq.'+encodeURIComponent(C.slug)+'&limit=1','GET',null,await getToken());
  const ent=data?.[0];
  entitlementLine.textContent=ent?'伺服器方案狀態：'+ent.plan_code+'／'+ent.status+(ent.ends_at?'，有效期限 '+new Date(ent.ends_at).toLocaleDateString('zh-TW'):''):'目前未建立付費訂閱；仍可使用免費本機工具。';
 }catch(e){entitlementLine.textContent='無法查詢訂閱狀態：'+e.message}
}
erase.onclick=()=>action('chance-erase-cloud',async()=>{
 if(!confirm('此操作將永久刪除此產品在雲端的 JSON 備份，不會清除本機紀錄或其他產品。要繼續嗎？'))return;
 if(!confirm('第二次確認：確定刪除本產品的所有雲端備份嗎？請先下載 JSON。'))return;
 const u=await user(),path='/rest/v1/chance_documents?user_id=eq.'+encodeURIComponent(u.id)+'&app_slug=eq.'+encodeURIComponent(C.slug);
 await req(path,'DELETE',null,await getToken(),'return=minimal');
 report('本產品雲端備份已刪除；本機資料未改變。');
 await Promise.all([originalInspect(),loadAudit()]);
});

deletionRequest.onclick=()=>action('chance-request-erasure',async()=>{
 if(!confirm('將向網站客服提出會員資料刪除申請，由管理員核對身分與資料範圍後處理。申請不會立即刪除資料，確定送出嗎？'))return;
 const u=await user();
 await req('/rest/v1/chance_support_tickets','POST',{user_id:u.id,app_slug:C.slug,subject:'會員平台資料刪除申請',description:'請核實本人身分後，協助處理 Chance 平台會員資料與私人佐證附件的刪除請求；請在站內客服回覆進度。',status:'open'},await getToken(),'return=minimal');
 report('已建立會員資料刪除申請，並非立即刪除。請至站內客服紀錄追蹤真人回覆。');
 await loadSupport();
});

const originalInspect=inspect;
inspect=async()=>{
 await originalInspect();
 if(session)await Promise.all([loadSupport(),loadAudit(),loadEntitlement()]);
};


// Opt-in cross-device sync. All document updates use an optimistic version guard.
// Conflicts stop automatic writes; local records are never deleted in a conflict.
const syncPanel=document.createElement('div');syncPanel.className='chance-sync-panel';
const syncControl=document.createElement('button');syncControl.id='chance-sync-toggle';syncControl.className='btn';syncControl.type='button';syncControl.textContent='開啟自動同步';
const syncState=document.createElement('p');syncState.className='note';syncState.id='chance-sync-state';syncState.textContent='預設關閉。請先手動上傳／下載讓兩端資料一致，才可開啟。';
syncPanel.append(syncControl,syncState);
account.insertBefore(syncPanel,planBar);
let autoSync=false,syncVersion=null,syncBusy=false,syncDirty=false,applyingCloud=false,syncTimer=null,pollTimer=null;
const settingKey=()=> 'chance.autosync.v1:'+C.slug+':'+(session?.user_id||'unknown');
const canonical=value=>JSON.stringify(value,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
function renderSync(){
 syncControl.textContent=autoSync?'關閉自動同步':'開啟自動同步';
 syncControl.className='btn '+(autoSync?'primary':'');
}
function stopSync(reason,keepPreference=false){
 autoSync=false;syncVersion=null;syncDirty=false;
 if(syncTimer){clearTimeout(syncTimer);syncTimer=null}
 if(pollTimer){clearInterval(pollTimer);pollTimer=null}
 if(session&&!keepPreference)localStorage.removeItem(settingKey());
 renderSync();
 if(reason)syncState.textContent=reason;
}
async function remoteVersion(){
 const userResult=await user();
 const result=await req('/rest/v1/chance_documents?select=records,version,updated_at&user_id=eq.'+encodeURIComponent(userResult.id)+'&app_slug=eq.'+encodeURIComponent(C.slug)+'&limit=1','GET',null,await getToken());
 return result?.[0]||null;
}
async function syncRead(){
 if(!autoSync||syncBusy||syncDirty)return;
 syncBusy=true;
 try{
  const remote=await remoteVersion();
  if(!remote||!Array.isArray(remote.records)){stopSync('雲端備份已刪除或無法讀取，為安全已暫停同步。');return}
  if(remote.version===syncVersion||syncDirty)return;
  if(remote.version<syncVersion){stopSync('雲端版本比目前同步紀錄更舊，為避免資料遺失已暫停。');return}
  if(syncDirty)return;
  applyingCloud=true;
  const ok=local.replace(remote.records);applyingCloud=false;
  if(!ok){stopSync('瀏覽器無法寫入雲端下載紀錄，已暫停同步。');return}
  syncVersion=remote.version;
  syncState.textContent='已從其他裝置同步 '+remote.records.length+' 筆；雲端版次 '+syncVersion+'。';
 }catch(e){applyingCloud=false;stopSync('自動同步讀取失敗，已暫停：'+e.message)}
 finally{syncBusy=false}
}
async function syncWrite(){
 if(!autoSync||syncBusy||!syncDirty)return;
 syncBusy=true;
 try{
  const current=local.read();
  const u=await user();
  const path='/rest/v1/chance_documents?user_id=eq.'+encodeURIComponent(u.id)+'&app_slug=eq.'+encodeURIComponent(C.slug)+'&version=eq.'+syncVersion;
  const r=await req(path,'PATCH',{records:current,version:syncVersion+1,updated_at:new Date().toISOString()},await getToken(),'return=representation');
  if(!Array.isArray(r)||r.length!==1){
   stopSync('其他裝置已更動雲端資料：自動寫入已停止，本機資料完整保留。請手動比較兩份備份。');return
  }
  syncVersion=r[0].version;
  syncDirty=canonical(local.read())!==canonical(current);
  syncState.textContent='已自動同步 '+current.length+' 筆；雲端版次 '+syncVersion+'。';
 }catch(e){stopSync('自動上傳失敗（本機資料保留）：'+e.message)}
 finally{
  syncBusy=false;
  if(autoSync&&syncDirty){if(syncTimer)clearTimeout(syncTimer);syncTimer=setTimeout(()=>{syncTimer=null;syncWrite()},900)}
 }
}
function beginSync(remote){
 syncVersion=remote.version;autoSync=true;syncDirty=false;
 localStorage.setItem(settingKey(),'1');
 syncState.textContent='同步開啟（僅此產品）。網頁開啟時每 25 秒檢查其他裝置更新；修改會在短暫等待後上傳。';
 renderSync();
 if(pollTimer)clearInterval(pollTimer);
 pollTimer=setInterval(syncRead,25000);
}
async function attemptEnable(fromRestore=false){
 if(!session)return;
 if(!session.user_id)await user();
 const key=settingKey(),remote=await remoteVersion();
 if(!remote){
  if(fromRestore)localStorage.removeItem(key);
  throw Error('尚無雲端備份。請先使用「上傳本機紀錄至雲端」。');
 }
 if(canonical(remote.records)!==canonical(local.read())){
  if(fromRestore)localStorage.removeItem(key);
  throw Error('本機和雲端內容不同。為防止覆寫，請先手動上傳或下載，確認內容一致後再開啟。');
 }
 beginSync(remote);
}
syncControl.onclick=()=>action('chance-sync-toggle',async()=>{
 if(autoSync){stopSync('已關閉自動同步。本機和雲端資料均未清除。');return}
 await attemptEnable(false);
 report('自動同步已啟用。衝突會停止同步，不會強制覆蓋另一台裝置。');
});
window.addEventListener('chance:change',e=>{
 if(!autoSync||e.detail?.slug!==C.slug||applyingCloud)return;
 syncDirty=true;
 if(syncTimer)clearTimeout(syncTimer);
 syncTimer=setTimeout(()=>{syncTimer=null;syncWrite()},900);
});
window.addEventListener('storage',e=>{
 if(e.key===SKEY){
  if(!e.newValue){stopSync('其他分頁已登出，此分頁雲端功能已停用。');session=null;render();}
  else{
   let next=null;try{next=JSON.parse(e.newValue)}catch{}
   if(!next?.access_token||!next?.refresh_token||!session?.user_id||next.user_id!==session.user_id){stopSync('其他分頁已變更登入帳號，本分頁停止使用原憑證。');session=null;render();}
   else session=next;
  }
  return;
 }
 if(autoSync&&e.key==='chance-products:'+C.slug+':v1')
  stopSync('偵測到其他瀏覽器分頁更新本機資料。為避免衝突已暫停同步；請重新整理後確認。');
});
const prevLogout=$('cloud-logout').onclick;
$('cloud-logout').onclick=(event)=>{stopSync('已登出雲端，自動同步停止。');prevLogout(event)};
for(const id of ['cloud-upload','cloud-download','chance-erase-cloud']){
 const old=$(id)?.onclick;
 if(old)$(id).onclick=(event)=>{
  if(autoSync)stopSync('開始手動資料操作，自動同步已關閉；操作後可重新開啟。');
  return old(event);
 };
}
// Reconnect only if exactly the same local data is on the server.
// Reconnection never silently overwrites local browser data.
if(session){
 Promise.resolve().then(async()=>{
  try{
   await user();
   if(localStorage.getItem(settingKey())==='1')await attemptEnable(true);
  }catch(e){syncState.textContent='未自動恢復同步：'+e.message}
 });
}
renderSync();


// Authenticated private evidence attachments, 5MB JPG/PNG/PDF.
// Never use public URLs or service-role keys; files remain private in Storage.
const evidence=document.createElement('section');evidence.className='chance-evidence';
evidence.innerHTML=[
 '<hr class="subtle"><h3>私人佐證附件</h3>',
 '<p class="note">可將 PDF、JPG 或 PNG 附加到指定紀錄（每檔最大 5 MB）。檔案保存在私人儲存空間，只可由該帳號讀取。請先遮蔽不必要的敏感資訊。</p>',
 '<div class="formgrid"><div class="field"><label for="chance-file-record">附加至哪一筆紀錄</label><select id="chance-file-record"></select></div>',
 '<div class="field"><label for="chance-file-input">選擇檔案</label><input id="chance-file-input" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"></div></div>',
 '<div class="tools"><button id="chance-file-upload" class="btn primary" type="button">上傳私人附件</button><button id="chance-file-refresh" class="btn" type="button">重新整理附件列表</button></div>',
 '<div id="chance-files-list" class="chance-support-list"></div>'
].join('');
account.append(evidence);
const fileRecord=$('chance-file-record'),fileInput=$('chance-file-input'),filesList=$('chance-files-list');
function populateRecords(){
 const before=fileRecord.value,rows=local.read();
 fileRecord.replaceChildren();
 for(const row of rows){
  const opt=document.createElement('option');opt.value=String(row._id||'');
  opt.textContent=String(row[C.fields[0][0]]||'未命名').slice(0,75);fileRecord.append(opt);
 }
 if(rows.some(r=>String(r._id)===before))fileRecord.value=before;
 $('chance-file-upload').disabled=!rows.length;
}
window.addEventListener('chance:change',e=>{if(e.detail?.slug===C.slug)populateRecords()});
async function showFiles(){
 if(!session)return;
 const list=await req('/rest/v1/chance_evidence_files?select=id,record_id,original_name,object_key,mime_type,size_bytes,created_at&app_slug=eq.'+encodeURIComponent(C.slug)+'&order=created_at.desc&limit=100','GET',null,await getToken());
 const records=local.read();
 filesList.replaceChildren();
 if(!list?.length){filesList.append(small('p','此產品尚無私人附件。','note'));return}
 for(const file of list){
  const item=document.createElement('div');item.className='chance-reminder-row';
  const match=records.find(x=>String(x._id)===file.record_id),label=match?String(match[C.fields[0][0]]||'未命名'):'原紀錄已移除';
  item.append(small('strong',file.original_name),small('span','對應紀錄：'+label+'　'+Math.round(file.size_bytes/1024)+' KB','note'));
  const down=small('button','下載','btn');down.type='button';
  down.onclick=async()=>{
   down.disabled=true;
   try{
    const resp=await fetch(BASE+'/storage/v1/object/authenticated/chance-evidence/'+file.object_key.split('/').map(encodeURIComponent).join('/'),{
      headers:{apikey:KEY,Authorization:'Bearer '+await getToken()},cache:'no-store'
    });
    if(!resp.ok)throw Error('下載回應 '+resp.status);
    const data=await resp.blob(),url=URL.createObjectURL(data),a=document.createElement('a');
    a.href=url;a.download=file.original_name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
   }catch(e){report('下載失敗：'+e.message,true)}finally{down.disabled=false}
  };
  const del=small('button','刪除','btn danger');del.type='button';
  del.onclick=async()=>{
   if(!confirm('確定永久刪除私人附件「'+file.original_name+'」？此操作無法復原。'))return;
   del.disabled=true;
   try{
    const resp=await fetch(BASE+'/storage/v1/object/chance-evidence',{
      method:'DELETE',headers:{apikey:KEY,Authorization:'Bearer '+await getToken(),'Content-Type':'application/json'},
      body:JSON.stringify({prefixes:[file.object_key]})
    });
    if(!resp.ok)throw Error('刪除檔案失敗（'+resp.status+'）');
    await req('/rest/v1/chance_evidence_files?id=eq.'+encodeURIComponent(file.id),'DELETE',null,await getToken(),'return=minimal');
    report('已刪除私人附件。');await showFiles();
   }catch(e){report('刪除失敗：'+e.message,true)}finally{del.disabled=false}
  };
  item.append(down,del);filesList.append(item);
 }
}
$('chance-file-upload').onclick=()=>action('chance-file-upload',async()=>{
 const file=fileInput.files?.[0],recordId=fileRecord.value;
 if(!recordId||!local.read().some(x=>String(x._id)===recordId))throw Error('請先選擇一筆有效紀錄');
 if(!file)throw Error('請先選擇檔案');
 if(!['image/png','image/jpeg','application/pdf'].includes(file.type))throw Error('只接受 JPG、PNG 或 PDF');
 if(file.size<=0||file.size>5242880)throw Error('檔案不得為空且不可超過5MB');
 const u=await user(),ext=file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':'jpg';
 const safeRecord=recordId.replace(/[^a-zA-Z0-9-]/g,'-').slice(0,150);
 const key=u.id+'/'+C.slug+'/'+safeRecord+'/'+crypto.randomUUID()+'.'+ext;
 const upload=await fetch(BASE+'/storage/v1/object/chance-evidence/'+key,{
  method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+await getToken(),'Content-Type':file.type,'x-upsert':'false'},
  body:file
 });
 if(!upload.ok){let msg='HTTP '+upload.status;try{msg=(await upload.json()).message||msg}catch{}throw Error('附件上傳失敗：'+msg)}
 try{
  await req('/rest/v1/chance_evidence_files','POST',{
   user_id:u.id,app_slug:C.slug,record_id:recordId,object_key:key,
   original_name:file.name.slice(0,150),mime_type:file.type,size_bytes:file.size
  },await getToken(),'return=minimal');
 }catch(error){
  // Best-effort delete if the metadata insert fails. Do not claim success.
  await fetch(BASE+'/storage/v1/object/chance-evidence',{method:'DELETE',headers:{apikey:KEY,Authorization:'Bearer '+await getToken(),'Content-Type':'application/json'},body:JSON.stringify({prefixes:[key]})}).catch(()=>{});
  throw Error('附件索引儲存失敗：'+error.message);
 }
 fileInput.value='';report('私人附件已上傳，請在下方列表查閱。');await showFiles();
});
$('chance-file-refresh').onclick=()=>action('chance-file-refresh',async()=>{await showFiles();report('附件列表已更新。')});
populateRecords();
if(session)showFiles().catch(e=>report('附件清單無法讀取：'+e.message,true));

render();if(session)inspect();
})();