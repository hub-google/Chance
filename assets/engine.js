(function(){
'use strict';
const C=window.CHANCE_APP;

// Optional industry-specific data, kept backward compatible with existing CSV and JSON.
const CHANCE_EXTRA_FIELDS={
 invoice:[['proofRef','驗收／交付證據連結','text',null,{optional:true}],['acceptanceDate','實際驗收日期','date',null,{optional:true}],['memo','追款與交付備註','text',null,{optional:true}]],
 orders:[['production','製作進度','select','規格確認中|製作中|待交付|已交付',{optional:true}],['deposit','本單訂金（NT$）','number',null,{optional:true}],['notes','交付與停工條款備註','text',null,{optional:true}]],
 inventory:[['unitCost','每包成本（NT$）','number',null,{optional:true}],['location','庫存所在地點','text',null,{optional:true}],['supplier','供應商代稱','text',null,{optional:true}]],
 saas:[['owner','訂閱負責人','text',null,{optional:true}],['vendor','採購／管理單位','text',null,{optional:true}]],
 filter:[['technician','本次保養人員','text',null,{optional:true}],['evidenceRef','履約照片／驗收證據連結','text',null,{optional:true}],['notes','保養備註','text',null,{optional:true}]],
 chargeback:[['proofRef','證據資料夾連結','text',null,{optional:true}],['submittedAt','提交日期','date',null,{optional:true}],['notes','理由碼／時序備註','text',null,{optional:true}]],
 contract:[['invoiceRef','核銷文件參考編號','text',null,{optional:true}],['contractNote','派工備註','text',null,{optional:true}]],
 shortstay:[['platform','訂房平台','text',null,{optional:true}],['tax','該筆稅費（NT$）','number',null,{optional:true}]],
 parking:[['siteLocation','現勘地址／備註','text',null,{optional:true}],['fieldNotes','現勘觀察','text',null,{optional:true}]],
 laundry:[['machines','設備台數','number',null,{optional:true}],['machineNotes','設備年份／維修備註','text',null,{optional:true}]]
};
for(const f of CHANCE_EXTRA_FIELDS[C?.kind]||[]){if(!C.fields.some(existing=>existing[0]===f[0]))C.fields.push(f)}
if(!C){document.body.textContent='Configuration missing';return;}
const q=id=>document.getElementById(id),nf=new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}),today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const num=(r,k)=>{const v=Number(r[k]);return Number.isFinite(v)?v:0},money=n=>'NT$ '+nf.format(Math.round(n)),digits=n=>nf.format(Math.round(n*100)/100);
const validDate=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const d=new Date(value+'T12:00:00');return Number.isFinite(d.getTime())&&d.getFullYear()===Number(value.slice(0,4))&&d.getMonth()+1===Number(value.slice(5,7))&&d.getDate()===Number(value.slice(8,10))};
const days=date=>{if(!validDate(date))return NaN;const t=new Date(date+'T12:00:00');const now=new Date();now.setHours(12,0,0,0);return Math.round((t-now)/86400000)};
const addDays=(d,n)=>{const v=new Date(d+'T12:00:00');if(!Number.isFinite(v.getTime()))return '';v.setDate(v.getDate()+n);return v.getFullYear()+'-'+String(v.getMonth()+1).padStart(2,'0')+'-'+String(v.getDate()).padStart(2,'0')};
const flat=(v)=>String(v??''),text=(tag,content,cls)=>{const el=document.createElement(tag);el.textContent=flat(content);if(cls)el.className=cls;return el};
const fieldOf=k=>C.fields.find(f=>f[0]===k);
function compute(r,all){
 let a=0,b=0,flag='good',label='正常',detail='';
 const red=(name)=>{flag='bad';label=name};
 const yellow=name=>{if(flag!=='bad'){flag='warn';label=name}};
 const due=(date,warningDays=7)=>{let d=days(date);if(Number.isFinite(d)){if(d<0)red('已逾期');else if(d<=warningDays)yellow('即將到期')}};
 switch(C.kind){
 case 'invoice': a=Math.max(0,num(r,'amount')-num(r,'paid'));b=num(r,'amount');detail='未收 '+money(a);if(a>0&&r.status!=='已取消')due(r.due);if(a===0)label='已收齊';if(r.status==='已取消'){label='已取消';flag='warn'}break;
 case 'orders': a=Math.max(0,num(r,'total')-num(r,'paid'));b=num(r,'total');detail='待收 '+money(a);if(a===0&&r.approved==='是'){label='可交付'}else{label='暫不可交付';flag='warn';if(a>0)due(r.due)}break;
 case 'inventory': {const available=num(r,'stock')-num(r,'reserved'),per=num(r,'perCase');a=available;b=num(r,'stock');detail='可售整箱 '+(per>0?Math.floor(Math.max(0,available)/per):'—')+' 箱';if(per<=0||available<0)red('換算異常');else if(available<=num(r,'threshold'))yellow('低庫存');break;}
 case 'saas': {const waste=Math.max(0,num(r,'seats')-num(r,'active'))*num(r,'price');a=waste;b=num(r,'seats')*num(r,'price');detail='閒置月費 '+money(waste);if(num(r,'active')>num(r,'seats'))red('席次錯誤');else if(waste>0)yellow('閒置席次');due(r.renew,num(r,'notice'));break;}
 case 'filter':{const next=addDays(r.last,num(r,'interval'));a=Number.isFinite(days(next))?days(next):0;b=1;detail='下次保養 '+(next||'未設定');if(num(r,'interval')<=0)red('週期錯誤');else due(next);break;}
 case 'chargeback':{const keys=['invoice','delivery','communication','policy'];const done=keys.filter(k=>r[k]==='已整理').length;a=done/4*100;b=num(r,'amount');detail='已整理 '+done+'/4 項 ('+digits(a)+'%)';if(done===4)label='材料齊備（待覆核）';else yellow('證據未齊');due(r.due);break;}
 case 'contract':{const subset=all.filter(x=>flat(x.contract)===flat(r.contract));const cap=Math.max(0,...subset.map(x=>num(x,'cap'))),used=subset.reduce((sum,x)=>sum+num(x,'spent')+num(x,'pending'),0);a=cap-used;b=cap;detail='合約剩餘 '+money(a);if(a<0)red('超出額度');else if(cap>0&&a/cap<=.1)yellow('額度不足');if(r.status!=='已完成')due(r.due);break;}
 case 'shortstay': {const gross=num(r,'nights')*num(r,'rate')+num(r,'cleanCharge');const fee=Math.min(100,Math.max(0,num(r,'fee')));a=gross*(1-fee/100)-num(r,'cleanCost')-num(r,'other')-num(r,'tax');b=gross;detail='每晚淨收益 '+money(num(r,'nights')>0?a/num(r,'nights'):0);if(a<0)red('虧損');else if(num(r,'nights')<=0)red('晚數錯誤');break;}
 case 'parking': {const revenue=num(r,'spots')*num(r,'rate')*num(r,'hours')*(num(r,'occupancy')/100)*30;a=revenue-num(r,'rent')-num(r,'ops')-num(r,'royalty')/12;b=num(r,'invest')>0?a*12/num(r,'invest')*100:0;detail='年化投資報酬 '+digits(b)+'%（假設）';if(num(r,'occupancy')>100||num(r,'hours')>24)red('輸入異常');else if(a<0)red('月虧損');break;}
 case 'laundry': {const revenue=num(r,'washCount')*num(r,'washPrice')+num(r,'dryCount')*num(r,'dryPrice');a=revenue-num(r,'rent')-num(r,'utility')-num(r,'repair');b=a>0?num(r,'buy')/a:0;const depreciation=num(r,'life')>0?num(r,'buy')/(num(r,'life')*12):0;detail='回本 '+(a>0?digits(b)+' 個月':'無法回本')+'；折舊後月利 '+money(a-depreciation);if(a<=0)red('現金流為負');break;}
 }
 return{a,b,flag,label,detail};
}
const key='chance-products:'+C.slug+':v1';let rows=[];try{const got=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(got))rows=got.filter(x=>x&&typeof x==='object').slice(0,5000)}catch(e){}
let activeId=null,term='';
function persist(){try{localStorage.setItem(key,JSON.stringify(rows));window.dispatchEvent(new CustomEvent('chance:change',{detail:{slug:C.slug,count:rows.length}}));return true}catch(e){toast('無法儲存，請確認瀏覽器容量或隱私模式');return false}}
function toast(msg){q('toast').textContent=msg;q('toast').classList.add('visible');setTimeout(()=>q('toast').classList.remove('visible'),4000)}
function recalc(){const c=rows.map(r=>compute(r,rows));const total=c.reduce((s,v)=>s+v.a,0),danger=c.filter(v=>v.flag!=='good').length;
[['metric-count',nf.format(rows.length)],['metric-primary',C.kind==='chargeback'?digits(rows.length?total/rows.length:0)+'%':C.kind==='filter'?nf.format(c.filter(v=>v.flag==='bad').length)+' 台':C.kind==='inventory'?nf.format(total)+' 包':(C.kind==='parking'?'NT$ ':C.kind==='laundry'?'NT$ ':'NT$ ')+nf.format(Math.round(total))],['metric-alert',nf.format(danger)],['metric-storage','本機瀏覽器']].forEach(([id,value])=>q(id).textContent=value);
q('primary-caption').textContent=C.kind==='chargeback'?'平均證據完成率':C.kind==='filter'?'逾期設備數':C.kind==='inventory'?'可售單包合計':C.kind==='saas'?'每月閒置成本':C.kind==='orders'?'未收尾款合計':C.kind==='invoice'?'待收款合計':C.kind==='contract'?'各派工重複計算的剩餘額度＊':C.kind==='parking'?'各標的月淨利總計':C.kind==='laundry'?'各標的月現金流合計':'訂單淨收益合計';
 if(C.kind==='contract'){const by=new Map();rows.forEach(r=>{if(!by.has(r.contract))by.set(r.contract,1)});const totalContract=[...by.keys()].reduce((sum,contract)=>{const arr=rows.filter(r=>r.contract===contract);return sum+Math.max(0,...arr.map(r=>num(r,'cap')))-arr.reduce((s,r)=>s+num(r,'spent')+num(r,'pending'),0)},0);q('metric-primary').textContent=money(totalContract);q('primary-caption').textContent='全部契約剩餘額合計';}
 const wrap=q('records');wrap.replaceChildren();const show=rows.filter(r=>C.fields.some(f=>flat(r[f[0]]).toLowerCase().includes(term)));q('result-count').textContent='顯示 '+show.length+' / '+rows.length+' 筆';
 if(!show.length){wrap.append(text('div',rows.length?'找不到符合條件的資料':'尚無資料。點擊「新增紀錄」開始使用。','empty'));return}
 const table=document.createElement('table'),thead=document.createElement('thead'),head=document.createElement('tr');
 [...C.fields.slice(0,3).map(f=>f[1]),'計算結果','狀態','操作'].forEach(h=>head.append(text('th',h)));thead.append(head);table.append(thead);
 const tb=document.createElement('tbody');
 show.forEach(r=>{const result=compute(r,rows),tr=document.createElement('tr');
 C.fields.slice(0,3).forEach(f=>tr.append(text('td',f[2]==='number'?nf.format(num(r,f[0])):r[f[0]])));
 tr.append(text('td',result.detail));const state=document.createElement('td');state.append(text('span',result.label,'pill '+result.flag));tr.append(state);
 const ops=document.createElement('td');ops.className='actions';
 [['編輯','edit'],['刪除','delete']].forEach(([label,action])=>{const btn=text('button',label,'btn'+(action==='delete'?' danger':''));btn.type='button';btn.dataset.id=r._id;btn.dataset.action=action;ops.append(btn)});tr.append(ops);tb.append(tr)});
 table.append(tb);wrap.append(table);
}
function openEditor(id){const r=rows.find(v=>v._id===id)||{};activeId=id||null;q('form-title').textContent=id?'編輯紀錄':'新增紀錄';const body=q('fields');body.replaceChildren();
 C.fields.forEach((f)=>{const [k,label,kind,options]=f;const wrap=document.createElement('div');wrap.className='field';const lab=text('label',label);lab.htmlFor='field-'+k;wrap.append(lab);let control;if(kind==='select'){control=document.createElement('select');(options||'').split('|').forEach(o=>{let op=document.createElement('option');op.textContent=o;op.value=o;control.append(op)})}else{control=document.createElement('input');control.type=kind==='number'?'number':kind==='date'?'date':'text';if(kind==='number'){control.step='any';control.min='0'}else if(kind==='text'){control.maxLength=140}}
 control.id='field-'+k;control.name=k;control.required=!f[4]?.optional;control.value=r[k]??(kind==='number'?'0':kind==='select'?(options||'').split('|')[0]:'');if(C.kind==='orders'&&k==='paid'&&r._payments?.length){control.readOnly=true;wrap.append(text('p','已啟用獨立分期管理，累計已收由分期明細加總。','note'))}wrap.append(control);body.append(wrap)});
 q('dialog').showModal();const first=body.querySelector('input,select');if(first)first.focus();
}
function clean(raw){const out={};C.fields.forEach(([k,,kind,opts])=>{let v=raw[k];if(kind==='number'){v=Number(v);v=Number.isFinite(v)?Math.max(0,Math.min(v,1e12)):0}else if(kind==='select'){v=(opts||'').split('|').includes(v)?v:(opts||'').split('|')[0]}else if(kind==='date'){v=validDate(v)?v:''}else{v=flat(v).trim().slice(0,140)}out[k]=v});return out}
// Structured PRD data is retained by both JSON backup and cloud document restore.
const finiteAmount=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=1e12?n:0};
function structuredExtras(x){
 if(C.kind==='orders'&&x._payments!==undefined){
  if(!Array.isArray(x._payments)||x._payments.length>200)throw Error('分期明細格式或筆數不正確');
  return {_payments:x._payments.map((p,i)=>({_id:flat(p._id||('stage-'+i)).slice(0,100),label:flat(p.label||'第 '+(i+1)+' 期').slice(0,80),planned:finiteAmount(p.planned),received:finiteAmount(p.received),due:validDate(p.due)?p.due:'',at:flat(p.at||'').slice(0,35)}))};
 }
 if(C.kind==='filter'&&x._workOrders!==undefined){
  if(!Array.isArray(x._workOrders)||x._workOrders.length>100)throw Error('設備派工記錄格式或筆數不正確');
  const allowed=['已指派','執行中','已完成','已取消'];
  const orders=x._workOrders.map((job,i)=>{
   if(!job||typeof job!=='object'||Array.isArray(job))throw Error('第 '+(i+1)+' 筆派工格式錯誤');
   const id=flat(job.id||'').trim().slice(0,100);
   const date=flat(job.scheduled||'').trim();
   const names=job.assignees;
   if(!id||!validDate(date)||!allowed.includes(job.status))throw Error('第 '+(i+1)+' 筆派工日期、編號或狀態不正確');
   if(!Array.isArray(names)||names.length<1||names.length>10)throw Error('第 '+(i+1)+' 筆派工需指定 1～10 位技師');
   const assignees=names.map(n=>flat(n).trim());
   if(assignees.some(n=>!n||n.length>40)||new Set(assignees).size!==assignees.length)throw Error('第 '+(i+1)+' 筆技師名稱有重複或異常');
   if(flat(job.note||'').length>160)throw Error('第 '+(i+1)+' 筆派工備註超長');
   return {id,scheduled:date,assignees,status:job.status,note:flat(job.note||'').trim().slice(0,160),
     createdAt:flat(job.createdAt||'').slice(0,35),updatedAt:flat(job.updatedAt||'').slice(0,35)};
  });
  if(new Set(orders.map(j=>j.id)).size!==orders.length)throw Error('派工編號重複');
  return {_workOrders:orders};
 }
 if(C.kind==='inventory'&&x._movements!==undefined){
  if(!Array.isArray(x._movements)||x._movements.length>500)throw Error('庫存異動明細格式或筆數不正確');
  return {_movements:x._movements.map(m=>({at:flat(m.at||'').slice(0,35),reason:flat(m.reason||'庫存調整').slice(0,120),stockBefore:finiteAmount(m.stockBefore),stockAfter:finiteAmount(m.stockAfter),reservedBefore:finiteAmount(m.reservedBefore),reservedAfter:finiteAmount(m.reservedAfter)}))};
 }
 return {};
}
function inventoryChange(before,after,reason){
 const history=Array.isArray(before._movements)?before._movements:[];
 if(history.length>=500)throw Error('此商品異動已達 500 筆上限，請先匯出 JSON 備份');
 const entry={at:new Date().toISOString(),reason,stockBefore:num(before,'stock'),stockAfter:num(after,'stock'),reservedBefore:num(before,'reserved'),reservedAfter:num(after,'reserved')};
 return {...after,_movements:[...history,entry]};
}
function validateImport(data,line){
 for(const [key,label,kind,opts,meta] of C.fields){
  const v=flat(data[key]).trim();
  if(!v){if(!meta?.optional)throw Error('第 '+line+' 列缺少必要欄位：'+label);continue}
  if(kind==='number'&&(!Number.isFinite(Number(v))||Number(v)<0||Number(v)>1e12))throw Error('第 '+line+' 列數值不正確：'+label);
  if(kind==='date'&&!validDate(v))throw Error('第 '+line+' 列日期不正確：'+label);
  if(kind==='select'&&!(opts||'').split('|').includes(v))throw Error('第 '+line+' 列選項不正確：'+label);
  if(kind==='text'&&v.length>140)throw Error('第 '+line+' 列文字超過 140 字：'+label);
 }
}
q('record-form').addEventListener('submit',e=>{e.preventDefault();const raw=Object.fromEntries(new FormData(e.target).entries());const cleaned=clean(raw);if(!cleaned[C.fields[0][0]]){toast('請填寫第一欄');return}
 const previous=rows;
 if(activeId){
  const original=rows.find(r=>r._id===activeId);
  if(C.kind==='inventory'&&original&&(num(original,'stock')!==num(cleaned,'stock')||num(original,'reserved')!==num(cleaned,'reserved'))&&original._movements?.length>=500){toast('已達 500 筆異動上限，請先備份');return}
  rows=rows.map(r=>{
   if(r._id!==activeId)return r;
   let updated={...r,...cleaned,_updated:new Date().toISOString()};
   if(C.kind==='orders'&&r._payments?.length)updated.paid=r._payments.reduce((sum,p)=>sum+finiteAmount(p.received),0);
   if(C.kind==='inventory'&&(num(r,'stock')!==num(updated,'stock')||num(r,'reserved')!==num(updated,'reserved')))updated=inventoryChange(r,updated,'直接編輯庫存紀錄');
   return updated;
  });
 }else{
  if(rows.length>=5000){toast('已達 5,000 筆上限，請先備份並整理資料');return}
  let created={_id:(globalThis.crypto&&crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random()),_updated:new Date().toISOString(),...cleaned};
  if(C.kind==='inventory')created=inventoryChange({stock:0,reserved:0,_movements:[]},created,'建立庫存紀錄');
  rows=[created,...rows];
 }
 if(!persist()){rows=previous;recalc();return}
 q('dialog').close();recalc();toast('已儲存');});
