(()=>{
'use strict';
// This is a dispatch ledger for the existing device register, not technician account login or push messaging.
const app=window.CHANCE_APP,store=window.ChanceLocal;
if(app?.kind!=='filter'||!store?.updateStructured)return;
const section=document.createElement('section');section.className='panel chance-filter-dispatch';
section.innerHTML=[
 '<h2>多技師保養派工</h2>',
 '<p class="note">依設備安排預定日期、指派 1～10 位技師並追蹤狀態。此處只建立公司內部派工紀錄，不會自動通知技師或代表客戶已簽收。完整紀錄隨 JSON 備份與自行開啟的雲端同步保存。</p>',
 '<div class="field"><label for="chance-dispatch-device">選擇據點與設備</label><select id="chance-dispatch-device"></select></div>',
 '<form id="chance-dispatch-form">',
 '<div class="formgrid">',
 '<div class="field"><label for="chance-dispatch-date">預計保養日期</label><input type="date" id="chance-dispatch-date" required></div>',
 '<div class="field"><label for="chance-dispatch-technicians">指派技師（多人以逗號分隔）</label><input id="chance-dispatch-technicians" type="text" maxlength="420" required placeholder="例如：王技師, 陳技師"></div>',
 '<div class="field"><label for="chance-dispatch-status">派工狀態</label><select id="chance-dispatch-status"><option>已指派</option><option>執行中</option><option>已完成</option><option>已取消</option></select></div>',
 '<div class="field"><label for="chance-dispatch-note">派工說明（選填）</label><input id="chance-dispatch-note" maxlength="160" placeholder="例如：帶兩組濾芯與測試紙"></div>',
 '</div><div class="tools"><button class="btn primary" type="submit" id="chance-dispatch-submit">新增派工</button><button class="btn" type="button" id="chance-dispatch-cancel" hidden>取消編輯</button></div>',
 '</form>',
 '<div id="chance-dispatch-summary" class="note"></div>',
 '<div id="chance-dispatch-list" class="chance-support-list"></div>',
 '<p id="chance-dispatch-feedback" class="note" role="status" aria-live="polite"></p>'
].join('');
const target=document.querySelector('main .chance-reminders')||document.querySelector('main .chance-analysis')||document.querySelector('main .panel');
if(target)target.after(section);else document.querySelector('main')?.append(section);
const $=id=>section.querySelector('#'+id);
const select=$('chance-dispatch-device'),form=$('chance-dispatch-form'),list=$('chance-dispatch-list');
const fieldDate=$('chance-dispatch-date'),fieldPeople=$('chance-dispatch-technicians'),fieldStatus=$('chance-dispatch-status'),fieldNote=$('chance-dispatch-note');
const el=(name,value,cls='')=>{const node=document.createElement(name);node.textContent=String(value??'');if(cls)node.className=cls;return node};
const feedback=(msg,error=false)=>{const p=$('chance-dispatch-feedback');p.textContent=msg;p.style.color=error?'#b94136':'#087659'};
const validDate=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return false;const t=new Date(d+'T12:00:00');return Number.isFinite(t.getTime())&&t.getFullYear()===+d.slice(0,4)&&t.getMonth()+1===+d.slice(5,7)&&t.getDate()===+d.slice(8,10)};
let editing=null;
function current(){return store.read().find(r=>String(r._id)===select.value)}
function resetForm(){editing=null;form.reset();$('chance-dispatch-submit').textContent='新增派工';$('chance-dispatch-cancel').hidden=true}
function render(){
 const device=current();list.replaceChildren();
 if(!device){$('chance-dispatch-summary').textContent='請先建立一筆飲水機設備台帳。';return}
 const orders=device._workOrders||[];
 const open=orders.filter(w=>w.status==='已指派'||w.status==='執行中').length;
 $('chance-dispatch-summary').textContent='據點 '+String(device.site||'未填')+'｜設備 '+String(device.device||'未填')+'｜派工 '+orders.length+' 筆｜待處理 '+open+' 筆';
 if(!orders.length){list.append(el('p','尚無派工紀錄。','note'));return}
 for(const job of [...orders].sort((a,b)=>a.scheduled.localeCompare(b.scheduled))){
  const item=document.createElement('article');item.className='chance-support-ticket';
  const title=el('strong',job.scheduled+'｜'+job.status),who=el('p','指派技師：'+job.assignees.join('、'),'note');
  item.append(title,who);
  if(job.note)item.append(el('p','備註：'+job.note,'note'));
  const actions=document.createElement('div');actions.className='tools';
  const edit=el('button','編輯派工','btn');edit.type='button';
  edit.onclick=()=>{
   editing=job.id;fieldDate.value=job.scheduled;fieldPeople.value=job.assignees.join(', ');
   fieldStatus.value=job.status;fieldNote.value=job.note||'';
   $('chance-dispatch-submit').textContent='儲存派工修改';$('chance-dispatch-cancel').hidden=false;
   fieldDate.focus();
  };
  const del=el('button','刪除','btn danger');del.type='button';
  del.onclick=()=>{
   if(!confirm('確定刪除此設備的 '+job.scheduled+' 派工紀錄'+(job.signoff?'及原有現場簽收':'')+'？這會從本機資料中移除，請先備份。'))return;
   if(store.updateStructured(device._id,{_workOrders:orders.filter(x=>x.id!==job.id)})){
    if(editing===job.id)resetForm();
    feedback('派工已刪除。');
   }else feedback('刪除失敗，原始紀錄已保留。',true);
  };
  actions.append(edit,del);item.append(actions);list.append(item);
 }
}
function refresh(){
 const last=select.value,rows=store.read();select.replaceChildren();
 for(const row of rows){
  const option=document.createElement('option');option.value=String(row._id);
  option.textContent=String(row.site||'未命名據點').slice(0,60)+'｜'+String(row.device||'未命名設備').slice(0,60);
  select.append(option);
 }
 if(rows.some(r=>String(r._id)===last))select.value=last;
 for(const field of form.querySelectorAll('input,select,button'))field.disabled=!rows.length;
 render();
}
$('chance-dispatch-cancel').onclick=resetForm;
select.onchange=()=>{resetForm();render();feedback('')};
form.addEventListener('submit',event=>{
 event.preventDefault();
 const row=current();if(!row){feedback('請先建立設備資料。',true);return}
 const scheduled=fieldDate.value;
 const assignees=fieldPeople.value.split(/[,，、]/).map(v=>v.trim());
 const status=fieldStatus.value,note=fieldNote.value.trim();
 if(!validDate(scheduled)){feedback('預計保養日期不正確。',true);return}
 if(assignees.length<1||assignees.length>10||assignees.some(n=>!n||n.length>40)||new Set(assignees).size!==assignees.length){
  feedback('請填寫 1～10 位不重複技師，每位名稱最多 40 字，並以逗號隔開。',true);return;
 }
 const orders=[...(row._workOrders||[])],original=orders.find(x=>x.id===editing);
 if(editing&&!original){feedback('派工已不存在，請重新選擇。',true);resetForm();return}
 if(!editing&&orders.length>=100){feedback('本設備已達 100 筆派工上限，請先備份整理。',true);return}
 const now=new Date().toISOString();
 if(original?.signoff&&!confirm('這筆派工已有客戶現場簽收。修改將撤銷原有簽名及簽收紀錄；如需留存請先備份 JSON。確定修改嗎？'))return;
 const job={id:original?.id||crypto.randomUUID(),scheduled,assignees,status,note,createdAt:original?.createdAt||now,updatedAt:now,signoff:null};
 const updated=editing?orders.map(x=>x.id===editing?job:x):[...orders,job];
 if(store.updateStructured(row._id,{_workOrders:updated})){
  resetForm();feedback('派工已儲存；可於待辦行事曆匯出排程。');
 }else feedback('派工儲存失敗，原始紀錄已保留。',true);
});
window.addEventListener('chance:change',e=>{if(e.detail?.slug===app.slug)refresh()});
refresh();
})();