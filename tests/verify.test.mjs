import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const dirs=[
'invoice-proof','custom-order-payments','carton-inventory','saas-renewal-audit','filter-service','chargeback-evidence','contract-work-orders','shortstay-profit','parking-roi','laundry-payback'
];
const engine=fs.readFileSync(path.join(root,'assets/engine.js'),'utf8');
const computeSource=engine.slice(engine.indexOf('const num='),engine.indexOf('const key='));
const calcFor=kind=>new Function('C','nf',computeSource+';return compute;')({kind},new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}));

test('10 standalone entrypoints and individual PRDs exist',()=>{
 assert.equal(dirs.length,10);
 for(const dir of dirs){
  const page=fs.readFileSync(path.join(root,dir,'index.html'),'utf8');
  const prd=fs.readFileSync(path.join(root,dir,'PRD.md'),'utf8');
  assert.match(page,/window.CHANCE_APP=/);
  assert.match(page,/assets\/engine.js/);
  assert.match(prd,/## 8\. 驗收標準/);
  assert.match(prd,/## 6\. 營利模式與驗證/);
  assert.match(prd,/正式金流.*未完成|尚不可正式收費|金流.*未啟用/);
  const match=page.match(/window\.CHANCE_APP=(\{.*\})<\/script>/s);
  assert.ok(match,dir+' valid embedded configuration');
  const obj=JSON.parse(match[1]);
  assert.equal(obj.slug,dir);
  assert.ok(obj.fields.length>=5);
 }
});

test('shared engine parses as valid JavaScript',()=>{
 new vm.Script(engine);
 assert.match(engine,/const days=/);
 assert.match(engine,/const addDays=/);
 assert.match(engine,/reminders\.js/);
 assert.match(engine,/insights\.js/);
});

const fixtures=[
['invoice',{amount:3000,paid:1000,due:'2020-01-01',status:'已驗收'},2000,'bad'],
['orders',{total:2500,paid:2500,due:'2020-01-01',approved:'是'},0,'good'],
['inventory',{perCase:12,stock:83,reserved:8,threshold:10},75,'good'],
['saas',{seats:10,active:4,price:200,renew:'2030-01-01',notice:30},1200,'warn'],
['filter',{last:'2020-01-01',interval:7},0,'bad'],
['chargeback',{amount:2500,invoice:'已整理',delivery:'未整理',communication:'已整理',policy:'未整理',due:'2020-01-01'},50,'bad'],
['contract',{contract:'K1',cap:100000,spent:30000,pending:20000,due:'2030-01-01',status:'執行中'},50000,'good'],
['shortstay',{nights:2,rate:2000,cleanCharge:500,cleanCost:800,fee:15,other:300},2725,'good'],
['parking',{spots:20,rate:30,hours:8,occupancy:40,rent:15000,ops:10000,royalty:120000,invest:400000},22600,'good'],
['laundry',{washCount:500,washPrice:60,dryCount:400,dryPrice:40,rent:12000,utility:6000,repair:2000,buy:500000,life:5},26000,'good']
];
for(const [kind,input,amount,flag] of fixtures){
 test(kind+' formula and alert state',()=>{
  const result=calcFor(kind)(input,[input]);
  if(kind!=='filter')assert.equal(result.a,amount);
  assert.equal(result.flag,flag);
  assert.ok(result.detail.length);
 });
}

test('contract cap aggregates separate jobs without duplicate cap',()=>{
 const calc=calcFor('contract');
 const a={contract:'K2',cap:100000,spent:30000,pending:20000,due:'2030-01-01',status:'執行中'};
 const b={contract:'K2',cap:100000,spent:10000,pending:1000,due:'2030-01-01',status:'執行中'};
 assert.equal(calc(a,[a,b]).a,39000);
});

test('CSV export uses BOM and CRLF escapes for spreadsheet compatibility',()=>{
 assert.ok(engine.includes(String.raw`'\ufeff'`));
 assert.ok(engine.includes(String.raw`'\r\n'`));
});

test('strict PRD imports reject corrupt dates and numerical values',()=>{
 const dateSource=engine.slice(engine.indexOf('const validDate='),engine.indexOf('const days='));
 const validDate=new Function(dateSource+'return validDate;')();
 assert.equal(validDate('2028-02-29'),true);
 assert.equal(validDate('2027-02-29'),false);
 assert.equal(validDate('2026-04-31'),false);
 assert.equal(validDate('2026-11-04'),true);
 const validateSource=engine.slice(engine.indexOf('function validateImport('),engine.indexOf("q('record-form').addEventListener"));
 const fields=[['project','專案','text'],['amount','應收','number'],['due','期限','date'],['status','狀態','select','待驗收|已驗收'],['memo','備註','text',null,{optional:true}]];
 const validate=new Function('C','flat','validDate',validateSource+'return validateImport;')({fields},v=>String(v??''),validDate);
 const good={project:'測試',amount:'1200',due:'2028-02-29',status:'待驗收'};
 assert.doesNotThrow(()=>validate(good,2));
 assert.throws(()=>validate({...good,amount:'N/A'},3),/第 3 列數值不正確/);
 assert.throws(()=>validate({...good,amount:'-1'},3),/數值不正確/);
 assert.throws(()=>validate({...good,due:'2027-02-29'},4),/日期不正確/);
 assert.throws(()=>validate({...good,status:'隨意'},5),/選項不正確/);
 assert.throws(()=>validate({...good,project:''},6),/缺少必要欄位/);
 assert.doesNotThrow(()=>validate({...good,memo:''},2));
});

test('storage quota failures cannot be displayed as successful edits or deletions',()=>{
 assert.match(engine,/if\(!persist\(\)\)\{rows=previous;recalc\(\);return\}/);
 assert.match(engine,/if\(!persist\(\)\)rows=previous/);
 assert.match(engine,/new Set\(imported\.map\(r=>r\._id\)\)/);
});

test('independent installment and inventory workflows compile and retain structured backups',()=>{
 const workflows=fs.readFileSync(path.join(root,'assets/workflows.js'),'utf8');
 new vm.Script(workflows);
 assert.match(workflows,/chance-stage-planned/);
 assert.match(workflows,/chance-stock-delta/);
 assert.match(engine,/structuredExtras\(x\)/);
 assert.match(engine,/updateStructured/);
});
test('filter dispatch validates technicians, schedule, status and backup data',()=>{
 const workflow=fs.readFileSync(path.join(root,'assets/filter-dispatch.js'),'utf8');
 new vm.Script(workflow);
 const start=engine.indexOf('const finiteAmount='),end=engine.indexOf('function inventoryChange(',start);
 const dateSource=engine.slice(engine.indexOf('const validDate='),engine.indexOf('const days='));
 const validDate=new Function(dateSource+'return validDate;')();
 const extra=new Function('C','flat','validDate',engine.slice(start,end)+'return structuredExtras;')(
  {kind:'filter'},v=>String(v??''),validDate);
 const input={id:'test-1',scheduled:'2030-02-14',assignees:['王技師','陳技師'],status:'已指派',note:'定期更換'};
 const parsed=extra({_workOrders:[input]});
 assert.equal(parsed._workOrders.length,1);
 assert.equal(parsed._workOrders[0].assignees.length,2);
 assert.throws(()=>extra({_workOrders:[{...input,scheduled:'2030-02-30'}]}),/日期/);
 assert.throws(()=>extra({_workOrders:[{...input,assignees:['王技師','王技師']}]}),/技師名稱/);
 assert.throws(()=>extra({_workOrders:[{...input,status:'不明'}]}),/狀態/);
 assert.throws(()=>extra({_workOrders:[input,input]}),/重複/);
 assert.match(engine,/filter-dispatch\.js/);
});
test('onsite customer signoff enforces bounded strokes and signed job snapshot',()=>{
 new vm.Script(fs.readFileSync(path.join(root,'assets/filter-signoff.js'),'utf8'));
 const dateSource=engine.slice(engine.indexOf('const validDate='),engine.indexOf('const days='));
 const validDate=new Function(dateSource+'return validDate;')();
 const start=engine.indexOf('const finiteAmount='),end=engine.indexOf('function inventoryChange(',start);
 const extra=new Function('C','flat','validDate',engine.slice(start,end)+'return structuredExtras;')({kind:'filter'},v=>String(v??''),validDate);
 const signature={signer:'使用者測試',signedAt:'2026-11-04T12:00:00.000Z',acknowledged:true,
  strokes:[[[110,400],[180,450],[260,380]]],
  snapshot:{site:'第一據點',device:'X1',filter:'F1',batch:'B1',scheduled:'2030-02-14',note:'保養完成',assignees:['王技師','陳技師']}};
 const job={id:'job-1',scheduled:'2030-02-14',assignees:['王技師','陳技師'],status:'已完成',note:'保養完成',signoff:signature};
 const result=extra({_workOrders:[job]});
 assert.equal(result._workOrders[0].signoff.signer,'使用者測試');
 assert.equal(result._workOrders[0].signoff.snapshot.device,'X1');
 assert.throws(()=>extra({_workOrders:[{...job,signoff:{...signature,strokes:[[[110,400],[1001,400]]]}}]}),/座標/);
 assert.throws(()=>extra({_workOrders:[{...job,signoff:{...signature,acknowledged:false}}]}),/確認/);
 assert.throws(()=>extra({_workOrders:[{...job,signoff:{...signature,snapshot:{...signature.snapshot,scheduled:'2030-02-30'}}}]}),/日期/);
});
test('optional cloud panel JavaScript parses and uses only publishable key',()=>{
 const cloud=fs.readFileSync(path.join(root,'assets/cloud.js'),'utf8');
 new vm.Script(cloud);
 assert.match(cloud,/chance_documents/);
 assert.match(cloud,/chance_trial_requests/);
 assert.match(cloud,/sb_publishable_/);
 assert.doesNotMatch(cloud,/service_role|sb_secret_/);
 assert.match(cloud,/上傳本機/);
 assert.match(cloud,/本機/);
});
