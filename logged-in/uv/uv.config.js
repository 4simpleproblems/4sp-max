(() => {
    // Dynamically determine base path relative to the worker location
    const swPath = self.location.pathname;
    const rootPath = swPath.substring(0, swPath.lastIndexOf('/') + 1);
    const basePath = rootPath + "uv/";

    self.__uv$config = {
        prefix: basePath + "service/",
        encodeUrl: Ultraviolet.codec.xor.encode,
        decodeUrl: Ultraviolet.codec.xor.decode,
        handler: basePath + "uv.handler.js",
        client: basePath + "uv.client.js",
        bundle: basePath + "uv.bundle.js",
        config: basePath + "uv.config.js",
        sw: basePath + "uv.sw.js",
        stockSW: basePath + "sw.js",
    };
})();