// 執行：node tests/pwa.cjs；僅使用本機資源，不寫入資料庫。
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const profile = require('node:fs').mkdtempSync('/tmp/repair-pwa-test-');
  const context = await chromium.launchPersistentContext(profile, { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
  try {
    // 保持 API 與 CDN 無法使用，確認離線外殼不依賴外部服務。
    await context.route('https://**', route => route.abort());
    const page = await context.newPage();
    const base = process.env.BASE_URL || 'http://127.0.0.1:8000/repair-system/';
    await page.goto(base);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      }
    });
    const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
    assert.equal(new URL(manifest.scope, base).pathname, '/repair-system/');
    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    assert.deepEqual(installabilityErrors, []);
    await page.evaluate(async () => {
      for (const size of [192, 512]) {
        const image = new Image(); image.src = `./public/icons/icon-${size}.png`;
        await image.decode();
        if (image.naturalWidth !== size || image.naturalHeight !== size) throw Error('圖示尺寸不符');
      }
    });
    await context.setOffline(true);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('#connection-status').hidden);
    assert.equal(await page.locator('h1').textContent(), '報修登記');
    assert(await page.locator('#connection-status').textContent().then(t => t.includes('無法載入或送出')));
    const cached = await page.evaluate(async () => {
      const cache = await caches.open('repair-system-shell-v1');
      return (await cache.keys()).map(r => r.url);
    });
    assert(cached.length >= 11);
    assert(cached.every(url => url.startsWith(base)));
    assert(!cached.some(url => url.includes('supabase')));
    await page.screenshot({ path: '/tmp/repair-pwa-offline.png', fullPage: true });
    console.log('通過：GitHub Pages 子路徑、瀏覽器可安裝性、圖示尺寸、Service Worker 啟用、離線重載、連線提示與靜態快取範圍。');
  } finally {
    await context.close();
    require('node:fs').rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
