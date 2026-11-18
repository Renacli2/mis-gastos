// Service worker: guarda la app en caché para que funcione sin conexión.
// La versión sale de version.js; al cambiarla, el navegador detecta un service worker nuevo.
importScripts('version.js');
const CACHE = `mis-gastos-${self.APP_VERSION}`;
const ARCHIVOS = [
  './', 'index.html', 'version.js', 'manifest.webmanifest', 'css/app.css', 'vendor/chart.umd.min.js',
  'fonts/anybody.woff2', 'fonts/schibsted.woff2',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'js/app.js', 'js/db.js', 'js/util.js', 'js/store.js', 'js/seed.js', 'js/charts.js', 'js/update.js',
  'js/componentes.js', 'js/recurrentes.js', 'js/voz.js', 'js/voz-ui.js', 'js/voz-numeros.js', 'js/voz-interpretar.js', 'js/voz-sinonimos.js', 'js/combustible.js', 'js/consumo.js', 'js/servicios.js', 'js/vencimientos.js', 'js/costos.js', 'js/pagos.js', 'js/pagos-datos.js',
  'js/views/pagos.js', 'js/views/vehiculos.js', 'js/views/servicios.js', 'js/views/inicio.js', 'js/views/gastos.js', 'js/views/form.js', 'js/views/analisis.js', 'js/views/ajustes.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ARCHIVOS.map((a) => new Request(a, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

// Primero la red (revalidando, para recibir siempre lo último) y, sin conexión, la caché.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache' })
      .then((r) => {
        if (r.ok && !url.search) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
