// ═══════════════════════════════════════════════════════════════
//  LiveLearn Student — Service Worker
//  • Cache versioning per aggiornamenti automatici
//  • Push notifications (FCM)
//  • Strategie offline
// ═══════════════════════════════════════════════════════════════

// ── CAMBIA QUESTO NUMERO AD OGNI DEPLOY ────────────────────────
const CACHE_VERSION = 'v7';
// ───────────────────────────────────────────────────────────────

const CACHE_NAME = `studentapp-${CACHE_VERSION}`;

// File da pre-cachare (aggiungi qui le risorse statiche del tuo sito)
const PRECACHE_URLS = [
  './StudentApp.html',
  './student-manifest.json',
];

// ── INSTALL: pre-cache le risorse statiche ─────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      // Attiva subito il nuovo SW senza aspettare che tutte le
      // schede vengano chiuse (importante per mostrare il banner)
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE: elimina le cache vecchie ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('studentapp-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: network-first per HTML, cache-first per assets ──────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase e API: sempre rete, mai cache
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('anthropic') ||
      url.hostname.includes('generativelanguage')) {
    return; // gestione default del browser
  }

  // HTML principale: network-first (così l'utente vede sempre l'ultimo deploy)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Tutto il resto: cache-first con fallback rete
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// ── PUSH NOTIFICATIONS ─────────────────────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'LiveLearn', body: 'Hai un nuovo aggiornamento.' };

  try {
    data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  // Tipi di notifica con icone e colori dedicati
  const iconMap = {
    valutazione: './icons/icon-192.png',
    bacheca:     './icons/icon-192.png',
    compiti:     './icons/icon-192.png',
    sessione:    './icons/icon-192.png',
    default:     './icons/icon-192.png',
  };
  const icon = iconMap[data.type] || iconMap.default;

  const options = {
    body:    data.body || '',
    icon:    icon,
    badge:   './icons/badge-72.png',
    tag:     data.tag || data.type || 'livelearn',       // raggruppa notifiche simili
    renotify: true,
    vibrate: [150, 60, 150],
    data: {
      url:       data.url || './StudentApp.html',
      type:      data.type || 'default',
      classId:   data.classId || '',
      sessionCode: data.sessionCode || '',
    },
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'LiveLearn', options)
  );
});

// ── CLICK SU NOTIFICA ─────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './StudentApp.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Se l'app è già aperta, porta quella finestra in primo piano
        for (const client of clientList) {
          if (client.url.includes('StudentApp') && 'focus' in client) {
            client.postMessage({ type: 'NOTIFICATION_CLICK', data: event.notification.data });
            return client.focus();
          }
        }
        // Altrimenti apri una nuova finestra
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});

// ── MESSAGGI DAL CLIENT ────────────────────────────────────────
// Permettono al client di comunicare col SW (es. forzare skip waiting)
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
