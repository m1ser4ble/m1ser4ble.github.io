import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '../../ipsec/node_modules/playwright/index.mjs';

const script = new URL('../../../assets/js/ipsec-guide.js', import.meta.url);
assert.ok(fs.existsSync(script), 'Missing article iframe resizing behavior');
const browser = await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.fulfill({contentType:'text/html',body:route.request().url().includes('/post') ? '<iframe id="keys" class="ipsec-explainer-frame" src="/assets/animations/ipsec-explainer/index.html?topic=keys" style="height:650px"></iframe><iframe id="legacy" class="ipsec-handshake-frame" src="/assets/animations/ipsec/index.html" style="height:930px"></iframe><iframe id="other" src="https://other.test/frame" style="height:100px"></iframe>' : '<!doctype html><title>frame fixture</title>'}));
  await page.goto('https://example.test/post');
  await page.addScriptTag({content:fs.readFileSync(script,'utf8')});
  const send = async (payload,source='keys',origin='https://example.test') => page.evaluate(({payload,source,origin}) => {
    window.dispatchEvent(new MessageEvent('message',{data:payload,origin,source:document.getElementById(source).contentWindow}));
  },{payload,source,origin});
  const height = () => page.locator('#keys').evaluate(node => node.style.height);
  await send({type:'ipsec-explainer-height',height:830});
  assert.equal(await height(),'830px','matching same-origin frame should resize');
  await send({type:'ipsec-explainer-height',height:900},'keys','https://evil.test');
  assert.equal(await height(),'830px','foreign origin must be ignored');
  await send({type:'ipsec-explainer-height',height:900},'other');
  assert.equal(await height(),'830px','unrelated frame must be ignored');
  for (const value of [NaN,Infinity,'900',null,-1,300,2001]) {
    await send({type:'ipsec-explainer-height',height:value});
    assert.equal(await height(),'830px',`invalid height ${value} must be ignored`);
  }
  await send({type:'wrong-type',height:950});
  await send(null);
  assert.equal(await height(),'830px');
  await send({type:'ipsec-demo-height',height:670},'legacy');
  assert.equal(await page.locator('#legacy').evaluate(node => node.style.height),'670px','legacy handshake should resize independently');
  await send({type:'ipsec-demo-height',height:800},'keys');
  assert.equal(await height(),'830px','message type must correspond to correct iframe class');
  assert.deepEqual(errors,[]);
  console.log('PASS: real DOM iframe resize, strict origin/source/type/finite-height validation');
} finally {
  await browser.close();
}
