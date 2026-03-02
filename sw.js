// VERSION: bump this number on every deploy to force cache refresh
const CACHE_VERSION = 'v30';
const CACHE_NAME = `inventariopro-${CACHE_VERSION}`;

// Archivos que se cachean solo como fallback (Network-First)
const urlsToCache = [
    './',
    './index.html',
    './css/variables.css',
    './css/styles.css',
    './css/animations.css',
    './img/logo.png',
    './js/store.js',
    './js/ui.js',
    './js/charts.js',
    './js/modules/catalogos.js',
    './js/modules/operaciones.js',
    './js/modules/operaciones2.js',
    './js/modules/usuarios.js',
    './js/modules/reportes.js',
    './js/modules/inventario-fecha.js',
    './js/app.js'
];

// Instalar: pre-cachear archivos
self.addEventListener('install', event => {
    // Activar inmediatamente sin esperar que cierren las pestañas antiguas
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

// Activar: eliminar cachés viejos
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames =>
            Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            )
        ).then(() => self.clients.claim()) // Toma control de todas las pestañas abiertas
    );
});

// Fetch: Network-First para JS/HTML, Cache-First para imágenes/CSS
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    const isAppFile = url.origin === self.location.origin;
    const isJsOrHtml = /\.(js|html)$/.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/');

    if (isAppFile && isJsOrHtml) {
        // Network-First: siempre intenta descargar la versión más nueva
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request)) // Fallback al caché si no hay red
        );
    } else {
        // Cache-First para recursos estáticos (imágenes, CSS, fuentes)
        event.respondWith(
            caches.match(event.request).then(cached => {
                return cached || fetch(event.request).then(response => {
                    if (response && response.status === 200 && isAppFile) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
    }
});
