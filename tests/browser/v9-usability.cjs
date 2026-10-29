// Local, fictional data only. Run with NODE_PATH pointing to a Playwright install.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {readFile}=require('node:fs/promises');
const {resolve,sep,extname,join}=require('node:path');
const {chromium}=require('playwright');
const root=resolve(__dirname,'../..');
let server,browser,origin;
before(async()=>{
  server=createServer(async(req,res)=>{
    try {
      const path=new URL(req.url,'http://localhost').pathname;
      if(path==='/fixture-mode.json'){res.setHeader('Content-Type','application/json');return res.end('{}');}
      if(path==='/v9-preview/config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.PEOPLE_NOTEBOOK_CONFIG={supabaseUrl:"https://demo.supabase.co",supabaseAnonKey:"fictional-anon-key-for-local-testing"};');}
      const file=resolve(root,'.'+decodeURIComponent(path)+(path.endsWith('/')?'index.html':''));
      if(!file.startsWith(root+sep)){res.writeHead(403);return res.end();}
      let body=await readFile(file);
      if(path==='/v9-preview/app.js')body=Buffer.from(body.toString().replace('https://esm.sh/@supabase/supabase-js@2','/tests/fixtures/v9-supabase.js'));
      if(path==='/tests/fixtures/v9-supabase.js')body=Buffer.from(body.toString()
        .replace("canonical_name:'佐藤 健太'","canonical_name:'（佐藤 健太）'")
        .replace("profile_tags:['サッカー','同期','コーヒー']","profile_tags:['読書','登山','旅行','犬']")
        .replace("card_image:{mode:'auto'}","card_image:{mode:'illustration',illustrationId:'parenting'}")
        .replace('onAuthStateChange:()=>{}','onAuthStateChange:callback=>{window.expireFixtureSession=()=>callback("SIGNED_OUT",null);}')
        .replace("card_image:null,icon_style:'none'","card_image:{mode:'photo',path:'demo-long/00000000-0000-4000-8000-000000000000.jpg',x:.2,y:.8,zoom:2},icon_style:'none'"));
      const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
      res.setHeader('Content-Type',(types[extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(body);
    } catch {res.writeHead(404);res.end();}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,channel:process.env.PW_BROWSER_CHANNEL||'chrome'});
});
after(async()=>{await browser?.close();if(server)await new Promise(done=>server.close(done));});
async function fixture(width=390){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  page.setDefaultTimeout(5000);
  await page.addInitScript(()=>{
    const viewport=new EventTarget();Object.assign(viewport,{height:844,width:390,offsetTop:0,offsetLeft:0,scale:1});
    Object.defineProperty(window,'visualViewport',{configurable:true,value:viewport});
    window.simulateKeyboard=(height,offsetTop)=>{Object.assign(viewport,{height,offsetTop});viewport.dispatchEvent(new Event('resize'));};
  });
  await page.goto(origin+'/v9-preview/');await page.locator('#people-list .person-card').first().waitFor();
  return {page,context};
}
async function editor(page){await page.locator('#people-list .person-card').filter({hasText:'佐藤 健太'}).click();await page.locator('#person-edit').click();}
test('person editor follows a panned keyboard viewport and hides the underlying detail',async()=>{
  const {page,context}=await fixture();try {
    await editor(page);await page.evaluate(()=>window.simulateKeyboard(380,120));
    await page.locator('#person-role').fill('求人係');
    const view=await page.evaluate(()=>{const editor=document.querySelector('#person-editor'),save=document.querySelector('#person-save'),detail=document.querySelector('#person-detail');return {top:editor.getBoundingClientRect().top,height:editor.getBoundingClientRect().height,bottom:save.getBoundingClientRect().bottom,background:getComputedStyle(detail).visibility,inert:detail.inert};});
    assert.equal(view.top,120);assert.equal(view.height,380);assert.ok(view.bottom<=500 && view.bottom>=452);assert.equal(view.background,'hidden');assert.equal(view.inert,true);
    await page.evaluate(()=>window.simulateKeyboard(844,0));
    if(process.env.UX_PROOF_DIR)await page.screenshot({path:join(process.env.UX_PROOF_DIR,'v9-editor-keyboard-recovery.png')});
  } finally {await context.close();}
});
test('role Enter leaves the editor open; only explicit save finishes editing',async()=>{
  const {page,context}=await fixture();try {
    await editor(page);await page.locator('#person-role').fill('係長');await page.locator('#person-role').press('Enter');
    await page.waitForFunction(()=>!document.querySelector('#person-save').disabled);
    assert.equal(await page.locator('#person-editor').isVisible(),true);
    const composing=await page.locator('#person-role').evaluate(input=>{const e=new KeyboardEvent('keydown',{key:'Enter',isComposing:true,keyCode:229,bubbles:true,cancelable:true});input.dispatchEvent(e);return e.defaultPrevented;});
    assert.equal(composing,false);
    await page.locator('#person-save').click();await page.waitForFunction(()=>!document.querySelector('#person-save').disabled);
    assert.equal(await page.locator('#person-editor').isVisible(),false,await page.locator('body').innerText());
    assert.match(await page.locator('#detail-body').innerText(),/係長/);
    assert.equal(await page.locator('#person-detail').evaluate(e=>e.inert),false);
  } finally {await context.close();}
});

for(const saving of [false,true])test(`session expiry closes person editing${saving?' during a pending save':''}`,async()=>{
  const {page,context}=await fixture();let release;
  try {
    await editor(page);await page.locator('#person-role').fill('係長');
    if(saving){
      let notify;const requested=new Promise(done=>notify=done),blocked=new Promise(done=>release=done);let hold=true;
      await page.route('**/fixture-mode.json',async route=>{
        if(hold){hold=false;notify();await blocked;}
        await route.fulfill({json:{}});
      });
      await page.locator('#person-save').click();await requested;
      assert.equal(await page.locator('#person-save').isDisabled(),true);
    }
    await page.evaluate(()=>window.expireFixtureSession());
    await page.waitForFunction(()=>!document.querySelector('#auth-screen').hidden);
    const view=await page.evaluate(()=>({
      editorHidden:document.querySelector('#person-editor').hidden,
      detailHidden:document.querySelector('#person-detail').hidden,
      authVisibility:getComputedStyle(document.querySelector('#auth-screen')).visibility,
      editing:document.body.classList.contains('person-editing'),
      appInert:document.querySelector('#app-screen').inert,
      detailInert:document.querySelector('#person-detail').inert,
      formInert:document.querySelector('#person-form').inert,
      scrollLock:document.body.style.overflow,
      focusedInput:document.activeElement?.tagName==='INPUT',
    }));
    assert.deepEqual(view,{editorHidden:true,detailHidden:true,authVisibility:'visible',editing:false,appInert:false,detailInert:false,formInert:false,scrollLock:'',focusedInput:false});
    if(saving){
      release();await page.waitForLoadState('networkidle');
      assert.equal(await page.locator('#person-detail').isVisible(),false,'an old save must not reopen the prior person after sign-out');
      assert.equal(await page.locator('#auth-screen').isVisible(),true);
    }
  } finally {release?.();await context.close();}
});
test('a legacy cover never replaces the person initial or registered interest icons',async()=>{
  const {page,context}=await fixture(320);try {
    const row=page.locator('#people-list .person-card').filter({hasText:'佐藤 健太'});
    assert.equal(await row.locator('.person-avatar').innerText(),'佐');
    assert.deepEqual(await row.locator('.person-interest-icon').evaluateAll(images=>images.map(i=>i.alt)),['読書','登山','旅行']);
    assert.match(await row.innerText(),/＋1/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),320);
    const failedPhoto=page.locator('#people-list .person-card').filter({hasText:'アレクサンドラ'});
    await failedPhoto.locator('.art-unavailable').waitFor({state:'attached'});
    assert.equal(await failedPhoto.locator('.person-avatar-letter').isVisible(),true);
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('#people-list .person-interest-icon')).every(i=>i.complete && i.naturalWidth>0));
    if(process.env.UX_PROOF_DIR)await page.screenshot({path:join(process.env.UX_PROOF_DIR,'v9-person-list-interests.png')});
    await row.click();await page.locator('.detail-interest-icon').first().waitFor();
    assert.deepEqual(await page.locator('.detail-interest-icon').evaluateAll(images=>images.map(i=>i.alt)),['読書','登山','旅行','犬']);
    if(process.env.UX_PROOF_DIR)await page.screenshot({path:join(process.env.UX_PROOF_DIR,'v9-person-detail-interests.png')});
    await page.locator('#person-edit').click();await page.locator('#person-tag-input').fill('カラオケ');
    const choice=page.locator('#person-tag-suggestions button').filter({hasText:'カラオケ'});
    assert.equal(await choice.locator('img').count(),1);
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('#person-tag-suggestions img')).every(i=>i.complete && i.naturalWidth>0));
    assert.equal(await choice.locator('img').evaluate(i=>i.complete && i.naturalWidth>0),true);
    const resultBox=await choice.boundingBox(),footerBox=await page.locator('.person-form-actions').boundingBox();
    assert.ok(resultBox.y+resultBox.height<=footerBox.y,'the filtered tag must remain visible above the save row');
    if(process.env.UX_PROOF_DIR)await page.screenshot({path:join(process.env.UX_PROOF_DIR,'v9-tag-search-icons.png')});
  } finally {await context.close();}
});
