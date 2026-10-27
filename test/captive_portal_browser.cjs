const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.CAPPORT_REVIEW_DIR || '/tmp/captive-portal-review';
const include = path.join(__dirname, '../_includes/captive-portal-lab.html');
fs.mkdirSync(output, { recursive: true });

(async () => {
  let server;
  let base = process.env.CAPPORT_SITE_URL;
  if (!base) {
    server = http.createServer((request, response) => {
      if (!fs.existsSync(include)) { response.writeHead(404).end('visual not implemented'); return; }
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#252a34;color:#eee;font-family:system-ui}article{box-sizing:border-box;max-width:900px;margin:auto;padding:16px}p{line-height:1.7}</style><article>' + fs.readFileSync(include, 'utf8') + '</article></html>');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = 'http://127.0.0.1:' + server.address().port;
  }
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const url = base.replace(/\/$/, '') + '/network/captive-portal/';
  const results = [];
  try {
    for (const width of [320, 390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.route('https://hypothes.is/**', route => route.abort());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200, 'article or include fixture must exist');
      const root = page.locator('#captive-portal-lab');
      await root.locator('button[data-action="next"]').waitFor({ state: 'visible' });
      if (process.env.CAPPORT_SITE_URL && width === 320) {
        const tables = await page.locator('.page__content table').evaluateAll(nodes => nodes.map(table => ({
          width: table.clientWidth,
          contentWidth: table.scrollWidth,
          readable: [...table.querySelectorAll('th,td')].every(cell => parseFloat(getComputedStyle(cell).fontSize) >= 14),
        })));
        assert.ok(tables.length > 0, 'article comparison tables exist');
        assert.ok(tables.every(table => table.readable), 'mobile article table text stays at least 14px');
        assert.ok(tables.some(table => table.contentWidth > table.width), 'wide comparisons scroll within their table');
      }
      assert.equal(await root.getAttribute('data-step'), '0');
      await page.waitForTimeout(400);
      assert.equal(await root.getAttribute('data-step'), '0', 'never auto-advance');
      assert.equal(await root.locator('button[data-action="previous"]').isDisabled(), true);
      for (let step = 0; step < 6; step++) {
        assert.equal(await root.getAttribute('data-step'), String(step));
        assert.equal(await root.getAttribute('data-gate'), step === 4 ? 'allowed' : 'limited');
        if (step === 4) await page.waitForFunction(() => getComputedStyle(document.querySelector('#captive-portal-lab .cp-status')).color === 'rgb(103, 216, 186)');
        const measurements = await root.evaluate(node => {
          const svg = node.querySelector('svg').getBoundingClientRect();
          return {
            overflow: document.documentElement.scrollWidth - innerWidth,
            svgWidth: svg.width,
            nodes: [...node.querySelectorAll('.cp-node rect')].map(box => { const r = box.getBoundingClientRect(); return { x: r.x, y: r.y }; }),
            labels: [...node.querySelectorAll('svg text')].map(text => {
              const r = text.getBoundingClientRect();
              const box = text.parentElement.querySelector('rect').getBoundingClientRect();
              return { text: text.textContent, size: parseFloat(getComputedStyle(text).fontSize), inside: r.left >= svg.left - 1 && r.right <= svg.right + 1 && r.top >= svg.top - 1 && r.bottom <= svg.bottom + 1, insideNode: r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1 };
            }),
            buttons: [...node.querySelectorAll('button')].map(button => button.getBoundingClientRect().height),
          };
        });
        assert.ok(measurements.overflow <= 1, width + ' no page horizontal overflow');
        assert.ok(measurements.labels.length >= 4);
        assert.ok(measurements.labels.every(label => label.size >= 14 && label.inside && label.insideNode), JSON.stringify(measurements.labels));
        assert.ok(measurements.buttons.every(height => height >= 44), 'touch target height');
        const [phone, gate, internet] = measurements.nodes;
        assert.ok(measurements.svgWidth >= 540
          ? Math.abs(phone.y - gate.y) < 1 && Math.abs(gate.y - internet.y) < 1
          : Math.abs(phone.x - gate.x) < 1 && Math.abs(gate.x - internet.x) < 1, 'diagram reflows for actual article width: ' + measurements.svgWidth);
        if (step === 4 && width === 1440) {
          await page.setViewportSize({ width: 390, height: 1000 });
          await page.waitForFunction(() => {
            const nodes = [...document.querySelectorAll('#captive-portal-lab .cp-node rect')].map(node => node.getBoundingClientRect());
            return Math.abs(nodes[0].x - nodes[1].x) < 1 && nodes[0].y < nodes[1].y;
          });
          assert.equal(await root.getAttribute('data-step'), '4', 'resize preserves approval step');
          assert.equal(await root.getAttribute('data-gate'), 'allowed', 'resize preserves approval state');
          await page.setViewportSize({ width, height: 1000 });
          await page.waitForFunction(() => {
            const nodes = [...document.querySelectorAll('#captive-portal-lab .cp-node rect')].map(node => node.getBoundingClientRect());
            return Math.abs(nodes[0].y - nodes[1].y) < 1 && nodes[0].x < nodes[1].x;
          });
        }
        if (step === 3 || step === 4) await root.screenshot({ path: path.join(output, `step-${step}-${width}.png`) });
        if (step < 5) await root.locator('button[data-action="next"]').click();
      }
      assert.equal(await root.locator('button[data-action="next"]').isDisabled(), true);
      await root.locator('button[data-action="reset"]').focus();
      await page.keyboard.press('Enter');
      assert.equal(await root.getAttribute('data-step'), '0', 'keyboard reset');
      assert.deepEqual(errors, []);
      results.push({ width, passed: true });
      await context.close();
    }
    for (const condition of ['reduced-motion', 'no-javascript', 'cdn-failure']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 1000 }, javaScriptEnabled: condition !== 'no-javascript', reducedMotion: 'reduce' });
      await context.route('https://hypothes.is/**', route => route.abort());
      if (condition === 'cdn-failure') await context.route('**/d3@7/**', route => route.abort());
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const root = page.locator('#captive-portal-lab');
      if (condition === 'reduced-motion') {
        await root.locator('button[data-action="next"]').click();
        assert.equal(await root.getAttribute('data-step'), '1');
        assert.equal(await root.locator('.cp-packet').count(), 0, 'motion preference removes travelling packet');
      } else {
        assert.equal(await root.locator('button:visible').count(), 0, 'no dead controls without script');
        assert.ok((await root.innerText()).includes('인터넷 사용 승인'), 'readable fallback');
      }
      await root.screenshot({ path: path.join(output, condition + '.png') });
      results.push({ condition, passed: true });
      await context.close();
    }
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ url, results }, null, 2));
    console.log('PASS: mobile layout, six approval states, keyboard, reduced motion, and fallbacks (' + url + ')');
  } finally {
    await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
