(() => {
 'use strict';
 const C=window.CHANCE_APP,local=window.ChanceLocal;
 if(!C||!local)return;
 const format=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return '';return d.replace(/-/g,'')};
 const addDays=(s,n)=>{const d=new Date(s+'T12:00:00');if(Number.isNaN(d.getTime()))return '';d.setDate(d.getDate()+n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 const now=()=>{const t=new Date();return [t.getFullYear(),String(t.getMonth()+1).padStart(2,'0'),String(t.getDate()).padStart(2,'0')].join('-')};
 const days=(date)=>{const a=new Date((date||'')+'T12:00:00'),b=new Date(now()+'T12:00:00');return Math.round((a-b)/86400000)};
 const when=(r)=>{
  switch(C.kind){
   case 'invoice':return Number(r.amount)>Number(r.paid)?r.due:'';
   case 'orders':return Number(r.total)>Number(r.paid)?r.due:'';
   case 'saas':return r.renew;
   case 'filter':return Number(r.interval)>0?addDays(r.last,Number(r.interval)):'';
   case 'chargeback':return r.due;
   case 'contract':return r.status!=='已完成'?r.due:'';
   default:return '';
  }
 };
 const nameKey={invoice:'project',orders:'order',saas:'service',filter:'device',chargeback:'case',contract:'work'};
 const titleKey={invoice:'請款到期',orders:'訂製品尾款',saas:'SaaS 續約',filter:'飲水機保養',chargeback:'拒付資料提交',contract:'開口契約派工'};
 const section=document.createElement('section');section.className='panel chance-reminders';
 const header=document.createElement('div');header.className='toolbar';
 const title=document.createElement('div');
 const h=document.createElement('h2');h.textContent='待辦提醒與行事曆';
 const desc=document.createElement('p');desc.className='note';desc.textContent='只在您開啟網站時檢查期限。下載 .ics 匯入自己的行事曆，可由行事曆提供到期提醒，本站不會在背景發訊息。';
 title.append(h,desc);header.append(title);
 const button=document.createElement('button');button.className='btn';button.type='button';button.textContent='匯出全部提醒 (.ics)';
 header.append(button);section.append(header);
 const items=document.createElement('div');items.className='chance-reminder-items';section.append(items);
 const main=document.querySelector('main');
 const target=main?.querySelector('.chance-analysis');
 if(target)target.after(section);else main?.append(section);
 const t=(tag,v,cls)=>{const e=document.createElement(tag);e.textContent=String(v??'');if(cls)e.className=cls;return e};
 const toEvents=()=>local.read().filter(r=>format(when(r))).map(r=>({date:when(r),title:(titleKey[C.kind]||'待辦')+'｜'+String(r[nameKey[C.kind]]||'未命名').slice(0,65),id:String(r._id||''),detail:'請在 Chance 網站核對資料、處理期限；非正式通知。'})).sort((a,b)=>a.date.localeCompare(b.date));
 function render(){
  items.replaceChildren();
  const events=toEvents();button.disabled=events.length===0;
  if(!events.length){
   items.append(t('p',titleKey[C.kind]?'目前沒有已設定且待處理的期限。':'此產品沒有固定期限欄位；可使用上方分析報告。','note'));return;
  }
  for(const event of events.slice(0,20)){
   const div=document.createElement('div');div.className='chance-reminder-row';
   const d=days(event.date),pill=t('span',d<0?'已逾期 '+(-d)+' 天':d===0?'今天到期':d<=7?d+' 天內到期':'待辦','pill '+(d<0?'bad':d<=7?'warn':'good'));
   div.append(t('strong',event.title),t('span',event.date,'note'),pill);
   items.append(div);
  }
  if(events.length>20)items.append(t('p','另外 '+(events.length-20)+' 筆待辦可在匯出的行事曆中查看。','note'));
 }
 function escapeICS(x){return String(x).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n')}
 const lines=[
  'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Chance//Local Reminders//ZH','CALSCALE:GREGORIAN','METHOD:PUBLISH'
 ];
 button.onclick=()=>{
  const ev=toEvents();if(!ev.length)return;
  const out=[...lines],stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  for(const e of ev){
   const key=/^[a-z0-9-]+$/i.test(e.id)?e.id:encodeURIComponent(e.id).replace(/%/g,'');
   out.push('BEGIN:VEVENT','UID:'+C.slug+'-'+key+'@chance.local','DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+format(e.date),'DTEND;VALUE=DATE:'+format(addDays(e.date,1)),
    'SUMMARY:'+escapeICS(e.title),'DESCRIPTION:'+escapeICS(e.detail),'BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY',
    'DESCRIPTION:'+escapeICS(e.title),'END:VALARM','END:VEVENT');
  }
  out.push('END:VCALENDAR');
  const blob=new Blob([out.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='chance-'+C.slug+'-reminders.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
 };
 window.addEventListener('chance:change',e=>{if(e.detail?.slug===C.slug)render()});
 render();
})();