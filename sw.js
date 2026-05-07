const CACHE = 'toudou-v1';
const ASSETS = [
  './',
  './index.html',
  './todo.css',
  './todo.js',
  './manifest.json',
  './icon.png'
];

// インストール時にキャッシュ
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// 古いキャッシュを削除
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// キャッシュ優先で返す（オフライン対応）
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
