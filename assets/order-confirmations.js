(()=>{
'use strict';
const app=window.CHANCE_APP,local=window.ChanceLocal;
if(app?.kind!=='orders'||!local?.applyCustomerApproval)return;
const BASE='https://unapiwajmgqqtdkixaab.supabase.co',KEY='sb_publishable_L09XC4Tekm6cZaPTTczm3g_Aap-SOSy';
const panel=document.createElement('section');panel.className='panel chance-order-confirmations';
panel.innerHTML=[
 '<h2>客戶規格確認專屬連結</h2>',
 '<p class="note">請先在上方使用 Chance 帳號登入。選擇訂單並填寫本次要確認的完整規格，產生 7 天有效的專屬連結後自行傳給客戶。連結僅能確認或提出異議，不會收款、簽署法律契約或自動修改本機台帳。</p>',
 '<div class="field"><label for="chance-confirm-record">選擇訂單</label><select id="chance-confirm-record"></select></div>',
 '<div class="field"><label for="chance-confirm-specs">本次請客戶確認的訂製規格（必填，10～2,000 字）</label><textarea id="chance-confirm-specs" rows="5" minlength="10" maxlength="2000" placeholder="請列明尺寸、材質、顏色、數量與交期等實際確認事項，不要上傳身分證或支付卡資料。"></textarea></div>',
 '<div class="tools"><button class="btn primary" id="chance-confirm-issue" type="button">產生有效 7 天的確認連結</button><button class="btn" id="chance-confirm-refresh" type="button">查詢客戶回覆</button></div>',
 '<div class="field" id="chance-confirm-link-wrap" hidden><label for="chance-confirm-link">本次專屬連結（只會顯示一次；請自行傳給客戶）</label><input id="chance-confirm-link" readonly><button id="chance-confirm-copy" class="btn" type="button">複製連結</button></div>',
 '<p id="chance-confirm-feedback" class="note" role="status" aria-live="polite"></p>',
 '<h3>已建立的客戶確認</h3>',
 '<div id="chance-confirm-list" class="chance-support-list"></div>'
].join('');
const anchor=document.querySelector('main .chance-workflow')||document.querySelector('main .chance-analysis')||document.querySelector('main .panel');
if(anchor)anchor.after(panel);else document.querySelector('main')?.append(panel);
const $=id=>panel.querySelector('#'+id),select=$('chance-confirm-record'),out=$('chance-confirm-list');
const create=$('chance-confirm-issue'),refreshButton=$('chance-confirm-refresh'),specs=$('chance-confirm-specs');
const linkWrap=$('chance-confirm-link-wrap'),linkInput=$('chance-confirm-link');
const small=(tag,value,cls='')=>{const e=document.createElement(tag);e.textContent=String(value??'');if(cls)e.className=cls;return e};
const message=(str,bad=false)=>{const e=$('chance-confirm-feedback');e.textContent=str;e.style.color=bad?'#b94136':'#087659'};
async function api(path,method='GET',body=null){
 const helper=window.ChanceCloudSession;
 if(!helper?.getToken)throw Error('帳號登入元件尚未載入，請重新整理頁面。');
 const token=await helper.getToken();
 const response=await fetch(BASE+path,{method,headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===null?undefined:JSON.stringify(body),cache:'no-store'});
 const raw=await response.text();let data;
 try{data=raw?JSON.parse(raw):null}catch{data={message:raw.slice(0,160)}}
 if(!response.ok)throw Error(data?.message||data?.error_description||'請求失敗（HTTP '+response.status+'）');
 return data;
}
function populate(){
 const old=select.value;select.replaceChildren();
 for(const r of local.read()){
  const option=document.createElement('option');option.value=String(r._id);option.textContent=String(r.order||'未命名').slice(0,80)+'｜'+String(r.client||'').slice(0,40);
  select.append(option);
 }
 if([...select.options].some(o=>o.value===old))select.value=old;
 create.disabled=!select.options.length;
}
function selected(){return local.read().find(r=>String(r._id)===select.value)}
function statusLabel(entry){
 if(entry.status==='revoked')return '已撤銷';
 if(entry.status==='confirmed')return '客戶已確認';
 if(entry.status==='declined')return '客戶提出異議';
 return new Date(entry.expires_at).getTime()<=Date.now()?'連結已到期':'待客戶確認';
}
function render(entries){
 out.replaceChildren();if(!entries?.length){out.append(small('p','目前沒有客戶規格確認邀請。','note'));return}
 const latest=new Set(),firstByRecord=new Set();
 for(const item of entries){
  const div=document.createElement('article');div.className='chance-support-ticket';
  const name=item.snapshot?.order||item.record_id;
  div.append(small('strong',String(name).slice(0,140)));
  div.append(small('span',statusLabel(item),'pill'));
  div.append(small('p','建立 '+new Date(item.created_at).toLocaleString('zh-TW')+'｜期限 '+new Date(item.expires_at).toLocaleString('zh-TW'),'note'));
  div.append(small('p','規格摘要：'+String(item.snapshot?.specs||'').slice(0,2000),'note'));
  if(item.response_note)div.append(small('p','客戶回覆：'+item.response_note,'note'));
  const current=!firstByRecord.has(item.record_id);
  if(current)firstByRecord.add(item.record_id);
  if(item.status==='confirmed'&&current){
   const button=small('button','核對後套用至本機訂單','btn primary');button.type='button';
   button.onclick=()=>{
    const record=local.read().find(r=>r._id===item.record_id);
    if(!record){message('找不到原本訂單，請先從 JSON／雲端還原，不能自動套用。',true);return}
    if(!confirm('請人工核對客戶已確認的規格摘要：\n'+String(item.snapshot?.specs||'').slice(0,1000)+'\n\n確認本機訂單與客戶同意內容一致，將「客戶確認規格」更新為「是」？'))return;
    if(local.applyCustomerApproval(item.record_id,item.snapshot))message('已更新本機訂單；請確認是否需要上傳／同步私人雲端備份。');
    else message('本機訂單內容與確認快照不同，已停止套用。',true);
   };
   div.append(button);
  }
  if(item.status==='pending'&&new Date(item.expires_at).getTime()>Date.now()){
   const revoke=small('button','撤銷此連結','btn danger');revoke.type='button';
   revoke.onclick=async()=>{
    if(!confirm('撤銷後客戶無法再開啟這個確認連結。確定撤銷？'))return;
    revoke.disabled=true;
    try{
     const result=await api('/rest/v1/rpc/chance_revoke_order_confirmation','POST',{p_id:item.id});
     if(result!==true)throw Error('此連結可能已被使用或過期');
     message('連結已撤銷');await refresh();
    }catch(e){message(e.message,true)}finally{revoke.disabled=false}
   };
   div.append(revoke);
  }
  out.append(div);
 }
}
async function refresh(){
 const rows=await api('/rest/v1/chance_order_confirmations?select=id,record_id,snapshot,status,response_note,created_at,expires_at,responded_at&order=created_at.desc&limit=50');
 if(!Array.isArray(rows))throw Error('確認清單格式不正確');
 render(rows);return rows;
}
create.onclick=async()=>{
 const r=selected(),details=specs.value.trim();
 if(!r){message('請先建立並選擇訂單。',true);return}
 if(details.length<10||details.length>2000){message('訂製規格需要 10～2,000 字。',true);return}
 if(!confirm('將以目前的訂單名稱、客戶代稱、總價與規格摘要產生專屬連結，過去同訂單尚未回覆的連結會被撤銷。確定？'))return;
 create.disabled=true;linkWrap.hidden=true;linkInput.value='';
 try{
  const data=await api('/rest/v1/rpc/chance_create_order_confirmation','POST',{
   p_record_id:r._id,p_order:r.order,p_client:r.client,p_specs:details,p_total:r.total
  });
  if(!data?.ok||!/^[a-f0-9]{48}$/.test(data.token||''))throw Error('伺服器沒有產生有效連結');
  const href=new URL('../confirm/#'+data.token,location.href).href;
  linkInput.value=href;linkWrap.hidden=false;
  message('已產生 7 天有效的專屬連結；請自行複製傳給客戶。平台不會自動發送通知。');
  await refresh();
 }catch(e){message(e.message,true)}
 finally{create.disabled=!local.read().length}
};
refreshButton.onclick=async()=>{
 refreshButton.disabled=true;
 try{await refresh();message('已查詢伺服器的客戶確認紀錄。')}
 catch(e){message('查詢失敗：'+e.message,true)}
 finally{refreshButton.disabled=false}
};
$('chance-confirm-copy').onclick=async()=>{
 if(!linkInput.value)return;
 try{await navigator.clipboard.writeText(linkInput.value);message('連結已複製，請自行傳給客戶。')}
 catch{linkInput.focus();linkInput.select();message('無法自動複製，請手動複製已選取的連結。')}
};
select.onchange=()=>{specs.value='';linkWrap.hidden=true;linkInput.value=''};
window.addEventListener('chance:change',e=>{if(e.detail?.slug===app.slug)populate()});
populate();render([]);
})();