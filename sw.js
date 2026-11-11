'use strict';

// 修改應用程式資源時遞增版本，避免混用不同版本的檔案。
const CACHE_PREFIX = 'repair-system-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const SHELL = [
  './', './index.html', './style.css', './config.js', './app.js', './src/pwa.js',
  './manifest.webmanifest', './public/icons/icon-192.png', './public/icons/icon-512.png',
  './public/icons/icon-maskable-512.png', './public/icons/apple-touch-icon.png'
];
const shellURLs = new Set(SHELL.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)));
});

// 新版本等使用者關閉舊頁面再接手，不中斷正在填寫的表單。
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  // 只快取明確列出的靜態資源；Supabase 與 POST 完全交由網路處理。
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  url.search = '';
  if (!shellURLs.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url.href);
    return cached || fetch(request);
  })());
});
