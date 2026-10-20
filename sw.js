// Service Worker — TikTok JT 60s PWA
// Version : bump ce numéro pour forcer la mise à jour du cache
const CACHE_NAME = 'tiktok-jt-v1';

// Fichiers à mettre en cache immédiatement
const PRECACHE_URLS = [
  './index.html',
  './manifest.json'
];

// ─── Installation : précache des fichiers essentiels ──────────────
self.addEventListener('install', event => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activation : nettoyage des anciens caches ────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names
          .filter(n => n !== CACHE_NAME)
          .map(n => {
            console.log('[SW] Suppression ancien cache :', n);
            return caches.delete(n);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ─── Fetch : stratégie hybride ────────────────────────────────────
// - Requêtes API Agnes (apihub.agnes-ai.com) → toujours réseau (pas de cache)
// - Requêtes RSS / proxys → toujours réseau
// - Fichiers statiques locaux → cache d'abord (fallback réseau)
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Ne jamais intercepter les requêtes non-GET
  if (req.method !== 'GET') return;

  // Requêtes API : réseau pur, ne pas cacher
  const isApiRequest =
    url.hostname.includes('agnes-ai.com') ||
    url.hostname.includes('rss2json.com') ||
    url.hostname.includes('allorigins.win') ||
    url.hostname.includes('codetabs.com') ||
    url.hostname.includes('news.google.com') ||
    url.hostname.includes('thingproxy') ||
    url.protocol === 'data:';

  if (isApiRequest) {
    // Réseau seulement, pas de fallback cache
    return;
  }

  // Fichiers locaux : cache-first avec fallback réseau
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) {
          // Mise à jour en arrière-plan
          fetch(req).then(res => {
            if (res && res.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(req, res));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(req).then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
          return res;
        }).catch(() => {
          // Hors-ligne : servir index.html par défaut
          return caches.match('./index.html');
        });
      })
    );
  }
});

// ─── Message : permettre à l'app de forcer une mise à jour ───────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
