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
    await page.waitForFunction(()=>!!window.ChanceLocal && !!document.querySelector('.chance-analysis') && !!document.querySelector('.chance-reminders'),null,{timeout:9000});
    assert.equal(await page.locator('#metric-count').innerText(),'0',slug+' begins empty');
    assert.equal(await page.locator('.cloud-panel').count(),0,slug+' preview has no login panel');
    assert.equal(await page.locator('#cloud-guest').count(),0,slug+' preview has no login form');
    if(slug==='custom-order-payments')assert.equal(await page.locator('.chance-order-confirmations').count(),0,'guest mode excludes authenticated confirmation links');
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
    assert.equal(await page.locator('#chance-report-select').isEnabled(),true,slug+' enables industry report');
    await page.locator('.chance-analysis button.primary').click();
    assert.equal(await page.locator('#chance-report-dialog').isVisible(),true,slug+' opens industry report');
    assert.ok((await page.locator('#chance-report-dialog').innerText()).includes('原始資料與佐證參考'),slug+' contains source audit');
    if(slug==='invoice-proof'){
      const pdf=await page.pdf({format:'A4',printBackground:true});
      assert.ok(pdf.byteLength>4000 && pdf.subarray(0,5).toString()==='%PDF-',slug+' prints PDF');
    }
    await page.locator('#chance-report-dialog button').first().click();
    if(slug==='invoice-proof'){
      const downloadPromise=page.waitForEvent('download');
      await page.locator('.chance-reminders button').click();
      const calendar=await downloadPromise;
      assert.ok(calendar.suggestedFilename().endsWith('.ics'),'downloadable calendar reminders');
    }

    if(slug==='invoice-proof'){
      assert.ok((await page.locator('#metric-primary').innerText()).includes('2,000'),'Outstanding amount is 2,000');
      assert.ok((await page.locator('#records').innerText()).includes('已逾期'),'Overdue indicator visible');
    }
    if(slug==='custom-order-payments'){
      await page.waitForSelector('.chance-workflow');
      await page.locator('#chance-stage-label').fill('第二期款');
      await page.locator('#chance-stage-planned').fill('500');
      await page.locator('#chance-stage-received').fill('100');
      await page.locator('#chance-stage-due').fill('2030-02-01');
      await page.locator('#chance-workflow-form button[type=submit]').click();
      const item=await page.evaluate(()=>window.ChanceLocal.read()[0]);
      assert.equal(item._payments.length,2,'legacy received amount retained alongside first new stage');
      assert.equal(item.paid,120,'aggregate includes previous received 20 and new received 100');
      assert.ok((await page.locator('#chance-workflow-list').innerText()).includes('第二期款'));
      assert.ok((await page.locator('.chance-reminders').innerText()).includes('第二期款'),'installment due appears in reminder list');
    }
    if(slug==='filter-service'){
      await page.waitForSelector('.chance-filter-dispatch');
      await page.locator('#chance-dispatch-date').fill('2030-02-14');
      await page.locator('#chance-dispatch-technicians').fill('王技師, 陳技師');
      await page.locator('#chance-dispatch-note').fill('濾芯更換與水質檢測');
      await page.locator('#chance-dispatch-form button[type=submit]').click();
      let device=await page.evaluate(()=>window.ChanceLocal.read()[0]);
      assert.equal(device._workOrders.length,1,'device dispatch created');
      assert.deepEqual(device._workOrders[0].assignees,['王技師','陳技師'],'multiple technicians per dispatch');
      assert.equal(device._workOrders[0].status,'已指派','default assigned status');
      assert.ok((await page.locator('.chance-reminders').innerText()).includes('保養派工'),'dispatch due appears in reminder list');
      const icsPromise=page.waitForEvent('download');
      await page.locator('.chance-reminders button').click();
      const ics=await icsPromise;
      assert.ok(ics.suggestedFilename().endsWith('.ics'),'dispatch exports existing ICS calendar');
      const stream=await ics.createReadStream();
      const parts=[];for await(const chunk of stream)parts.push(chunk);
      assert.ok(Buffer.concat(parts).toString('utf8').includes('王技師'),'ICS contains assigned technician detail');
      await page.locator('#chance-dispatch-list button').first().click();
      await page.locator('#chance-dispatch-status').selectOption('執行中');
      await page.locator('#chance-dispatch-form button[type=submit]').click();
      device=await page.evaluate(()=>window.ChanceLocal.read()[0]);
      assert.equal(device._workOrders[0].status,'執行中','dispatch status edited');
      assert.equal(device._workOrders.length,1,'editing does not duplicate job');
    }
    if(slug==='carton-inventory'){
      await page.waitForSelector('.chance-workflow');
      await page.locator('#chance-stock-delta').fill('5');
      await page.locator('#chance-stock-reason').fill('盤點增補');
      await page.locator('#chance-workflow-form button[type=submit]').click();
      const item=await page.evaluate(()=>window.ChanceLocal.read()[0]);
      assert.equal(item.stock,25,'stock adjustment changes actual stock');
      assert.equal(item._movements.length,2,'initial and subsequent stock changes audited');
      assert.ok((await page.locator('#chance-workflow-list').innerText()).includes('盤點增補'));
    }
    await page.reload({waitUntil:'load'});
    await page.waitForFunction(()=>!!window.ChanceLocal);
    assert.equal(await page.locator('#metric-count').innerText(),'1',slug+' persists after reload');
    if(slug==='custom-order-payments')assert.equal((await page.evaluate(()=>window.ChanceLocal.read()[0]))._payments.length,2,'installments persist after reload');
    if(slug==='carton-inventory')assert.equal((await page.evaluate(()=>window.ChanceLocal.read()[0]))._movements.length,2,'stock history persists after reload');
    if(slug==='filter-service'){
      const device=await page.evaluate(()=>window.ChanceLocal.read()[0]);
      assert.equal(device._workOrders.length,1,'dispatch survives reload and backup record');
      assert.equal(device._workOrders[0].status,'執行中','dispatch status survives reload');
      assert.equal(device._workOrders[0].assignees.length,2,'both technicians survive reload');
      await page.waitForSelector('.chance-filter-signoff');
      assert.equal(await page.locator('#chance-signoff-save').isDisabled(),true,'incomplete job cannot be signed');
      await page.locator('#chance-dispatch-list button').first().click();
      await page.locator('#chance-dispatch-status').selectOption('已完成');
      await page.locator('#chance-dispatch-form button[type=submit]').click();
      assert.equal(await page.locator('#chance-signoff-save').isEnabled(),true,'completed job can be signed onsite');
      await page.locator('#chance-signoff-name').fill('現場測試簽收人');
      await page.locator('#chance-signoff-canvas').scrollIntoViewIfNeeded();
      const rect=await page.locator('#chance-signoff-canvas').boundingBox();
      assert.ok(rect,'onsite signature canvas exists');
      await page.mouse.move(rect.x+40,rect.y+70);
      await page.mouse.down();
      await page.mouse.move(rect.x+105,rect.y+92,{steps:12});
      await page.mouse.move(rect.x+160,rect.y+62,{steps:12});
      await page.mouse.up();
      await page.locator('#chance-signoff-ack').check();
      await page.locator('#chance-signoff-save').click();
      let signed=await page.evaluate(()=>window.ChanceLocal.read()[0]._workOrders[0].signoff);
      if(!signed)throw Error('Signoff submission did not persist: '+(await page.locator('#chance-signoff-feedback').innerText())+'; state='+(await page.locator('#chance-signoff-state').innerText()));
      assert.equal(signed.signer,'現場測試簽收人','signer recorded');
      assert.equal(signed.acknowledged,true,'acknowledgment recorded');
      assert.ok(signed.strokes[0].length>=2,'handwritten pointer strokes preserved');
      assert.equal(signed.snapshot.device,device.device,'signed snapshot binds original device');
      assert.equal(signed.snapshot.assignees.length,2,'snapshot retains assigned technicians');
      await page.reload({waitUntil:'load'});
      await page.waitForSelector('.chance-filter-signoff');
      signed=await page.evaluate(()=>window.ChanceLocal.read()[0]._workOrders[0].signoff);
      assert.equal(signed.signer,'現場測試簽收人','signature survives reload');
      assert.ok((await page.locator('#chance-signoff-state').innerText()).includes('已現場簽收'));
      await page.locator('#chance-dispatch-list button').first().click();
      await page.locator('#chance-dispatch-note').fill('簽收後嘗試修改');
      page.once('dialog',d=>d.dismiss());
      await page.locator('#chance-dispatch-form button[type=submit]').click();
      assert.equal((await page.evaluate(()=>window.ChanceLocal.read()[0]._workOrders[0].signoff)).signer,'現場測試簽收人','dismissed change preserves signature');
      page.once('dialog',d=>d.accept());
      await page.locator('#chance-dispatch-list button').last().click();
      assert.equal((await page.evaluate(()=>window.ChanceLocal.read()[0]))._workOrders.length,0,'dispatch deletion works');
    }

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
    console.log('PASS',slug,'guest mode / create / calculate / persist / edit / delete');
  }
  await context.close();
}finally{
  await browser.close();
  http.kill('SIGTERM');
}
assert.equal(tested,10);
console.log('Verified all 10 standalone browser tools with synthetic data.');
