(()=>{'use strict';
const BASE='https://unapiwajmgqqtdkixaab.supabase.co',KEY='sb_publishable_L09XC4Tekm6cZaPTTczm3g_Aap-SOSy',SKEY='chance.auth.v1',q=id=>document.getElementById(id);
let auth=null,role='';
const write=(tag,s)=>{const x=document.createElement(tag);x.textContent=String(s??'');return x};
function status(s,bad=false){q('adm-status').textContent=s;q('adm-status').style.color=bad?'#ad3030':'#087659'}
async function api(path,method='GET',data=null,token=''){
 const h={'apikey':KEY,'content-type':'application/json'};if(token)h.authorization='Bearer '+token;
 if(method==='POST'||method==='PATCH')h.Prefer='return=representation';
 const r=await fetch(BASE+path,{method,headers:h,cache:'no-store',body:data?JSON.stringify(data):undefined});
 const body=await r.text();let obj;try{obj=body?JSON.parse(body):null}catch{obj={message:body.slice(0,200)}}
 if(!r.ok)throw Error(obj?.msg||obj?.message||obj?.error_description||'HTTP '+r.status);
 return obj;
}
function setAuth(data){
 if(!data?.access_token||!data?.refresh_token)throw Error('登入資訊缺失');
 auth={access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Math.floor(Date.now()/1000)+(data.expires_in||3600),user_id:data.user?.id||auth?.user_id,email:data.user?.email||auth?.email};
 localStorage.setItem(SKEY,JSON.stringify(auth));
}
async function bearer(){
 if(!auth)throw Error('請先登入');
 if(Date.now()/1000<(auth.expires_at||0)-80)return auth.access_token;
 const r=await api('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:auth.refresh_token});setAuth(r);return auth.access_token;
}
async function checkAdmin(){
 const u=await api('/auth/v1/user','GET',null,await bearer());
 const a=await api('/rest/v1/chance_admins?select=role,active&user_id=eq.'+encodeURIComponent(u.id)+'&limit=1','GET',null,await bearer());
 if(!a?.[0]?.active)throw Error('此帳號尚未加入 Chance 管理員名單；一般會員無法查看客服與試用資料。');
 role=a[0].role;auth.user_id=u.id;auth.email=u.email||'';localStorage.setItem(SKEY,JSON.stringify(auth));
 q('admin-signin').hidden=true;q('admin-content').hidden=false;
 q('adm-who').textContent='登入：'+(auth.email||u.id)+'｜權限：'+role;await refresh();
}
async function login(){
 q('adm-login').disabled=true;
 try{const email=q('adm-email').value.trim(),password=q('adm-pass').value;
  if(!email||!password)throw Error('請填帳號及密碼');
  setAuth(await api('/auth/v1/token?grant_type=password','POST',{email,password}));q('adm-pass').value='';
  await checkAdmin();status('已驗證管理權限。');
 }catch(e){q('admin-content').hidden=true;q('admin-signin').hidden=false;status(e.message,true)}
 finally{q('adm-login').disabled=false}
}
async function reuse(){
 try{const s=JSON.parse(localStorage.getItem(SKEY)||'null');if(!s?.access_token)throw Error('無已登入會員');auth=s;await checkAdmin();status('已使用現有登入資格。')}
 catch(e){status(e.message,true)}
}
const statusName={open:'待處理',in_review:'處理中',answered:'已回覆',closed:'已結案'};
async function refresh(){
 const token=await bearer();
 const [tickets,trials,replies]=await Promise.all([
  api('/rest/v1/chance_support_tickets?select=id,user_id,app_slug,subject,description,status,created_at&order=created_at.desc&limit=100','GET',null,token),
  api('/rest/v1/chance_trial_requests?select=id,user_id,app_slug,plan_name,note,status,created_at&order=created_at.desc&limit=100','GET',null,token),
  api('/rest/v1/chance_support_replies?select=ticket_id,content,created_at,staff_note&order=created_at.desc&limit=200','GET',null,token)
 ]);
 q('adm-count').textContent=tickets.length;q('adm-open').textContent=tickets.filter(t=>t.status==='open'||t.status==='in_review').length;q('adm-trials-count').textContent=trials.length;
 const list=q('adm-tickets');list.replaceChildren();
 if(!tickets.length)list.append(write('p','尚無客服問題。'));
 for(const t of tickets){
  const card=document.createElement('article');card.className='chance-support-ticket';
  card.append(write('h3',t.subject),write('p','產品：'+t.app_slug+'　帳號 ID：'+t.user_id),write('p',t.description),write('small',new Date(t.created_at).toLocaleString('zh-TW')));
  for(const r of replies.filter(r=>r.ticket_id===t.id)){
   const quote=document.createElement('blockquote');quote.append(write('strong',r.staff_note?'內部備註':'站內回覆'),write('p',r.content));card.append(quote)
  }
  const controls=document.createElement('div');controls.className='tools';controls.style.margin='14px 0';
  const select=document.createElement('select');select.style.padding='10px';select.setAttribute('aria-label','客服處理狀態');
  for(const [value,label] of Object.entries(statusName)){const opt=document.createElement('option');opt.value=value;opt.textContent=label;select.append(opt)}select.value=t.status;
  const change=write('button','儲存狀態');change.className='btn';change.onclick=async()=>{
   change.disabled=true;
   try{await api('/rest/v1/chance_support_tickets?id=eq.'+t.id,'PATCH',{status:select.value,updated_at:new Date().toISOString()},await bearer());status('已更新');await refresh()}
   catch(e){status('狀態更新失敗：'+e.message,true)}finally{change.disabled=false}
  };controls.append(select,change);card.append(controls);
  const reply=document.createElement('textarea');reply.className='search';reply.rows=3;reply.maxLength=2000;reply.style.width='100%';reply.placeholder='輸入真人站內回覆';reply.setAttribute('aria-label','真人回覆');
  const send=write('button','送出回覆');send.className='btn primary';send.style.marginTop='8px';send.onclick=async()=>{
   send.disabled=true;
   try{const content=reply.value.trim();if(!content)throw Error('請先輸入回覆');
    await api('/rest/v1/chance_support_replies','POST',{ticket_id:t.id,user_id:t.user_id,content,staff_note:false},await bearer());
    await api('/rest/v1/chance_support_tickets?id=eq.'+t.id,'PATCH',{status:'answered',updated_at:new Date().toISOString()},await bearer());
    status('回覆已保存於會員中心，使用者重新查詢即可看到。');await refresh();
   }catch(e){status('送出失敗：'+e.message,true)}finally{send.disabled=false}
  };
  card.append(reply,send);list.append(card);
 }
 const trialList=q('adm-trials');trialList.replaceChildren();
 if(!trials.length)trialList.append(write('p','尚無付費試用意願。'));
 for(const t of trials){const row=document.createElement('article');row.className='chance-support-ticket';
  row.append(write('h3',t.app_slug+'｜'+t.plan_name),write('p',t.note||'未填需求說明'),write('small','帳號：'+t.user_id+'　狀態：'+t.status+'　'+new Date(t.created_at).toLocaleString('zh-TW')));
  trialList.append(row);
 }
}
q('adm-login').onclick=login;q('adm-reuse').onclick=reuse;
q('adm-refresh').onclick=async()=>{try{await refresh();status('已更新列表')}catch(e){status(e.message,true)}};
q('adm-logout').onclick=()=>{const tok=auth?.access_token;auth=null;role='';localStorage.removeItem(SKEY);q('admin-signin').hidden=false;q('admin-content').hidden=true;status('已登出');if(tok)api('/auth/v1/logout','POST',null,tok).catch(()=>{})};
})();
