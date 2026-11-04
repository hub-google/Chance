(() => {
'use strict';
const C=window.CHANCE_APP,local=window.ChanceLocal;
if(!C||!local)return;
const BASE='https://unapiwajmgqqtdkixaab.supabase.co',KEY='sb_publishable_L09XC4Tekm6cZaPTTczm3g_Aap-SOSy',SKEY='chance.auth.v1';
let session=null;
try{const v=JSON.parse(localStorage.getItem(SKEY)||'null');if(v&&v.access_token&&v.refresh_token)session=v}catch{}
const p=document.createElement('section');p.className='panel cloud-panel';
p.innerHTML=[
'<div class="toolbar"><div><h2>帳號、雲端備份與付費試用</h2><p class="note">本機紀錄不會自動同步，覆蓋前需要自行確認。此功能不會收款。</p></div><span id="cloud-status" class="pill">未登入</span></div>',
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
planBar.append(entitlementLine,erase);
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

const originalInspect=inspect;
inspect=async()=>{
 await originalInspect();
 if(session)await Promise.all([loadSupport(),loadAudit(),loadEntitlement()]);
};

render();if(session)inspect();
})();