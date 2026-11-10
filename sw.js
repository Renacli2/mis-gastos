// Service worker: guarda la app en caché para que funcione sin conexión.
// Subí VERSION cada vez que cambies archivos para que el celular descargue la nueva versión.
const VERSION = 'v1';
const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'vendor/chart.umd.min.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'js/app.js', 'js/db.js', 'js/util.js', 'js/store.js', 'js/seed.js', 'js/charts.js',
  'js/componentes.js', 'js/recurrentes.js',
  'js/views/inicio.js', 'js/views/gastos.js', 'js/views/form.js', 'js/views/analisis.js', 'js/views/ajustes.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Primero la red (para recibir actualizaciones), y si no hay conexión, la caché.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
