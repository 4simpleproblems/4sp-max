importScripts('uv/uv.bundle.js');
importScripts('uv/uv.config.js');
importScripts(__uv$config.sw || 'uv/uv.sw.js');

const uv = new UVServiceWorker();
// Updated: Sun Jan 25 2026

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {

    if (uv.route(event)) {

        event.respondWith(uv.fetch(event));

    } else {

        const url = new URL(event.request.url);

        if (url.hostname === 'cdn.dos.zone') {

            // Force proxying for dos.zone to fix CORS and use Bare transport

            const proxiedUrl = self.location.origin + self.__uv$config.prefix + Ultraviolet.codec.xor.encode(event.request.url.replace(/\\/g, '/'));

            event.respondWith(fetch(proxiedUrl));

        } else {

            event.respondWith(fetch(event.request));

        }

    }

});
