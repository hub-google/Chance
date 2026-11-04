(() => {
'use strict';
const C=window.CHANCE_APP,store=window.ChanceLocal;
if(!C||!store)return;
const $=(sel,root=document)=>root.querySelector(sel);
const nf=new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2});
const num=(r,k)=>Math.max(0,Number(r[k])||0);
const cash=x=>'NT$ '+nf.format(Math.round(x*100)/100);
const txt=(tag,val,cls)=>{const node=document.createElement(tag);node.textContent=String(val??'');if(cls)node.className=cls;return node};
const fieldLabel=k=>C.fields.find(f=>f[0]===k)?.[1]||k;
const isoToday=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const dayDiff=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return NaN;const now=new Date(),end=new Date(d+'T12:00:00');now.setHours(12,0,0,0);return Math.round((end-now)/86400000)};
const after=(d,n)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return '';const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const nameKey={invoice:'project',orders:'order',inventory:'product',saas:'service',filter:'device',chargeback:'case',contract:'work',shortstay:'listing',parking:'lot',laundry:'shop'};
const descriptions={
 invoice:['應收與驗收報告','逐筆核對驗收、已收／未收款與到期日。此報告不構成法律證據或收款通知。'],
 orders:['訂製訂單與交付審核','分期款、訂金與製作階段一起核對；門檻不代表合法解除或延期交付權利。'],
 inventory:['箱包庫存稽核報告','將單包轉換為整箱、零包及庫存價值；未串接電商平台。'],
 saas:['軟體訂閱節費診斷','用月費及實際使用席次估算浪費並排續約次序；資料由使用者提供。'],
 filter:['飲水機履約保養紀錄','濾芯批號、維護週期、服務人員與佐證參考；不等同完成簽收或驗證。'],
 chargeback:['拒付案件整理清單','依已備妥的四種證據檢查缺口，不保證可申訴成功或替代支付商規定。'],
 contract:['公共工程派工額度核銷表','依契約代號彙總所有派工核銷與待核銷金額，供內部追蹤。'],
 shortstay:['短租每筆訂單損益表','住宿與清潔收入、平台費、支出及稅費分開列示，未包含未輸入的稅金。'],
 parking:['停車場標租投報與敏感度','以輸入參數比較不同利用率下的預估月營運損益；需實地車流驗證。'],
 laundry:['洗衣店頂讓回本與折舊報告','拆分營收、固定費用、折舊及低／高來客情境，不保證實際回本。']
};
const detail=(r,all)=>{
 const out=[],warn=[],push=(k,v)=>out.push([k,v]),warning=x=>warn.push(x);
 switch(C.kind){
 case 'invoice':{
  const remaining=Math.max(0,num(r,'amount')-num(r,'paid'));
  push('里程碑應收',cash(num(r,'amount')));push('已收款',cash(num(r,'paid')));push('未收款',cash(remaining));push('原定請款日',r.due||'未填');push('驗收狀態',r.status||'未填');
  push('交付證據參考',r.proofRef||'未填');push('實際驗收日期',r.acceptanceDate||'未填');
  if(remaining>0&&dayDiff(r.due)<0)warning('未收款已逾期，建議人工核對合約與對帳單。');
  if(remaining>0&&r.status!=='已驗收')warning('尚未完成驗收，需確認可否依約請款。');
  if(num(r,'paid')>num(r,'amount'))warning('已收款高於應收金額，應核對是否包含預收款。');
  break;
 }
 case 'orders':{
  const owed=Math.max(0,num(r,'total')-num(r,'paid'));
  push('合約總價',cash(num(r,'total')));push('訂金約定',cash(num(r,'deposit')));push('累計已收',cash(num(r,'paid')));push('待收尾款',cash(owed));push('製作進度',r.production||'未記錄');push('規格確認',r.approved||'未確認');
  if(owed>0)warning('尚有尾款，交付前需人工核對契約條款。');
  if(r.approved!=='是')warning('規格尚未標示確認。');
  if(num(r,'deposit')>num(r,'total'))warning('訂金高於訂單總價，請核對。');
  break;
 }
 case 'inventory':{
  const available=num(r,'stock')-num(r,'reserved'),pack=num(r,'perCase');
  push('實際單包',nf.format(num(r,'stock')));push('已保留單包',nf.format(num(r,'reserved')));push('可售單包',nf.format(available));
  push('可售整箱',pack>0?nf.format(Math.floor(Math.max(0,available)/pack)):'換算異常');
  push('剩餘零包',pack>0?nf.format(Math.max(0,available)%pack):'換算異常');
  push('可售成本估算',cash(Math.max(0,available)*num(r,'unitCost')));
  if(pack<=0||available<0)warning('箱包換算或保留庫存異常，須人工核對。');
  else if(available<=num(r,'threshold'))warning('低於或等於庫存警戒值。');
  break;
 }
 case 'saas':{
  const waste=Math.max(0,num(r,'seats')-num(r,'active'))*num(r,'price');
  push('訂閱席次',nf.format(num(r,'seats')));push('使用席次',nf.format(num(r,'active')));push('月訂閱成本',cash(num(r,'seats')*num(r,'price')));push('每月閒置成本',cash(waste));push('年度閒置成本',cash(waste*12));push('續約日期',r.renew||'未填');
  if(waste>0)warning('有可檢視的閒置席次，仍須核對合約最低採購量。');
  if(dayDiff(r.renew)<=num(r,'notice'))warning('已進入續約提醒區間或過期。');
  break;
 }
 case 'filter':{
  const next=after(r.last,num(r,'interval'));
  push('據點',r.site||'未填');push('濾芯型號',r.filter||'未填');push('濾芯批號',r.batch||'未填');push('下次保養日',next||'無法計算');
  push('維護人員',r.technician||'未填');push('履約證據參考',r.evidenceRef||'未填');
  if(dayDiff(next)<0)warning('設備保養已逾期，請安排現場處理。');
  if(!r.evidenceRef)warning('履約證據尚未提供參考連結；此報告並非簽收證明。');
  break;
 }
 case 'chargeback':{
  const keys=['invoice','delivery','communication','policy'];const done=keys.filter(k=>r[k]==='已整理');
  push('支付商',r.provider||'未填');push('爭議金額',cash(num(r,'amount')));push('理由碼',r.reason||'未填');push('證據完成度',done.length+'/4');
  push('缺少項目',keys.filter(k=>r[k]!=='已整理').map(fieldLabel).join('、')||'已標示全數整理');push('提交期限',r.due||'未填');push('證據資料夾',r.proofRef||'未填');
  if(dayDiff(r.due)<0)warning('已超過自行填寫的期限，應以支付商官方時間為準。');
  if(done.length<4)warning('請在正式提交前人工整理缺漏證據。');
  break;
 }
 case 'contract':{
  const group=all.filter(x=>String(x.contract||'')===String(r.contract||''));
  const cap=Math.max(0,...group.map(x=>num(x,'cap'))),used=group.reduce((s,x)=>s+num(x,'spent')+num(x,'pending'),0);
  push('契約代號',r.contract||'未填');push('核定額度',cash(cap));push('同契約已核銷及待核銷',cash(used));push('剩餘額度',cash(cap-used));
  push('額度使用率',cap?nf.format(used/cap*100)+'%':'無法計算');push('履約期限',r.due||'未填');push('本派工核銷文件',r.invoiceRef||'未填');
  if(used>cap)warning('此契約已逾核定額度，須人工核對。');
  if(!cap)warning('尚未填寫可用的契約核定額度。');
  break;
 }
 case 'shortstay':{
  const gross=num(r,'nights')*num(r,'rate')+num(r,'cleanCharge'),fee=gross*num(r,'fee')/100;
  const profit=gross-fee-num(r,'cleanCost')-num(r,'other')-num(r,'tax');
  push('房費收入',cash(num(r,'nights')*num(r,'rate')));push('收取清潔費',cash(num(r,'cleanCharge')));push('平台費',cash(fee));push('實際清潔成本',cash(num(r,'cleanCost')));push('稅費及其他',cash(num(r,'tax')+num(r,'other')));push('訂單淨收益',cash(profit));push('淨利率',gross?nf.format(profit/gross*100)+'%':'無法計算');
  if(profit<0)warning('此筆訂單的輸入數字為虧損。');
  if(num(r,'fee')>100)warning('平台費率高於100%，請更正原始資料。');
  break;
 }
 case 'parking':{
  const gross=num(r,'spots')*num(r,'rate')*num(r,'hours')*num(r,'occupancy')/100*30;
  const fixed=num(r,'rent')+num(r,'ops')+num(r,'royalty')/12;
  const profit=gross-fixed;
  const perPercent=num(r,'spots')*num(r,'rate')*num(r,'hours')*30/100;
  push('每月營收',cash(gross));push('每月固定及權利金成本',cash(fixed));push('每月預估淨利',cash(profit));push('年淨利',cash(profit*12));push('年化投資報酬',num(r,'invest')?nf.format(profit*12/num(r,'invest')*100)+'%':'未填投資額');
  push('損益兩平利用率',perPercent>0?nf.format(fixed/perPercent)+'%':'無法計算');
  push('利用率下降10百分點之月淨利',cash(Math.max(0,num(r,'occupancy')-10)*perPercent-fixed));
  if(profit<0)warning('按目前假設計算，月營運損益為負。');
  if(perPercent&&fixed/perPercent>100)warning('目前成本下即使100%利用率仍無法損益兩平。');
  break;
 }
 case 'laundry':{
  const wash=num(r,'washCount')*num(r,'washPrice'),dry=num(r,'dryCount')*num(r,'dryPrice'),cost=num(r,'rent')+num(r,'utility')+num(r,'repair'),profit=wash+dry-cost;
  const dep=num(r,'life')>0?num(r,'buy')/(12*num(r,'life')):0;
  push('洗衣月營收',cash(wash));push('烘衣月營收',cash(dry));push('每月成本',cash(cost));push('月現金流',cash(profit));push('每月折舊估算',cash(dep));push('折舊後月利',cash(profit-dep));
  push('現金流回本期',profit>0?nf.format(num(r,'buy')/profit)+' 個月':'無法回本');
  push('需求下降20%月現金流',cash((wash+dry)*0.8-cost));
  if(profit<=0)warning('在輸入的營收與成本下沒有正現金流。');
  if(profit>0&&num(r,'buy')/profit>12*num(r,'life'))warning('可能無法於設備剩餘使用年限內回本。');
  break;
 }
 }
 return {out,warn};
};
const box=document.createElement('section');box.className='panel chance-analysis';
const head=document.createElement('div');head.className='toolbar';
const title=document.createElement('div');title.append(txt('h2','產業專用分析與報告'),txt('p',descriptions[C.kind]?.[1]||'','note'));head.append(title);box.append(head);
const kpis=document.createElement('div');kpis.className='metrics analysis-metrics';box.append(kpis);
const summary=document.createElement('p');summary.className='note';box.append(summary);
const choices=document.createElement('div');choices.className='tools analysis-actions';
const select=document.createElement('select');select.setAttribute('aria-label','選擇報告紀錄');select.id='chance-report-select';
const button=document.createElement('button');button.className='btn primary';button.type='button';button.textContent='製作個別產業報告／存 PDF';
choices.append(select,button);box.append(choices);
const guide=document.createElement('details');guide.className='chance-guide';guide.innerHTML='<summary>新手教學與資料安全提醒</summary>';
const steps=document.createElement('ol');for(const line of ['先點「新增紀錄」建立真實資料，不會自動生成假數據。','在上方清單可修改、刪除或以 CSV／JSON 進行備份。','用此區產生產業分析報告，在列印視窗可選擇「儲存為 PDF」。','雲端備份需先登入，再手動上傳或還原；正式付費尚未啟用。'])steps.append(txt('li',line));
guide.append(steps);
const start=document.createElement('button');start.className='btn';start.type='button';start.textContent='開始建立第一筆';start.onclick=()=>{$('#add')?.click()};guide.append(start);
box.append(guide);
const main=document.querySelector('main'),anchor=main?.querySelector('.panel');if(anchor)anchor.before(box);else main?.append(box);
const report=document.createElement('dialog');report.id='chance-report-dialog';report.className='chance-report-dialog';
const paper=document.createElement('article');paper.id='chance-report';paper.className='chance-report-document';report.append(paper);
const actions=document.createElement('div');actions.className='formactions chance-report-actions';
const close=document.createElement('button');close.className='btn';close.textContent='關閉';close.type='button';close.onclick=()=>report.close();
const print=document.createElement('button');print.className='btn primary';print.textContent='列印／存成 PDF';print.type='button';print.onclick=()=>window.print();actions.append(close,print);report.append(actions);document.body.append(report);
function summaryKpis(rows){
 let result=[];
 switch(C.kind){
 case 'invoice':result=[['總應收',cash(rows.reduce((a,r)=>a+num(r,'amount'),0))],['尚未收',cash(rows.reduce((a,r)=>a+Math.max(0,num(r,'amount')-num(r,'paid')),0))],['逾期未收',nf.format(rows.filter(r=>num(r,'amount')>num(r,'paid')&&dayDiff(r.due)<0).length)+' 筆']];break;
 case 'orders':result=[['合約總額',cash(rows.reduce((a,r)=>a+num(r,'total'),0))],['待收尾款',cash(rows.reduce((a,r)=>a+Math.max(0,num(r,'total')-num(r,'paid')),0))],['可交付',nf.format(rows.filter(r=>num(r,'total')<=num(r,'paid')&&r.approved==='是').length)+' 筆']];break;
 case 'inventory':result=[['可售單包',nf.format(rows.reduce((a,r)=>a+Math.max(0,num(r,'stock')-num(r,'reserved')),0))],['可售整箱',nf.format(rows.reduce((a,r)=>a+(num(r,'perCase')?Math.floor(Math.max(0,num(r,'stock')-num(r,'reserved'))/num(r,'perCase')):0),0))],['庫存成本估算',cash(rows.reduce((a,r)=>a+num(r,'stock')*num(r,'unitCost'),0))]];break;
 case 'saas':{const waste=rows.reduce((a,r)=>a+Math.max(0,num(r,'seats')-num(r,'active'))*num(r,'price'),0);result=[['訂閱月成本',cash(rows.reduce((a,r)=>a+num(r,'seats')*num(r,'price'),0))],['閒置月成本',cash(waste)],['年度浪費估算',cash(waste*12)]];break;}
 case 'filter':result=[['設備數',rows.length+' 台'],['逾期設備',nf.format(rows.filter(r=>dayDiff(after(r.last,num(r,'interval')))<0).length)+' 台'],['七日內到期',nf.format(rows.filter(r=>{const n=dayDiff(after(r.last,num(r,'interval')));return n>=0&&n<=7}).length)+' 台']];break;
 case 'chargeback':result=[['爭議總金額',cash(rows.reduce((a,r)=>a+num(r,'amount'),0))],['資料完備案件',nf.format(rows.filter(r=>['invoice','delivery','communication','policy'].every(k=>r[k]==='已整理')).length)+' 件'],['期限將至／逾期',nf.format(rows.filter(r=>dayDiff(r.due)<=7).length)+' 件']];break;
 case 'contract':{const contracts=new Map();rows.forEach(r=>{if(!contracts.has(r.contract))contracts.set(r.contract,[]);contracts.get(r.contract).push(r)});let cap=0,used=0;for(const list of contracts.values()){cap+=Math.max(0,...list.map(x=>num(x,'cap')));used+=list.reduce((s,r)=>s+num(r,'spent')+num(r,'pending'),0)}result=[['全部契約上限',cash(cap)],['核銷與待核銷',cash(used)],['剩餘額度',cash(cap-used)]];break;}
 case 'shortstay':{let revenue=0,net=0,nights=0;rows.forEach(r=>{const g=num(r,'nights')*num(r,'rate')+num(r,'cleanCharge');revenue+=g;nights+=num(r,'nights');net+=g*(1-num(r,'fee')/100)-num(r,'cleanCost')-num(r,'other')-num(r,'tax')});result=[['房源訂單營收',cash(revenue)],['扣除費用淨收益',cash(net)],['平均每晚淨收益',cash(nights?net/nights:0)]];break;}
 case 'parking':{let revenue=0,profit=0;rows.forEach(r=>{const g=num(r,'spots')*num(r,'rate')*num(r,'hours')*num(r,'occupancy')/100*30;revenue+=g;profit+=g-num(r,'rent')-num(r,'ops')-num(r,'royalty')/12});result=[['月收入預估',cash(revenue)],['月淨利預估',cash(profit)],['年淨利預估',cash(profit*12)]];break;}
 case 'laundry':{let profit=0,dep=0;rows.forEach(r=>{profit+=num(r,'washCount')*num(r,'washPrice')+num(r,'dryCount')*num(r,'dryPrice')-num(r,'rent')-num(r,'utility')-num(r,'repair');dep+=num(r,'life')?num(r,'buy')/(num(r,'life')*12):0});result=[['月現金流合計',cash(profit)],['月折舊估算',cash(dep)],['折舊後月利',cash(profit-dep)]];break;}
 }
 return result;
}
function render(){
 const rows=store.read();
 kpis.replaceChildren();
 for(const [label,value] of summaryKpis(rows)){const item=document.createElement('article');item.className='metric';item.append(txt('small',label),txt('div',value,'number'));kpis.append(item)}
 summary.textContent='目前 '+rows.length+' 筆紀錄。數據由使用者輸入，僅供內部分析；若無資料，計算結果以零顯示。';
 const selected=select.value;select.replaceChildren();for(const row of rows){const opt=document.createElement('option');opt.value=row._id;opt.textContent=String(row[nameKey[C.kind]]||'未命名').slice(0,65);select.append(opt)}
 if(rows.some(x=>String(x._id)===selected))select.value=selected;
 select.disabled=rows.length===0;button.disabled=rows.length===0;
}
function openReport(){
 const rows=store.read(),r=rows.find(row=>String(row._id)===select.value);if(!r)return;
 const {out,warn}=detail(r,rows);
 paper.replaceChildren();
 const h=document.createElement('header');h.className='chance-paper-header';h.append(txt('small','CHANCE / INDUSTRY REPORT'),txt('h1',descriptions[C.kind]?.[0]||C.name),txt('p','標的：'+String(r[nameKey[C.kind]]||'未命名')+'　｜　報告日期：'+isoToday(),'note'));paper.append(h);
 const sec=document.createElement('section');sec.append(txt('h2','一、核心試算與檢核'));
 const dl=document.createElement('dl');dl.className='chance-dl';
 for(const [label,value] of out){dl.append(txt('dt',label),txt('dd',value))}
 sec.append(dl);paper.append(sec);
 const facts=document.createElement('section');facts.append(txt('h2','二、原始資料與佐證參考'));
 const table=document.createElement('table');const body=document.createElement('tbody');
 for(const [key,label] of C.fields){const tr=document.createElement('tr');tr.append(txt('th',label),txt('td',r[key]===undefined||r[key]===''?'—':String(r[key])));body.append(tr)}
 table.append(body);facts.append(table);paper.append(facts);
 const risks=document.createElement('section');risks.append(txt('h2','三、待確認事項'));
 const ul=document.createElement('ul');
 for(const item of warn.length?warn:['目前未依輸入條件觸發特殊提醒，仍應人工核對原始單據。'])ul.append(txt('li',item));
 ul.append(txt('li',descriptions[C.kind]?.[1]||'本文件僅供試算。'));risks.append(ul);paper.append(risks);
 paper.append(txt('footer','本報告是依據自行輸入資料產生的非官方文件，非法律、財務、會計、付款或履約認證。請核對原始單據。','note'));
 report.showModal();
}
button.addEventListener('click',openReport);
window.addEventListener('chance:change',event=>{if(event.detail?.slug===C.slug)render()});
render();
})();