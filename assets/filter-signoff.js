(()=>{
'use strict';
const app=window.CHANCE_APP,store=window.ChanceLocal;
if(app?.kind!=='filter'||!store?.updateStructured)return;
const panel=document.createElement('section');panel.className='panel chance-filter-signoff';
panel.innerHTML=[
 '<h2>客戶現場數位簽收</h2>',
 '<p class="note">只有狀態為「已完成」的派工可簽收。請讓客戶本人在現場使用此裝置手寫確認，記錄簽收名稱、時間及當時的設備／派工內容。這是可編輯的內部履約紀錄，非經身分認證的法律電子簽章。請勿輸入身分證號或付款資料。</p>',
 '<div class="field"><label for="chance-signoff-job">選擇已完成派工</label><select id="chance-signoff-job"></select></div>',
 '<p id="chance-signoff-job-info" class="note"></p>',
 '<form id="chance-signoff-form">',
 '<div class="field"><label for="chance-signoff-name">現場簽收人姓名或稱呼</label><input id="chance-signoff-name" maxlength="80" required autocomplete="off"></div>',
 '<div class="field"><label for="chance-signoff-canvas">手寫簽名（滑鼠或觸控書寫）</label></div>',
 '<div><canvas id="chance-signoff-canvas" width="600" height="180" aria-label="手寫簽名區域" style="display:block;box-sizing:border-box;width:100%;max-width:600px;aspect-ratio:10 / 3;touch-action:none;border:1px solid #bcc4cb;border-radius:8px;background:#fff"></canvas></div>',
 '<div class="tools"><button id="chance-signoff-clear" class="btn" type="button">清除筆跡</button></div>',
 '<label class="note" style="display:flex;gap:8px;align-items:center;margin:10px 0"><input type="checkbox" id="chance-signoff-ack" required>本人已核對本次設備保養工作，並同意以此筆跡作為現場簽收紀錄</label>',
 '<div class="tools"><button id="chance-signoff-save" class="btn primary" type="submit">確認現場簽收</button><button id="chance-signoff-revoke" class="btn danger" type="button" hidden>撤銷原簽收</button></div>',
 '</form>',
 '<p id="chance-signoff-state" class="note"></p>',
 '<p id="chance-signoff-feedback" role="status" aria-live="polite" class="note"></p>'
].join('');
const anchor=document.querySelector('main .chance-filter-dispatch')||document.querySelector('main .chance-reminders')||document.querySelector('main .chance-analysis');
if(anchor)anchor.after(panel);else document.querySelector('main')?.append(panel);
const $=id=>panel.querySelector('#'+id);
const select=$('chance-signoff-job'),form=$('chance-signoff-form'),canvas=$('chance-signoff-canvas');
const ctx=canvas.getContext('2d');
const formName=$('chance-signoff-name'),ack=$('chance-signoff-ack'),clear=$('chance-signoff-clear'),save=$('chance-signoff-save'),revoke=$('chance-signoff-revoke');
const state=$('chance-signoff-state'),info=$('chance-signoff-job-info');
let strokes=[],activeStroke=null,activePointer=null;
function message(msg,error=false){const el=$('chance-signoff-feedback');el.textContent=msg;el.style.color=error?'#b94136':'#087659'}
function selected(){
 try{
  const [rid,jid]=JSON.parse(select.value);
  const record=store.read().find(r=>r._id===rid);
  const job=record?._workOrders?.find(w=>w.id===jid);
  return {record,job};
 }catch{return {record:null,job:null}}
}
function options(){
 const last=select.value;select.replaceChildren();
 for(const row of store.read()){
  for(const job of row._workOrders||[]){
   const opt=document.createElement('option');
   opt.value=JSON.stringify([row._id,job.id]);
   opt.textContent=String(row.site||'未命名據點').slice(0,35)+'｜'+String(row.device||'未命名設備').slice(0,35)+'｜'+job.scheduled+'｜'+job.status;
   select.append(opt);
  }
 }
 if([...select.options].some(o=>o.value===last))select.value=last;
 render();
}
function redraw(){
 ctx.clearRect(0,0,canvas.width,canvas.height);ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#152c42';ctx.lineWidth=2.8;
 for(const stroke of strokes){
  if(!stroke.length)continue;
  ctx.beginPath();
  const first=stroke[0];ctx.moveTo(first[0]*canvas.width/1000,first[1]*canvas.height/1000);
  if(stroke.length===1){ctx.lineTo((first[0]*canvas.width/1000)+.1,(first[1]*canvas.height/1000)+.1)}
  else for(const p of stroke.slice(1))ctx.lineTo(p[0]*canvas.width/1000,p[1]*canvas.height/1000);
  ctx.stroke();
 }
}
function render(){
 const {record,job}=selected();
 activeStroke=null;activePointer=null;
 const available=!!job,complete=job?.status==='已完成',signed=!!job?.signoff;
 info.textContent=!available?'尚未有派工紀錄。請先在多技師保養派工建立工作。':
  '設備：'+String(record.site||'')+'／'+String(record.device||'')+'｜日期：'+job.scheduled+'｜技師：'+job.assignees.join('、')+'｜狀態：'+job.status;
 strokes=signed?JSON.parse(JSON.stringify(job.signoff.strokes)):[];
 redraw();
 formName.value=signed?job.signoff.signer:'';
 ack.checked=signed;ack.disabled=!available||signed||!complete;formName.readOnly=signed;
 save.disabled=!available||!complete||signed;
 clear.disabled=!available||!complete||signed;
 revoke.hidden=!signed;revoke.disabled=!signed;
 canvas.style.cursor=(!complete||signed)?'not-allowed':'crosshair';
 state.textContent=signed?
  '已現場簽收：'+job.signoff.signer+'｜'+new Date(job.signoff.signedAt).toLocaleString('zh-TW')+'。簽收時的設備與派工資料隨紀錄保存；如需修改已簽收派工，須先撤銷簽收。':
  !available?'':complete?'尚未簽收，請由現場客戶本人書寫並確認。':'這筆派工尚未完成，請先在派工管理更新為「已完成」。';
}
function locationOf(event){
 const rect=canvas.getBoundingClientRect();
 const x=Math.round((event.clientX-rect.left)/rect.width*1000),y=Math.round((event.clientY-rect.top)/rect.height*1000);
 return [Math.max(0,Math.min(1000,x)),Math.max(0,Math.min(1000,y))];
}
canvas.addEventListener('pointerdown',e=>{
 const {job}=selected();
 if(job?.status!=='已完成'||job.signoff||strokes.length>=15||activePointer!==null)return;
 activePointer=e.pointerId;activeStroke=[locationOf(e)];strokes.push(activeStroke);
 canvas.setPointerCapture(e.pointerId);e.preventDefault();redraw();
});
canvas.addEventListener('pointermove',e=>{
 if(activePointer!==e.pointerId||!activeStroke)return;
 const total=strokes.reduce((sum,v)=>sum+v.length,0);
 if(total>=900)return;
 const point=locationOf(e),prev=activeStroke[activeStroke.length-1];
 if(Math.abs(point[0]-prev[0])+Math.abs(point[1]-prev[1])<3)return;
 activeStroke.push(point);redraw();e.preventDefault();
});
function pointerEnd(e){if(activePointer===e.pointerId){activePointer=null;activeStroke=null}}
canvas.addEventListener('pointerup',pointerEnd);
canvas.addEventListener('pointercancel',pointerEnd);
clear.onclick=()=>{strokes=[];redraw();message('已清除手寫筆跡。')};
select.onchange=()=>{render();message('')};
form.addEventListener('submit',e=>{
 e.preventDefault();const {record,job}=selected();
 if(!job||job.status!=='已完成'||job.signoff){message('只能對尚未簽收的已完成派工簽收。',true);return}
 const signer=formName.value.trim();
 if(!signer||signer.length>80||!ack.checked||!strokes.length||!strokes.some(s=>s.length>1)){
  message('請填寫簽收人、現場手寫簽名，並勾選確認。',true);return
 }
 const signoff={signer,signedAt:new Date().toISOString(),acknowledged:true,
  strokes:JSON.parse(JSON.stringify(strokes)),snapshot:{
   site:String(record.site||'').slice(0,140),device:String(record.device||'').slice(0,140),
   filter:String(record.filter||'').slice(0,140),batch:String(record.batch||'').slice(0,140),
   scheduled:job.scheduled,note:String(job.note||'').slice(0,160),assignees:[...job.assignees]
  }};
 const updated=record._workOrders.map(w=>w.id===job.id?{...w,signoff}:w);
 if(store.updateStructured(record._id,{_workOrders:updated})){
  message('現場簽收已保存於這筆派工紀錄。此紀錄未驗證簽收人法律身分。');
 }else message('簽收保存失敗，請重試；原本資料未改變。',true);
});
revoke.onclick=()=>{
 const {record,job}=selected();if(!job?.signoff)return;
 if(!confirm('撤銷「'+job.signoff.signer+'」的現場簽收？原筆跡會從本機派工紀錄刪除，請先備份。'))return;
 const updated=record._workOrders.map(w=>w.id===job.id?{...w,signoff:null,updatedAt:new Date().toISOString()}:w);
 if(store.updateStructured(record._id,{_workOrders:updated}))message('原簽收已撤銷，可重新由客戶現場簽收。');
 else message('撤銷失敗，原始簽收未變更。',true);
};
window.addEventListener('chance:change',e=>{if(e.detail?.slug===app.slug)options()});
options();
})();