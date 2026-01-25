importScripts('/GAMES/baremux/index.js');
importScripts('/GAMES/uv/uv.bundle.js');
importScripts('/GAMES/uv/uv.config.js');
importScripts(__uv$config.sw || '/GAMES/uv/uv.sw.js');

const uv = new UVServiceWorker();

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'baremuxinit') {
        try {
            uv.bareClient = new BareMux.BareClient(event.data.port);
            console.log("VERN SW: BareMux Port Received and Initialized");
        } catch (e) {
            console.error("VERN SW: Failed to initialize BareMux Client", e);
        }
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
                try {
                    return await uv.fetch(event);
                } catch (err) {
                    console.error("VERN SW: Proxied Fetch Failed", err, event.request.url);
                    // Return a custom error response instead of letting it crash to 500
                    return new Response(err.stack, { status: 500, statusText: "Proxy Error" });
                }
            }
            return await fetch(event.request);
        })()
    );
});