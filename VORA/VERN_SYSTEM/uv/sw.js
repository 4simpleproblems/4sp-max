importScripts('uv.bundle.js');
importScripts('uv.config.js');
importScripts(__uv$config.sw || 'uv.sw.js');

const uv = new UVServiceWorker();
let config = {
    blocklist: new Set(),
}

async function handleRequest(event) {
    if (uv.route(event)) {
        if (config.blocklist.size !== 0) {
            let decodedUrl = new URL(__uv$config.decodeUrl(new URL(event.request.url).pathname.slice(__uv$config.prefix.length)));
            if (config.blocklist.has(decodedUrl.hostname)) {
                return new Response("", { status: 404 });
            }
        }
        return await uv.fetch(event);
    }
    
    try {
        return await fetch(event.request);
    } catch (err) {
        console.error("Native fetch failed in SW:", err);
        return new Response("Network error", { status: 408 });
    }
}

self.addEventListener('fetch', (event) => {
    event.respondWith(handleRequest(event));
});

self.addEventListener("message", (event) => {
    config = event.data;
});

self.addEventListener("activate", () => {
    const bc = new BroadcastChannel("UvServiceWorker");
    bc.postMessage("Active");
});