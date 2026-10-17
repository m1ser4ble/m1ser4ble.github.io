const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.L2L3_URL || 'http://127.0.0.1:8871/';
const output = process.env.L2L3_REVIEW_DIR || '/tmp/l2l3-drd-review';
(async () => {
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_EXECUTABLE});
  const results=[];
  try {
    for (const width of [1280,390]) {
      const page=await browser.newPage({viewport:{width,height:900}});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base,{waitUntil:'networkidle'});
      const panels=page.locator('.l2l3-panel');
      assert.equal(await panels.count(),12,'all twelve lesson panels exist');
      const lessonHeadings=await page.locator('h2').allTextContents();
      assert.deepEqual(lessonHeadings.filter(t=>/^\d+일차/.test(t)).map(t=>Number(t.match(/^\d+/)[0])),Array.from({length:12},(_,i)=>i+7),'every source lesson appears once');
      for(let n=0;n<await panels.count();n++){
        const panel=panels.nth(n);await panel.scrollIntoViewIfNeeded();
        const svg=panel.locator('svg');
        assert.ok(await svg.locator('text').count()>3,'SVG is actually drawn');
        const steps=panel.locator('button[data-step]');
        assert.ok(await steps.count()>1,'scenario has multiple steps');
        const before=await svg.textContent();
        await steps.last().click();
        assert.notEqual(await svg.textContent(),before,'step changes visible packet/table state');
        assert.equal(await steps.last().getAttribute('aria-pressed'),'true');
        const allStates=[];
        for(let k=0;k<await steps.count();k++){
          await steps.nth(k).click();
          assert.equal(await steps.nth(k).getAttribute('aria-pressed'),'true');
          allStates.push(await svg.textContent());
          const clipped=await svg.locator('text').evaluateAll(nodes=>nodes.filter(n=>{const b=n.getBBox(),v=n.ownerSVGElement.viewBox.baseVal;return b.x < -1 || b.y < -1 || b.x+b.width > v.width+1 || b.y+b.height > v.height+1;}).map(n=>n.textContent));
          assert.deepEqual(clipped,[],'text stays within responsive SVG in every state');
        }
        assert.equal(new Set(allStates).size,allStates.length,'each scenario changes the visible state');
        await steps.first().focus();await page.keyboard.press('Enter');
        assert.equal(await steps.first().getAttribute('aria-pressed'),'true');
        assert.equal(await svg.textContent(),before,'keyboard returns to initial state');
        const clipped=await svg.locator('text').evaluateAll(nodes=>nodes.filter(n=>{const b=n.getBBox(),v=n.ownerSVGElement.viewBox.baseVal;return b.x < -1 || b.y < -1 || b.x+b.width > v.width+1 || b.y+b.height > v.height+1;}).map(n=>n.textContent));
        assert.deepEqual(clipped,[],'text stays within responsive SVG');
        results.push({width,id:await panel.getAttribute('id'),steps:await steps.count(),passed:true});
      }
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),'no page horizontal overflow');
      assert.deepEqual(errors,[],'no JavaScript errors');
      fs.mkdirSync(output,{recursive:true});
      await page.locator('#drd-l2l3-13').screenshot({path:`${output}/vxlan-${width}.png`});
      await page.locator('#drd-l2l3-15').screenshot({path:`${output}/irb-${width}.png`});
      await page.close();
    }
    const nojs=await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:900}});
    await nojs.goto(base,{waitUntil:'domcontentloaded'});
    assert.equal(await nojs.locator('noscript').count(),12,'each diagram retains a no-JS explanation');
    assert.ok((await nojs.locator('.page__content').innerText()).includes('재귀적 다음 홉'),'full conceptual prose survives without scripts');
    assert.equal(await nojs.locator('.l2l3-panel button').count(),0,'no dependency on controls for text');
    await nojs.close();
    results.push({test:'no-javascript-prose',passed:true});
    console.log(JSON.stringify({checks:results.length,results},null,2));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
