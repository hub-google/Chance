(()=>{
'use strict';
const BASE='https://unapiwajmgqqtdkixaab.supabase.co',KEY='sb_publishable_L09XC4Tekm6cZaPTTczm3g_Aap-SOSy';
const $=id=>document.getElementById(id);
const token=location.hash.slice(1).trim();
const note=(msg,bad=false)=>{$('confirm-notice').textContent=msg;$('confirm-notice').style.color=bad?'#b94136':'#087659'};
let active=false;
async function rpc(name,body){
 const response=await fetch(BASE+'/rest/v1/rpc/'+name,{
  method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},
  body:JSON.stringify(body),cache:'no-store',referrerPolicy:'no-referrer'
 });
 const raw=await response.text();let data;
 try{data=raw?JSON.parse(raw):null}catch{data={message:raw.slice(0,160)}}
 if(!response.ok)throw Error(data?.message||'連結服務暫時不可用（'+response.status+'）');
 return data;
}
function renderResult(status){
 $('confirm-controls').hidden=status!=='pending';
 $('confirm-outcome').textContent=status==='confirmed'?'已記錄您確認規格的回覆。':
  status==='declined'?'已記錄您提出異議的回覆，請向店家確認修改內容。':'';
}
async function load(){
 if(!/^[a-f0-9]{48}$/.test(token)){note('確認連結無效。請向店家索取新的確認連結。',true);return}
 try{
  const data=await rpc('chance_order_confirmation_preview',{p_token:token});
  if(!data?.ok){note(data?.status==='expired'?'此確認連結已超過有效期限，請向店家索取新連結。':'此確認連結已失效或遭撤銷。',true);return}
  const snapshot=data.snapshot||{};
  $('confirm-order').textContent=String(snapshot.order||'');
  $('confirm-client').textContent=String(snapshot.client||'');
  const total=Number(snapshot.total);
  $('confirm-total').textContent=Number.isFinite(total)?'NT$ '+new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(total):'請向店家確認';
  $('confirm-expiry').textContent=new Date(data.expires_at).toLocaleString('zh-TW');
  $('confirm-specs').textContent=String(snapshot.specs||'');
  $('confirm-details').hidden=false;
  active=data.status==='pending';
  renderResult(data.status);
  note(active?'請閱讀全部內容，再決定確認或提出異議。':'此連結已經完成一次回覆，不能重複提交。');
 }catch(e){note('無法讀取確認內容：'+e.message,true)}
}
async function submit(decision){
 if(!active)return;
 const feedback=$('confirm-feedback').value.trim();
 if(decision==='declined'&&feedback.length<5){$('confirm-outcome').textContent='提出異議時，請至少填寫 5 字說明。';return}
 if(!confirm(decision==='confirmed'?'確定同意畫面上的訂製規格？':'確定送出異議說明？'))return;
 active=false;
 $('confirm-accept').disabled=true;$('confirm-decline').disabled=true;
 try{
  const data=await rpc('chance_order_confirmation_reply',{p_token:token,p_decision:decision,p_feedback:feedback});
  if(!data?.ok)throw Error('連結可能已過期或使用過，請重新整理並向店家確認。');
  renderResult(decision);note('已將回覆安全保存於店家的訂單確認紀錄。');
 }catch(e){
  $('confirm-outcome').textContent='送出未完成：'+e.message;
  active=true;
  $('confirm-accept').disabled=false;$('confirm-decline').disabled=false;
 }
}
$('confirm-accept').onclick=()=>submit('confirmed');
$('confirm-decline').onclick=()=>submit('declined');
load();
})();