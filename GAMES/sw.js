importScripts('baremux/index.js');
importScripts('uv/uv.bundle.js');
importScripts('uv/uv.config.js');
importScripts(__uv$config.sw || 'uv/uv.sw.js');

const uv = new UVServiceWorker();
let bareClient;
let pendingRequests = [];

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'baremuxinit') {
        try {
            bareClient = new BareMux.BareClient(event.data.port);
            uv.bareClient = bareClient;
            console.log("VERN SW: BareMux Port Received and Initialized");
            
            // Process any requests that were queued while waiting for the port
            pendingRequests.forEach(resolve => resolve());
            pendingRequests = [];
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

async function waitForProxy() {
    if (uv.bareClient) return;
    return new Promise(resolve => {
        pendingRequests.push(resolve);
        // Timeout after 5s to avoid infinite hang, but ideally the port arrives much faster
        setTimeout(resolve, 5000);
    });
}

self.addEventListener('fetch', event => {
    if (uv.route(event)) {
        event.respondWith(
            (async () => {
                await waitForProxy();
                try {
                    return await uv.fetch(event);
                } catch (err) {
                    console.error("VERN SW: Proxied Fetch Failed", err, event.request.url);
                    return new Response(err.stack, { status: 500, statusText: "Proxy Error" });
                }
            })()
        );
    } else {
        event.respondWith(fetch(event.request));
    }
});