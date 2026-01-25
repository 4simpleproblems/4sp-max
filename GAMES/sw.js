importScripts('baremux/index.js');
importScripts('uv/uv.bundle.js');
importScripts('uv/uv.config.js');
importScripts(__uv$config.sw || 'uv/uv.sw.js');

const uv = new UVServiceWorker();
let bareReady = false;
let pending = [];

self.addEventListener('message', (event) => {
    if (event.data === 'VERN_PROXY_RESET') {
        bareReady = false;
        console.log("VERN SW: Proxy Reset for new session");
    } else if (event.data && (event.data.type === 'baremuxinit' || event.data.__uv$type === 'baremuxinit')) {
        try {
            uv.bareClient = new BareMux.BareClient(event.data.port);
            bareReady = true;
            console.log("VERN SW: BareMux Port Initialized");
            
            // Notify the window that the proxy is ready
            if (event.source) event.source.postMessage('VERN_PROXY_READY');
            
            pending.forEach(resolve => resolve());
            pending = [];
        } catch (e) {
            console.error("VERN SW: BareMux Init Failed", e);
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
    if (bareReady) return;
    return new Promise(resolve => {
        pending.push(resolve);
        setTimeout(resolve, 5000); // 5s timeout fallback
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
                    console.error("VERN SW: Proxy Fetch Error", err);
                    return new Response(err.stack, { status: 500 });
                }
            })()
        );
    } else {
        event.respondWith(fetch(event.request));
    }
});
