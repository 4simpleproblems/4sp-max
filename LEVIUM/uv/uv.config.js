(() => {
    // Explicitly set the base path for LEVIUM UV
    // This ensures consistency whether loaded from /LEVIUM/levium.html or inside the worker
    const basePath = "/LEVIUM/uv/";

    self.__uv$config = {
        prefix: basePath + "service/",
        encodeUrl: Ultraviolet.codec.xor.encode,
        decodeUrl: Ultraviolet.codec.xor.decode,
        handler: basePath + "uv.handler.js",
        client: basePath + "uv.client.js",
        bundle: basePath + "uv.bundle.js",
        config: basePath + "uv.config.js",
        sw: basePath + "uv.sw.js",
        stockSW: basePath + "sw.js", // The stock SW that imports uv.sw.js
    };
})();
