(() => {
    const basePath = "/VERN_SYSTEM/uv/";

    self.__uv$config = {
        prefix: basePath + "service/",
        encodeUrl: Ultraviolet.codec.xor.encode,
        decodeUrl: Ultraviolet.codec.xor.decode,
        handler: basePath + "uv.handler.js",
        client: basePath + "uv.client.js",
        bundle: basePath + "uv.bundle.js",
        config: basePath + "uv.config.js",
        sw: basePath + "uv.sw.js",
        stockSW: "/VERN_SYSTEM/sw.js",
        /**
         * @type {string}
         * @description The Bare server to use. This can be an absolute URL or a relative path.
         */
        bare: "/bare/", // This will be handled by BareMux/Wisp in the frontend
    };
})();