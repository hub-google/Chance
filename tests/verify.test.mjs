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
  assert.match(prd,/尚未完成正式商業營運/);
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
