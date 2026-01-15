const swPath = self.location.pathname;
const rootPath = swPath.substring(0, swPath.lastIndexOf('/') + 1);

importScripts(rootPath + 'uv/uv.bundle.js');
importScripts(rootPath + 'uv/uv.config.js');
importScripts(__uv$config.sw || rootPath + 'uv/uv.sw.js');

const uv = new UVServiceWorker();

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
    event.respondWith(
        (async () => {
            if (uv.route(event)) {
                return await uv.fetch(event);
            }
            return await fetch(event.request);
        })()
    );
});