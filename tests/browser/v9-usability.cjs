// Local, fictional data only. Run with NODE_PATH pointing to a Playwright install.
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {createServer}=require('node:http');
const {readFile}=require('node:fs/promises');
const {readFileSync}=require('node:fs');
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
    const resultBox=await choice.boundingBox(),footerBox=await page.locator('#person-form .person-form-actions').boundingBox();
    assert.ok(resultBox.y+resultBox.height<=footerBox.y,'the filtered tag must remain visible above the save row');
    if(process.env.UX_PROOF_DIR)await page.screenshot({path:join(process.env.UX_PROOF_DIR,'v9-tag-search-icons.png')});
  } finally {await context.close();}
});

test('memo export selects dated records and copies and downloads the edited preview',async()=>{
  const {page,context}=await fixture();try {
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedFixtureText=text;}}}));
    await page.locator('#people-list .person-card').filter({hasText:'佐藤 健太'}).click();
    await page.getByRole('button',{name:'メモを書き出す'}).click({timeout:1500});
    const preview=page.locator('#memo-export-preview');
    assert.match(await preview.inputValue(),/浅煎りがおすすめ/);
    assert.doesNotMatch(await preview.inputValue(),/佐藤|はる|市役所/);
    await page.getByRole('checkbox',{name:/浅煎り/}).uncheck();
    assert.doesNotMatch(await preview.inputValue(),/浅煎り/);
    await page.getByRole('button',{name:'すべて解除'}).click();
    assert.equal(await preview.inputValue(),'');
    assert.equal(await page.getByRole('button',{name:'ダウンロード'}).isDisabled(),true);
    await page.getByRole('button',{name:'全選択'}).click();
    await preview.fill('手で編集した日本語\n追記');
    await page.getByRole('button',{name:'コピー',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.copiedFixtureText),'手で編集した日本語\n追記');
    const downloadPromise=page.waitForEvent('download');
    await page.getByRole('button',{name:'ダウンロード'}).click();
    const download=await downloadPromise;
    assert.match(download.suggestedFilename(),/^conversation-notes.*\.txt$/);
    assert.equal(readFileSync(await download.path(),'utf8'),'手で編集した日本語\n追記');
    await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new Error('clipboard blocked');};});
    await page.getByRole('button',{name:'コピー',exact:true}).click();
    await page.locator('#toast').getByText(/手動でコピー/).waitFor();
    assert.equal(await preview.evaluate(input=>input.value.slice(input.selectionStart,input.selectionEnd)),'手で編集した日本語\n追記');
  } finally {await context.close();}
});

test('avatar editor uses registry icons and basic edits retain the saved avatar',async()=>{
  const {page,context}=await fixture();try {
    const row=page.locator('#people-list .person-card').filter({hasText:'佐藤 健太'});
    await row.click();
    const editAvatar=page.getByRole('button',{name:'アイコンを編集'});
    await editAvatar.click({timeout:1500});
    await page.getByRole('button',{name:'趣味の絵',exact:true}).click();
    const search=page.locator('#illustration-search');
    for(const [query,label] of [['カメラ','写真'],['ジム','筋トレ'],['文房具','文房具']]){
      await search.fill(query);
      await page.locator('#illustration-options').getByRole('button',{name:label,exact:true}).waitFor();
    }
    await page.locator('#illustration-options').getByRole('button',{name:'文房具',exact:true}).click();
    await page.locator('#avatar-preview img[alt="文房具"]').waitFor();
    await page.locator('#avatar-save').click();
    await editAvatar.locator('img[alt="文房具"]').waitFor();
    await page.locator('#person-edit').click();
    assert.equal(await page.locator('#card-customize').count(),0);
    await page.locator('#person-role').fill('求人係');
    await page.locator('#person-save').click();
    await editAvatar.locator('img[alt="文房具"]').waitFor();
    await editAvatar.click();
    await page.locator('#avatar-preview img[alt="文房具"]').waitFor();
    await page.getByRole('button',{name:'頭文字',exact:true}).click();
    await page.getByRole('button',{name:'アイコン編集を閉じる'}).click();
    await editAvatar.locator('img[alt="文房具"]').waitFor();
    await page.locator('#detail-close').click();
    await row.locator('img[alt="文房具"]').waitFor();
  } finally {await context.close();}
});

