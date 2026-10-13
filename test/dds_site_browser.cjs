// Verify the rendered series, not just standalone media or source strings.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.DDS_SITE_URL || 'http://127.0.0.1:8870';
const output = process.env.DDS_REVIEW_DIR || '/tmp/dds-series-review';
const topics = ['guide', 'basics', 'discovery-addressing', 'qos', 'history-persistence', 'security', 'device-adapters', 'realtime-linux', 'fault-diagnosis', 'observability', 'gva-losa'];
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--disable-gpu'],
  });
  const results = [];
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      // The existing annotation service is outside this series' rendering checks.
      await context.route('https://hypothes.is/**', route => route.abort());
      const page = await context.newPage();
      for (const topic of topics) {
        const errors = [];
        const onError = error => errors.push(error.message);
        page.on('pageerror', onError);
        const response = await page.goto(`${base}/dds/${topic}/`, { waitUntil: 'domcontentloaded' });
        assert.equal(response.status(), 200, topic + ' page exists');
        assert.equal(await page.locator('.page__content').count(), 1);
        assert.equal(await page.locator('#dds-related').count(), 1, topic + ' outbound heading');
        assert.equal(await page.locator('#dds-backlinks').count(), 1, topic + ' inbound heading');
        assert.ok(await page.locator('#dds-related + ul a').count() >= 2);
        const urls = await page.locator('.dds-knowledge-links ul a').evaluateAll(nodes => nodes.map(node => new URL(node.href).pathname));
        assert.ok(urls.every(url => topics.some(slug => url === `/dds/${slug}/`) && url !== `/dds/${topic}/`), topic + ' actual article links: ' + JSON.stringify(urls));
        const frameElement = page.locator('iframe.dds-animation');
        assert.equal(await frameElement.count(), 1);
        await frameElement.scrollIntoViewIfNeeded();
        const handle = await frameElement.elementHandle();
        const frame = await handle.contentFrame();
        await frame.waitForFunction(() => !!window.ddsSvg);
        assert.equal(await frame.evaluate(() => ddsSvg.topic), topic);
        assert.equal(await frame.evaluate(() => ddsSvg.playing), false);
        await page.waitForTimeout(180);
        const heights = await frameElement.evaluate(node => ({
          parent: parseFloat(node.style.height),
          child: Math.ceil(node.contentDocument.body.getBoundingClientRect().height),
        }));
        assert.equal(heights.parent, heights.child, topic + ' initial integrated iframe height');
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        assert.ok(overflow <= 1, topic + ' no outer-page horizontal overflow: ' + overflow);
        await frame.evaluate(() => ddsSvg.seek(7));
        await frameElement.screenshot({ path: path.join(output, `${topic}-${width}-middle.png`) });
        await frame.evaluate(() => ddsSvg.seek(14));
        await frameElement.screenshot({ path: path.join(output, `${topic}-${width}-final.png`) });
        await page.screenshot({ path: path.join(output, `${topic}-${width}-article.png`), fullPage: false });
        assert.deepEqual(errors, [], topic + ' script errors');
        results.push({ topic, width, passed: true, initialHeight: heights.parent, outboundLinks: urls.length });
        page.off('pageerror', onError);
      }
      if (width === 1440) {
        await page.goto(`${base}/dds/qos/`, { waitUntil: 'domcontentloaded' });
        const self = page.locator('iframe.dds-animation');
        await self.scrollIntoViewIfNeeded();
        const child = await (await self.elementHandle()).contentFrame();
        await child.waitForFunction(() => !!window.ddsSvg);
        await child.evaluate(() => ddsSvg.seek(14));
        const before = await self.evaluate(node => node.style.height);
        await page.evaluate(() => {
          const source = document.querySelector('iframe.dds-animation').contentWindow;
          for (const height of ['900', NaN, Infinity, -1, 0, 3000]) {
            dispatchEvent(new MessageEvent('message', { origin: location.origin, source, data: { type: 'dds-animation-height', height } }));
          }
          dispatchEvent(new MessageEvent('message', { origin: 'https://other.invalid', source, data: { type: 'dds-animation-height', height: 900 } }));
          dispatchEvent(new MessageEvent('message', { origin: location.origin, source: window, data: { type: 'dds-animation-height', height: 900 } }));
        });
        assert.equal(await self.evaluate(node => node.style.height), before, 'reject forged/invalid resize messages');
        await page.evaluate(() => {
          const source = document.querySelector('iframe.dds-animation').contentWindow;
          dispatchEvent(new MessageEvent('message', { origin: location.origin, source, data: { type: 'dds-animation-height', height: 950.2 } }));
        });
        assert.equal(await self.evaluate(node => node.style.height), '951px', 'accept own iframe finite height');
        results.push({ test: 'resize-trust-boundary', passed: true });
        await page.goto(`${base}/dds/guide/`, { waitUntil: 'domcontentloaded' });
        const guide = page.locator('iframe.dds-animation'); await guide.scrollIntoViewIfNeeded();
        const guideFrame = await (await guide.elementHandle()).contentFrame();
        await guideFrame.waitForFunction(() => !!window.ddsSvg);
        assert.equal(await guideFrame.evaluate(() => {
          const link = document.querySelector('#map-9 a');
          link.focus();
          return document.activeElement === link;
        }), false, 'unrevealed guide link cannot receive keyboard focus');
        await guideFrame.evaluate(() => ddsSvg.seek(14));
        await guideFrame.locator('a[href*="qos/"]').click();
        await page.waitForURL('**/dds/qos/');
        assert.ok(page.url().endsWith('/dds/qos/'), 'guide links navigate top context');
        results.push({ test: 'guide-navigation', passed: true });
      }
      await context.close();
    }
    const delayedContext = await browser.newContext({ viewport: { width: 390, height: 1000 } });
    await delayedContext.route('https://hypothes.is/**', route => route.abort());
    await delayedContext.route('**/assets/js/dds-embed.js', async route => {
      await new Promise(resolve => setTimeout(resolve, 4000));
      await route.continue();
    });
    const delayedPage = await delayedContext.newPage();
    await delayedPage.goto(`${base}/dds/basics/`, { waitUntil: 'commit' });
    const delayedFrame = delayedPage.locator('iframe.dds-animation');
    await delayedFrame.scrollIntoViewIfNeeded();
    const delayedChild = await (await delayedFrame.elementHandle()).contentFrame();
    await delayedChild.waitForFunction(() => !!window.ddsSvg);
    await delayedPage.waitForLoadState('domcontentloaded');
    await delayedPage.waitForFunction(() => {
      const frame = document.querySelector('iframe.dds-animation');
      return parseFloat(frame.style.height) === Math.ceil(frame.contentDocument.body.getBoundingClientRect().height);
    });
    results.push({ test: 'late-parent-height-listener', passed: true });
    await delayedContext.close();
    fs.writeFileSync(path.join(output, 'integration-results.json'), JSON.stringify(results, null, 2));
    console.log(`PASS ${results.length} integrated site checks; screenshots: ${output}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
