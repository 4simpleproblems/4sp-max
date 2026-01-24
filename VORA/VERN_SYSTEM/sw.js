importScripts('./uv/uv.bundle.js');
importScripts('./uv/uv.config.js');
importScripts('./uv/uv.sw.js');

const uv = new UVServiceWorker();

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = event.request.url;
    if (url.startsWith(location.origin + self.__uv$config.prefix)) {
        event.respondWith(uv.fetch(event));
    }
});