test('topics browse is a mobile navigation tab and adding a topic returns to the same person',async()=>{
  const {page,context}=await fixture(320);try {
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedFixtureText=text;}}}));
    const topicTab=page.locator('#navigation').getByRole('button',{name:'話題',exact:true});
    await topicTab.click();
    assert.equal(await topicTab.getAttribute('aria-current'),'page');
    await page.locator('#navigation').getByRole('button',{name:'最近',exact:true}).click();
    await topicTab.click();
    await page.locator('#topic-search').fill('休日はどう過ごす');
    const copy=page.locator('#topic-list .topic-copy-button').first();
    await copy.click();
    assert.equal(await page.evaluate(()=>window.copiedFixtureText),'休日はどう過ごすことが多いですか？');
    const favorite=page.locator('#topic-list .topic-option').first().getByRole('button',{name:'お気に入りに追加'});
    await favorite.click();
    await page.locator('#topic-list .topic-option').first().getByRole('button',{name:'お気に入りから外す'}).waitFor();
    assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'お気に入りから外す');
    await page.locator('#topic-tabs').getByRole('tab',{name:'お気に入り'}).click();
    assert.equal(await page.locator('#topic-list .topic-question').innerText(),'休日はどう過ごすことが多いですか？');
    await page.locator('#navigation').getByRole('button',{name:'人物',exact:true}).click();
    await page.locator('#people-list .person-card').filter({hasText:'佐藤 健太'}).click();
    await page.locator('.follow-up-section').getByRole('button',{name:'＋ 追加'}).click();
    await page.locator('.topic-library-button').click();
    await page.locator('#topic-list .topic-toggle').first().click();
    const selected=await page.locator('#topic-list .topic-option.selected .topic-question').innerText();
    await page.locator('#topic-add-selected').click();
    await page.locator('#person-detail').getByText(selected,{exact:true}).first().waitFor();
    assert.match(await page.locator('#detail-body h1').innerText(),/佐藤/);
    assert.equal(await page.locator('#topic-picker').isVisible(),false);
    await page.locator('#detail-close').click();
    await topicTab.click();
    assert.equal(await page.locator('#topic-search').inputValue(),'休日はどう過ごす');
    assert.equal(await page.locator('#topic-list .topic-toggle').count(),0);
  } finally {await context.close();}
});

test('a legacy photo keeps its crop when an attempted avatar change fails',async()=>{
  const {page,context}=await fixture();try {
    let failPeople=false;
    await page.route('**/fixture-mode.json',route=>route.fulfill({json:{legacyPhoto:true,failPeople}}));
    await page.locator('#people-list .person-card').filter({hasText:'アレクサンドラ'}).click();
    const edit=page.getByRole('button',{name:'アイコンを編集'});
    await edit.click();
    const image=page.locator('#avatar-preview img.art-image');
    await page.waitForFunction(()=>document.querySelector('#avatar-preview img.art-image')?.naturalWidth>0);
    const crop=await image.evaluate(img=>[img.style.objectPosition,img.style.transform]);
    assert.deepEqual(crop,['20% 80%','scale(2)']);
    await page.getByRole('button',{name:'頭文字',exact:true}).click();
    failPeople=true;
    await page.locator('#avatar-save').click();
    await page.locator('#toast').getByText(/人物の保存に失敗/).waitFor();
    await page.locator('#avatar-editor-close').click();
    assert.deepEqual(await edit.locator('img.art-image').evaluate(img=>[img.style.objectPosition,img.style.transform]),crop);
    await edit.click();
    await image.waitFor();
    failPeople=false;
    const bytes=Buffer.from(readFileSync(join(__dirname,'../fixtures/tiny-jpeg.txt'),'utf8').trim(),'base64');
    await page.locator('#photo-file').setInputFiles({name:'fictional.jpg',mimeType:'image/jpeg',buffer:bytes});
    await page.locator('#photo-status').getByText(/写真を準備できました/).waitFor();
    await page.locator('#avatar-save').click();
    assert.deepEqual(await edit.locator('img.art-image').evaluate(img=>[img.style.objectPosition,img.style.transform]),['50% 50%','scale(1)']);
  } finally {await context.close();}
});

test('late detail reads cannot supply another person’s export',async()=>{
  const {page,context}=await fixture();let release;
  try {
    let notify, hold=true;
    const requested=new Promise(done=>{notify=done;});
    const blocked=new Promise(done=>{release=done;});
    await page.route('**/fixture-mode.json',async route=>{
      if(hold){hold=false;notify();await blocked;}
      await route.fulfill({json:{}});
    });
    await page.locator('#people-list .person-card').filter({hasText:'佐藤 健太'}).click();
    await requested;
    await page.locator('#detail-close').click();
    await page.locator('#people-list .person-card').filter({hasText:'森 悠介'}).click();
    await page.getByRole('button',{name:'メモを書き出す'}).click();
    release();await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('#memo-export-preview').inputValue(),'');
    assert.match(await page.locator('#memo-export-list').innerText(),/書き出せる会話メモはありません/);
    assert.match(await page.locator('#detail-body h1').innerText(),/森 悠介/);
  } finally {release?.();await context.close();}
});
