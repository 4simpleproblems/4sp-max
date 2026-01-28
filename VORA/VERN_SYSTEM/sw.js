const viraId = new URL(self.location).searchParams.get('v') || 'service';

importScripts('./uv/uv.bundle.js');
importScripts('./uv/uv.config.js');

// Override prefix with the unique ID for this session
self.__uv$config.prefix = "/VORA/VERN_SYSTEM/uv/" + viraId + "/";

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
        try {
            event.respondWith(uv.fetch(event));
        } catch (e) {
            console.error("UV Fetch Error", e);
        }
    }
});