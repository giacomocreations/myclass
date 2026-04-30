// LiveLearn Student App — Service Worker v1.1
const CACHE_NAME = 'livelearn-student-v1';

self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(clients.claim()); });

self.addEventListener('fetch', event => {
  const url = event.request.url;
  // Ignora URL non-http (chrome-extension://, etc.) e servizi esterni real-time
  if (!url.startsWith('http')) return;
  if (url.includes('firebasedatabase') || url.includes('googleapis') ||
      url.includes('gstatic') || url.includes('cdnjs')) return;
if (url.includes('localhost') || url.includes('127.0.0.1')) return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(()=>{});
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
