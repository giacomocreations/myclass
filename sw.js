// ═══════════════════════════════════════════════════════════════
//  LiveLearn Student — Service Worker
//  • Firebase Messaging (OBBLIGATORIO per le notifiche push FCM)
//  • Cache versioning per aggiornamenti automatici
//  • Strategie offline
// ═══════════════════════════════════════════════════════════════

// ── Firebase Messaging — DEVE stare PRIMA di tutto il resto ────
//  Senza questi importScripts, messaging.getToken() in StudentApp
//  non emette un token FCM valido e le notifiche non arrivano mai.
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyBC63JFyINndsbCysIDg3DzkOlyo4kO6NU',
  authDomain:        'livelearn-5d30a.firebaseapp.com',
  projectId:         'livelearn-5d30a',
  storageBucket:     'livelearn-5d30a.firebasestorage.app',
  messagingSenderId: '858581840539',
  appId:             '1:858581840539:web:81c68ddde0615d03eccc3e',
});

const messaging = firebase.messaging();

// Notifiche in BACKGROUND: app chiusa o minimizzata
// (Quando l'app e' aperta, le gestisce direttamente messaging.onMessage in StudentApp)
messaging.onBackgroundMessage(payload => {
  const notification = payload.notification || {};
  const data         = payload.data         || {};

  const title = notification.title || data.title || 'LiveLearn';
  const body  = notification.body  || data.body  || '';
  const type  = data.type || 'default';

  return self.registration.showNotification(title, {
    body,
    icon:     './icons/icon-192.png',
    badge:    './icons/badge-72.png',
    tag:      type,
    renotify: true,
    vibrate:  [150, 60, 150],
    data: {
      url:         data.url         || './StudentApp.html',
      type,
      classId:     data.classId     || '',
      sessionCode: data.sessionCode || '',
    },
  });
});

// ── CAMBIA QUESTO NUMERO AD OGNI DEPLOY ────────────────────────
const CACHE_VERSION = 'v8';
// ───────────────────────────────────────────────────────────────

const CACHE_NAME = 'studentapp-' + CACHE_VERSION;

const PRECACHE_URLS = [
  './StudentApp.html',
  './student-manifest.json',
];

// ── INSTALL ────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: elimina cache vecchie ───────────────────────────
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

// ── FETCH ──────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase, Google API, Anthropic: sempre rete, mai cache
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('anthropic') ||
      url.hostname.includes('generativelanguage')) {
    return;
  }

  // HTML principale: network-first
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

// ── CLICK SU NOTIFICA ─────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './StudentApp.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes('StudentApp') && 'focus' in client) {
            client.postMessage({ type: 'NOTIFICATION_CLICK', data: event.notification.data });
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});

// ── MESSAGGI DAL CLIENT ────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
