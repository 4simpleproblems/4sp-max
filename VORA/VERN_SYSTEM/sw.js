const viraId = new URL(self.location).searchParams.get('v') || 'service';

importScripts('./uv/uv.bundle.js');
importScripts('./uv/uv.config.js');

// Ensure the prefix matches what Ultraviolet expects for asset loading
// We use the stable 'service/' prefix but the SW itself is 'distinct' due to the 'v' param
self.__uv$config.prefix = "/VORA/VERN_SYSTEM/uv/service/";

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
            console.error("VIRA Proxy Fetch Error:", e);
            return new Response("Proxy Error", { status: 408 });
        }
    }
});
