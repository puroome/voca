const CACHE_VERSION = 'voca-app-v7';
const APP_SHELL = [
  './',
  './index.html',
  './style.css?v=20260912-3',
  './stats-store.js',
  './script.js',
  './js/app.js',
  './js/services.js',
  './js/ui.js',
  './js/utils.js',
  './js/dashboard.js',
  './js/quiz.js',
  './js/learning.js',
  './manifest.json',
  './favicon.png',
  './google.png',
  './icon-192.png',
  './icon-512.png',
  './images/learn.png',
  './images/test.png',
  './images/quiz1.webp',
  './images/quiz2.webp',
  './images/quiz3.webp'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isLocalAsset = url.origin === self.location.origin;
  const isStaticLibrary =
    url.hostname === 'cdn.tailwindcss.com' ||
    url.hostname === 'cdn.jsdelivr.net' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    (url.hostname === 'www.gstatic.com' && url.pathname.includes('/firebasejs/'));

  if (!isLocalAsset && !isStaticLibrary) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        throw new Error('offline-resource-unavailable');
      })
  );
});
