import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const slugs=['invoice-proof','custom-order-payments','carton-inventory','saas-renewal-audit','filter-service','chargeback-evidence','contract-work-orders','shortstay-profit','parking-roi','laundry-payback'];
const base='http://127.0.0.1:8976';
const http=spawn('python3',['-m','http.server','8976','--bind','127.0.0.1'],{stdio:'ignore'});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let tested=0;
try{
  let ready=false;
  for(let i=0;i<30;i++){
    try{const r=await fetch(base+'/');if(r.ok){ready=true;break}}catch{}
    await sleep(300);
  }
  assert.ok(ready,'local HTTP server started');
  const context=await browser.newContext();
  for(const slug of slugs){
    const page=await context.newPage(),jsErrors=[];
    page.on('pageerror',e=>jsErrors.push(e.message));
    await page.goto(base+'/'+slug+'/',{waitUntil:'load'});
    await page.waitForFunction(()=>!!window.ChanceLocal && !!document.querySelector('.cloud-panel'),null,{timeout:8000});
    assert.equal(await page.locator('#metric-count').innerText(),'0',slug+' begins empty');
    assert.equal(await page.locator('.cloud-panel').count(),1,slug+' has Cloud panel');
    assert.equal(await page.locator('#cloud-guest').isVisible(),true,slug+' login form visible');
    await page.click('#add');
    const fields=await page.evaluate(()=>window.CHANCE_APP.fields);
    for(const [key,,kind,options] of fields){
      let value;
      if(kind==='text') value='瀏覽器驗收-'+slug;
      else if(kind==='date') value='2030-01-01';
      else if(kind==='number') value='20';
      else if(kind==='select') value=options.split('|')[0];
      else throw Error('Unsupported field type: '+kind);
      if(slug==='invoice-proof'){
        if(key==='amount')value='3000';
        if(key==='paid')value='1000';
        if(key==='due')value='2020-01-01';
        if(key==='status')value='已驗收';
      }
      if(kind==='select') await page.locator('#field-'+key).selectOption(value);
      else await page.locator('#field-'+key).fill(value);
    }
    await page.locator('#record-form button[type=submit]').click();
    assert.equal(await page.locator('#metric-count').innerText(),'1',slug+' creates row');
    if(slug==='invoice-proof'){
      assert.ok((await page.locator('#metric-primary').innerText()).includes('2,000'),'Outstanding amount is 2,000');
      assert.ok((await page.locator('#records').innerText()).includes('已逾期'),'Overdue indicator visible');
    }
    await page.reload({waitUntil:'load'});
    await page.waitForFunction(()=>!!window.ChanceLocal);
    assert.equal(await page.locator('#metric-count').innerText(),'1',slug+' persists after reload');
    await page.locator('#records button[data-action=edit]').click();
    assert.equal(await page.locator('#dialog').isVisible(),true,slug+' edit dialog opens');
    await page.locator('#cancel').click();
    page.once('dialog',d=>d.accept());
    await page.locator('#records button[data-action=delete]').click();
    assert.equal(await page.locator('#metric-count').innerText(),'0',slug+' deletes row');
    if(slug==='invoice-proof'){
      page.once('dialog',d=>d.accept());
      await page.locator('#csv-import').setInputFiles({name:'chance-test.csv',mimeType:'text/csv',buffer:Buffer.from('project,client,amount,paid,due,status\n測試CSV專案,測試CSV客戶,5000,1000,2030-01-01,已驗收','utf8')});
      await page.waitForFunction(()=>document.querySelector('#metric-count')?.textContent==='1',null,{timeout:5000});
      assert.ok((await page.locator('#metric-primary').innerText()).includes('4,000'),'CSV import recomputes uncollected amount');
      assert.ok((await page.locator('#records').innerText()).includes('測試CSV專案'),'CSV imported record visible');
      console.log('PASS invoice-proof CSV import and calculation');
    }
    assert.deepEqual(jsErrors,[],slug+' JS runtime errors');
    await page.close();
    tested++;
    console.log('PASS',slug,'create / calculate / persist / edit / delete / cloud panel');
  }
  await context.close();
}finally{
  await browser.close();
  http.kill('SIGTERM');
}
assert.equal(tested,10);
console.log('Verified all 10 standalone browser tools with synthetic data.');