q('records').addEventListener('click',e=>{const btn=e.target.closest('button[data-action]');if(!btn)return;if(btn.dataset.action==='edit')openEditor(btn.dataset.id);else if(confirm('確定刪除這筆資料？刪除後需使用備份才能復原。')){{const previous=rows;rows=rows.filter(r=>r._id!==btn.dataset.id);if(!persist())rows=previous;recalc()}}});
q('add').addEventListener('click',()=>openEditor(null));q('cancel').addEventListener('click',()=>q('dialog').close());q('search').addEventListener('input',e=>{term=e.target.value.trim().toLowerCase();recalc()});
function download(filename,str,type){const url=URL.createObjectURL(new Blob([str],{type}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)}
function csvCell(v){const source=flat(v);const safe=/^\s*[=+@-]/.test(source)?"'"+source:source;return '"'+safe.replace(/"/g,'""')+'"'}
q('export-csv').addEventListener('click',()=>{const header=[...C.fields.map(f=>f[1]),'計算結果','狀態'];const data=rows.map(r=>{const calc=compute(r,rows);return[...C.fields.map(f=>r[f[0]]),calc.detail,calc.label]});download(C.slug+'-'+today()+'.csv','\ufeff'+[header,...data].map(arr=>arr.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');});

function parseCSV(raw){
 const input=raw.replace(/^\uFEFF/,'');let out=[],row=[],field='',quoted=false;
 for(let i=0;i<input.length;i++){
  const ch=input[i];
  if(ch==='"'){if(quoted&&input[i+1]==='"'){field+='"';i++}else quoted=!quoted}
  else if(ch===','&&!quoted){row.push(field);field=''}
  else if((ch==='\r'||ch==='\n')&&!quoted){
   if(ch==='\r'&&input[i+1]==='\n')i++;
   row.push(field);if(row.some(v=>v.trim()!==''))out.push(row);
   row=[];field='';
  }else field+=ch;
 }
 if(quoted)throw Error('CSV 格式錯誤：引號尚未結束');
 row.push(field);if(row.some(v=>v.trim()!==''))out.push(row);
 return out;
}
const csvControl=document.createElement('input');csvControl.type='file';csvControl.id='csv-import';csvControl.accept='.csv,text/csv';csvControl.hidden=true;
const csvLabel=text('label','匯入 CSV','btn');csvLabel.htmlFor='csv-import';
const tools=q('export-csv').parentNode;tools.insertBefore(csvLabel,q('export-csv'));tools.insertBefore(csvControl,q('export-csv'));
csvControl.addEventListener('change',async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{
  if(file.size>5*1024*1024)throw Error('CSV 檔案超過 5MB 上限');
  const parsed=parseCSV(await file.text());
  if(parsed.length<2)throw Error('CSV 需要標題列與至少一筆紀錄');
  const head=parsed.shift().map(v=>v.trim());
  const indices=C.fields.map(f=>head.includes(f[0])?head.indexOf(f[0]):head.indexOf(f[1]));
  if(indices.some((v,i)=>v<0&&!C.fields[i][4]?.optional))throw Error('CSV 缺少必要欄位：'+C.fields.filter((f,i)=>indices[i]<0&&!f[4]?.optional).map(f=>f[1]).join('、'));
  const imported=parsed.map((record,i)=>{
    const data={};C.fields.forEach((f,j)=>data[f[0]]=record[indices[j]]??'');
    validateImport(data,i+2);
     const cleaned=clean(data);
     return {_id:crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random(),_updated:new Date().toISOString(),...cleaned};
  });
  if(rows.length+imported.length>5000)throw Error('超過總共 5,000 筆的限制，請拆分資料或先匯出備份');
  if(!confirm('即將追加 '+imported.length+' 筆紀錄（不刪除原本 '+rows.length+' 筆）。確定匯入？'))return;
  const original=rows;rows=[...imported.reverse(),...rows];
  if(!persist()){rows=original;recalc();return}
  recalc();toast('成功匯入 '+imported.length+' 筆資料');
 }catch(error){toast('CSV 匯入失敗：'+error.message)}
 finally{event.target.value=''}
});

q('backup').addEventListener('click',()=>download(C.slug+'-backup-'+today()+'.json',JSON.stringify({schema:1,app:C.slug,exportedAt:new Date().toISOString(),records:rows},null,2),'application/json'));
q('restore').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{
 if(file.size>5e6)throw Error('檔案太大');
 const obj=JSON.parse(await file.text());
 if(obj.app!==C.slug||!Array.isArray(obj.records)||obj.records.length>5000)throw Error('備份格式或產品不符');
 const imported=obj.records.map((x,i)=>{if(!x||typeof x!=='object'||Array.isArray(x))throw Error('第 '+(i+1)+' 筆備份格式不正確');validateImport(x,i+1);return {...clean(x),...structuredExtras(x),_id:flat(x._id||('import-'+i)).slice(0,150),_updated:flat(x._updated||new Date().toISOString()).slice(0,60)}});
 if(new Set(imported.map(r=>r._id)).size!==imported.length)throw Error('備份包含重複的紀錄編號');
 if(!confirm('匯入將取代本產品目前的 '+rows.length+' 筆紀錄，確定嗎？'))return;
 const previous=rows;rows=imported;if(!persist()){rows=previous;recalc();return}
 recalc();toast('已還原 '+rows.length+' 筆紀錄')
 }catch(err){toast('匯入失敗：'+err.message)}finally{e.target.value=''}
});
q('print').addEventListener('click',()=>window.print());
q('app-title').textContent=C.name;document.title=C.name+'｜Chance';q('app-lead').textContent=C.pain;q('app-source').textContent='來源編號 '+C.id+'｜建議售價 '+C.price+'，並非實際收費';q('app-description').textContent=C.scope;
window.ChanceLocal=Object.freeze({
  slug:C.slug,
  read:()=>JSON.parse(JSON.stringify(rows)),
  count:()=>rows.length,
  updateStructured:(id,changes)=>{
    const old=rows.find(r=>r._id===id);if(!old)return false;
    let next={...old,_updated:new Date().toISOString()};
    try{
      if(C.kind==='orders'&&changes._payments){const p=structuredExtras({_payments:changes._payments})._payments;next={...next,_payments:p,paid:p.reduce((sum,v)=>sum+v.received,0)}}
      else if(C.kind==='inventory'&&changes._movements){next={...next,stock:finiteAmount(changes.stock),reserved:finiteAmount(changes.reserved),...structuredExtras({_movements:changes._movements})}}
      else if(C.kind==='filter'&&Array.isArray(changes._workOrders)){next={...next,...structuredExtras({_workOrders:changes._workOrders})}}
      else return false;
    }catch(e){toast(e.message);return false}
    const prior=rows;rows=rows.map(r=>r._id===id?next:r);
    if(!persist()){rows=prior;recalc();return false}
    recalc();return true;
  },
  replace:incoming=>{
    if(!Array.isArray(incoming)||incoming.length>5000)return false;
    let updated;
     try{updated=incoming.map((x,i)=>{if(!x||typeof x!=='object'||Array.isArray(x))throw Error('格式錯誤');validateImport(x,i+1);return {...clean(x),...structuredExtras(x),_id:flat(x._id||('import-'+i)).slice(0,150),_updated:flat(x._updated||new Date().toISOString()).slice(0,60)}})}catch{return false}
     if(new Set(updated.map(r=>r._id)).size!==updated.length)return false;
     const prior=rows;rows=updated;
    if(!persist()){rows=prior;return false}
    recalc();return true;
  }
});
if(C.kind==='orders'||C.kind==='inventory'){const workflowScript=document.createElement('script');workflowScript.src='../assets/workflows.js';workflowScript.defer=true;document.head.append(workflowScript)}
if(C.kind==='filter'){const dispatchScript=document.createElement('script');dispatchScript.src='../assets/filter-dispatch.js';dispatchScript.defer=true;document.head.append(dispatchScript)}
const insightScript=document.createElement('script');insightScript.src='../assets/insights.js';insightScript.defer=true;document.head.append(insightScript);
const remindersScript=document.createElement('script');remindersScript.src='../assets/reminders.js';remindersScript.defer=true;document.head.append(remindersScript);
const cloudScript=document.createElement('script');cloudScript.src='../assets/cloud.js';cloudScript.defer=true;document.head.append(cloudScript);
recalc();
})();