// 執行：node tests/frontend.cjs；需已安裝 Playwright、Chromium。
// BASE_URL 預設為本機 HTTP 伺服器；使用實際 CDN SDK 與模擬 API，不寫入真實資料庫。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const rows = Array.from({ length: 20 }, (_, i) => ({ id: String(i), created_at: new Date(Date.UTC(2026, 10, 11, 12, 0, -i)).toISOString(), reporter_name: '虛構同事甲', location: '虛構辦公室', category: '設備', description: i === 0 ? '<img src=x onerror="window.injected=1">' : `測試報修${i}`, urgency: '中', status: '待處理' }));
    let failInsert = false, failRead = false, empty = false, payload;
    if (process.env.SDK_PATH) await page.route('**/supabase-js@*/dist/umd/supabase.js', r => r.fulfill({ path: process.env.SDK_PATH, contentType: 'application/javascript' }));
    await page.route('https://*.supabase.co/**', async (route) => {
      const req = route.request();
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (req.method() === 'POST') {
        payload = req.postDataJSON();
        return route.fulfill({ status: failInsert ? 403 : 201, headers, contentType: 'application/json', body: failInsert ? JSON.stringify({ message: '新增遭拒絕' }) : '' });
      }
      const url = new URL(req.url());
      assert.equal(url.searchParams.get('limit'), '20');
      assert.equal(url.searchParams.get('order'), 'created_at.desc,id.desc');
      assert.notEqual(url.searchParams.get('select'), '*');
      return route.fulfill({ status: failRead ? 503 : 200, headers, contentType: 'application/json', body: JSON.stringify(failRead ? { message: '清單暫時無法讀取' } : empty ? [] : rows) });
    });
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8000');
    await page.waitForFunction(() => document.querySelectorAll('.request').length === 20);
    assert.equal(await page.locator('.description img').count(), 0);
    assert.equal(await page.evaluate(() => window.injected), undefined);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('[name=reporter_name]').fill('虛構同事乙');
    await page.locator('[name=location]').fill('虛構雲朵門市');
    await page.locator('[name=category]').selectOption('網路');
    await page.locator('[name=description]').fill('測試連線問題');
    await page.locator('#submit-button').click();
    await page.waitForFunction(() => document.querySelector('#form-message').dataset.kind === 'success');
    assert.deepEqual(Object.keys(payload).sort(), ['category', 'description', 'location', 'reporter_name', 'urgency']);
    assert.equal(payload.urgency, '中');
    assert.equal(await page.locator('[name=description]').inputValue(), '');
    failInsert = true;
    await page.locator('[name=reporter_name]').fill('虛構同事乙');
    await page.locator('[name=location]').fill('虛構地點');
    await page.locator('[name=category]').selectOption('設備');
    await page.locator('[name=description]').fill('保留輸入測試');
    await page.locator('#submit-button').click();
    await page.waitForFunction(() => document.querySelector('#form-message').dataset.kind === 'error');
    assert.equal(await page.locator('[name=description]').inputValue(), '保留輸入測試');
    failRead = true;
    await page.locator('#refresh-button').click();
    await page.waitForFunction(() => document.querySelector('#list-message').dataset.kind === 'error');
    assert.equal(await page.locator('.request').count(), 20);
    failRead = false; empty = true;
    await page.locator('#refresh-button').click();
    await page.waitForFunction(() => document.querySelector('#list-message').textContent.includes('目前還沒有'));
    assert.equal(await page.locator('.request').count(), 0);
    empty = false;
    await page.locator('#refresh-button').click();
    await page.waitForFunction(() => document.querySelectorAll('.request').length === 20);
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('.request').length === 20);
    await page.screenshot({ path: '/tmp/repair-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: '/tmp/repair-desktop.png', fullPage: true });
    assert.deepEqual(errors, []);
    const offline = await browser.newPage();
    await offline.route('**/supabase-js@*/dist/umd/supabase.js', r => r.abort());
    await offline.goto(process.env.BASE_URL || 'http://127.0.0.1:8000');
    await offline.waitForFunction(() => document.querySelector('#form-message').dataset.kind === 'error');
    assert(await offline.locator('#submit-button').isDisabled());
    console.log('通過：實際 SDK、五欄新增、成功重設、錯誤保留、最近20筆排序、空清單、讀取錯誤、XSS、手機與桌面版面、CDN失敗。');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
