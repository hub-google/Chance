(()=>{
'use strict';
const C=window.CHANCE_APP,store=window.ChanceLocal;
if(!C||!store||!['orders','inventory'].includes(C.kind))return;
const fmt=new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2});
const amount=n=>'NT$ '+fmt.format(Number(n)||0);
const $=id=>panel.querySelector('#'+id);
const t=(tag,value,cls='')=>{const el=document.createElement(tag);el.textContent=String(value??'');if(cls)el.className=cls;return el};
const panel=document.createElement('section');panel.className='panel chance-workflow';
const isOrder=C.kind==='orders';
panel.innerHTML=isOrder?[
 '<h2>分期收款明細</h2>',
 '<p class="note">為每張訂單分別建立應收階段、到期日與實收金額。建立第一期時，原先的累計已收會保留為「既有累計已收」；啟用後，主台帳的累計已收改由各期加總。</p>',
 '<div class="field"><label for="chance-workflow-record">選擇訂單</label><select id="chance-workflow-record"></select></div>',
 '<form id="chance-workflow-form"><div class="formgrid">',
 '<div class="field"><label for="chance-stage-label">付款階段名稱</label><input id="chance-stage-label" maxlength="80" required placeholder="例如：第二期款"></div>',
 '<div class="field"><label for="chance-stage-planned">本期約定金額（NT$）</label><input id="chance-stage-planned" type="number" min="0" max="1000000000000" step="any" required></div>',
 '<div class="field"><label for="chance-stage-received">本期實收（NT$）</label><input id="chance-stage-received" type="number" min="0" max="1000000000000" step="any" required></div>',
 '<div class="field"><label for="chance-stage-due">本期到期日</label><input id="chance-stage-due" type="date"></div>',
 '</div><div class="tools"><button type="submit" class="btn primary" id="chance-stage-save">新增付款階段</button><button type="button" class="btn" id="chance-stage-cancel" hidden>取消編輯</button></div></form>',
 '<div id="chance-workflow-list"></div>'
].join(''):[
 '<h2>庫存異動紀錄</h2>',
 '<p class="note">每次庫存增減都記錄異動前後數量、時間與原因；直接在上方修改實存或保留數，也會留下異動紀錄。紀錄跟隨 JSON 備份／雲端同步，但不是不可竄改的正式稽核憑證。</p>',
 '<div class="field"><label for="chance-workflow-record">選擇 SKU</label><select id="chance-workflow-record"></select></div>',
 '<form id="chance-workflow-form"><div class="formgrid">',
 '<div class="field"><label for="chance-stock-delta">實存單包增減量（可填負數）</label><input id="chance-stock-delta" type="number" step="1" required placeholder="例如：-3 或 12"></div>',
 '<div class="field"><label for="chance-stock-reason">異動原因</label><input id="chance-stock-reason" maxlength="120" required placeholder="例如：客戶出貨、到貨入庫"></div>',
 '</div><button class="btn primary" type="submit">儲存庫存異動</button></form>',
 '<div id="chance-workflow-list"></div>'
].join('');
const anchor=document.querySelector('#records')?.closest('.panel');
if(anchor)anchor.before(panel);else document.querySelector('main')?.append(panel);
const select=$('chance-workflow-record'),form=$('chance-workflow-form'),list=$('chance-workflow-list');
const note=t('p','','note');note.setAttribute('role','status');panel.append(note);
const getSelected=()=>store.read().find(r=>String(r._id)===select.value);
let editingStage=null;
function resetEditor(){
 if(!isOrder)return;
 editingStage=null;form.reset();$('chance-stage-save').textContent='新增付款階段';$('chance-stage-cancel').hidden=true;
}
function show(msg,isError=false){note.textContent=msg;note.style.color=isError?'#b94136':'#087659'}
function refreshSelect(){
 const selected=select.value,rows=store.read();select.replaceChildren();
 for(const r of rows){const option=document.createElement('option');option.value=String(r._id);option.textContent=String(r[C.fields[0][0]]||'未命名').slice(0,75);select.append(option)}
 if(rows.some(r=>String(r._id)===selected))select.value=selected;
 form.querySelectorAll('input,button').forEach(input=>input.disabled=!rows.length);
 render();
}
function render(){
 const row=getSelected();list.replaceChildren();if(!row){list.append(t('p','請先在上方建立紀錄。','note'));return}
 if(isOrder){
  const stages=row._payments||[],received=stages.reduce((sum,p)=>sum+Number(p.received||0),0);
  list.append(t('p','合約金額 '+amount(row.total)+'｜累計已收 '+amount(row.paid)+'｜分期項目 '+stages.length+' 筆','note'));
  if(!stages.length){list.append(t('p','尚未建立獨立分期。原本累計已收 '+amount(row.paid)+' 將在新增第一期時保留。','note'));return}
  for(const p of stages){
   const item=document.createElement('article');item.className='chance-support-ticket';
   item.append(t('strong',p.label),t('p','約定 '+amount(p.planned)+'｜已收 '+amount(p.received)+'｜到期日 '+(p.due||'未設定'),'note'));
   item.append(t('p',Number(p.planned)>0&&Number(p.received)<Number(p.planned)?'本期尚欠 '+amount(Number(p.planned)-Number(p.received)):'本期已收齊或為既有款項','note'));
   const edit=t('button','編輯','btn');edit.type='button';
   edit.onclick=()=>{
    editingStage=p._id;$('chance-stage-label').value=p.label;$('chance-stage-planned').value=p.planned;$('chance-stage-received').value=p.received;$('chance-stage-due').value=p.due||'';
    $('chance-stage-save').textContent='儲存付款階段修改';$('chance-stage-cancel').hidden=false;form.scrollIntoView({block:'nearest'});
   };
   const del=t('button','刪除','btn danger');del.type='button';
   del.onclick=()=>{
    if(!confirm('刪除這一期後，主台帳累計已收會依剩餘分期重新加總。確定嗎？'))return;
    if(store.updateStructured(row._id,{_payments:stages.filter(x=>x._id!==p._id)})){resetEditor();show('付款階段已刪除並重新加總')}else show('未能儲存，原始資料未改變',true);
   };
   item.append(edit,del);list.append(item);
  }
  if(Math.abs(received-Number(row.paid||0))>0.001)list.append(t('p','注意：主台帳累計已收與明細不符，請人工核對。','note'));
 }else{
  const history=row._movements||[];
  list.append(t('p','目前實存 '+fmt.format(Number(row.stock)||0)+' 包｜已保留 '+fmt.format(Number(row.reserved)||0)+' 包｜累計異動 '+history.length+' 筆','note'));
  if(!history.length){list.append(t('p','尚無異動紀錄，匯入或舊版台帳的原始數值不會自動產生假異動。','note'));return}
  for(const itemData of history.slice(-50).reverse()){
   const item=document.createElement('article');item.className='chance-support-ticket';
   const time=itemData.at?new Date(itemData.at).toLocaleString('zh-TW'):'未記錄時間';
   item.append(t('strong',itemData.reason||'庫存調整'),t('p',time+'｜實存 '+fmt.format(Number(itemData.stockBefore)||0)+' → '+fmt.format(Number(itemData.stockAfter)||0)+'｜保留 '+fmt.format(Number(itemData.reservedBefore)||0)+' → '+fmt.format(Number(itemData.reservedAfter)||0),'note'));
   list.append(item);
  }
  if(history.length>50)list.append(t('p','畫面僅顯示最近 50 筆，完整異動包含在 JSON 備份與雲端紀錄。','note'));
 }
}
select.addEventListener('change',()=>{resetEditor();render()});
if(isOrder){
 $('chance-stage-cancel').onclick=resetEditor;
 form.addEventListener('submit',e=>{
  e.preventDefault();const row=getSelected();if(!row)return;
  const label=$('chance-stage-label').value.trim(),planned=Number($('chance-stage-planned').value),received=Number($('chance-stage-received').value),due=$('chance-stage-due').value;
  if(!label||![planned,received].every(Number.isFinite)||planned<0||received<0||planned>1e12||received>1e12){show('請填有效的付款階段及非負金額',true);return}
  let stages=[...(row._payments||[])];
  if(!stages.length&&Number(row.paid)>0)stages.push({_id:'legacy-'+String(row._id).slice(0,60),label:'既有累計已收',planned:0,received:Number(row.paid),due:'',at:new Date().toISOString()});
  if(!editingStage&&stages.length>=200){show('每單最多 200 期，請先匯出備份',true);return}
  const item={_id:editingStage||crypto.randomUUID(),label,planned,received,due,at:new Date().toISOString()};
  if(editingStage)stages=stages.map(p=>p._id===editingStage?item:p);else stages.push(item);
  if(stages.reduce((sum,p)=>sum+Number(p.received||0),0)>1e12){show('累計已收超過可保存數值上限',true);return}
  if(store.updateStructured(row._id,{_payments:stages})){resetEditor();show('分期明細及累計已收已更新')}else show('儲存失敗，原本資料已保留',true);
 });
}else{
 form.addEventListener('submit',e=>{
  e.preventDefault();const row=getSelected();if(!row)return;
  const delta=Number($('chance-stock-delta').value),reason=$('chance-stock-reason').value.trim(),stock=Number(row.stock)+delta;
  if(!Number.isInteger(delta)||delta===0||!Number.isFinite(stock)||stock<0||stock>1e12||!reason){show('請填寫有效整數增減量和異動原因，實存不得小於零',true);return}
  const history=row._movements||[];if(history.length>=500){show('本 SKU 已達 500 筆異動上限，請先匯出 JSON 備份',true);return}
  const updated=[...history,{at:new Date().toISOString(),reason,stockBefore:Number(row.stock)||0,stockAfter:stock,reservedBefore:Number(row.reserved)||0,reservedAfter:Number(row.reserved)||0}];
  if(store.updateStructured(row._id,{stock,reserved:row.reserved,_movements:updated})){form.reset();show('已更新實存與異動紀錄')}else show('儲存失敗，原本資料已保留',true);
 });
}
window.addEventListener('chance:change',e=>{if(e.detail?.slug===C.slug)refreshSelect()});
refreshSelect();
})();