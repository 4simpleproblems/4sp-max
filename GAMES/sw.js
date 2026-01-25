importScripts('/GAMES/uv/uv.bundle.js');
importScripts('/GAMES/uv/uv.config.js');
importScripts(__uv$config.sw || '/GAMES/uv/uv.sw.js');

const uv = new UVServiceWorker();

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'baremuxinit') {
        uv.bareClient = new Ultraviolet.BareClient(event.data.port);
        console.log("VERN SW: BareMux Port Received");
    }
});

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