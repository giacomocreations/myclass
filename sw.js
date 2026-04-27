// LiveLearn Student App — Service Worker
// Versione: 1.0 — necessario per rendere l'app installabile come PWA

const CACHE_NAME = 'livelearn-student-v1';

// Installa: salta l'attesa e prende il controllo subito
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

// Fetch: prova la rete, fallback alla cache se offline
self.addEventListener('fetch', event => {
  // Ignora richieste Firebase (real-time) e external CDN — passale sempre alla rete
  const url = event.request.url;
  if (url.includes('firebasedatabase') || url.includes('googleapis') ||
      url.includes('gstatic') || url.includes('cdnjs')) {
    return; // lascia gestire al browser
  }
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Salva in cache le risorse statiche
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
