const CACHE_NAME = `inventariopro-v${new Date().getTime()}`;
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
    './js/app.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    // Solo interceptamos peticiones GET
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                return fetch(event.request).then(
                    function (response) {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // IMPORTANTE: Clonar la respuesta. Una respuesta es un stream
                        // y como queremos que el navegador la consuma y que la caché también
                        // la consuma, necesitamos clonarla para que haya dos streams.
                        var responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(function (cache) {
                                // No cachear peticiones a Firebase u otras APIs externas dinámicas
                                if (event.request.url.startsWith(self.location.origin)) {
                                    cache.put(event.request, responseToCache);
                                }
                            });

                        return response;
                    }
                );
            })
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
