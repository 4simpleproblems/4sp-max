// 4sp-max/api/bare.mjs
// This serverless function acts as the Bare server for Ultraviolet (UV).

export default async function handler(req, res) {
  try {
    // Extract the target URL, method, and headers from the incoming request.
    const bareUrl = req.headers['x-bare-url'];
    const bareMethod = req.headers['x-bare-method'] || req.method;
    
    let bareHeaders = {};
    try {
        bareHeaders = JSON.parse(req.headers['x-bare-headers'] || '{}');
    } catch (e) {
        console.warn('Bare server: Failed to parse x-bare-headers', e);
    }

    if (!bareUrl) {
      return res.status(200).json({
        versions: ['v1'],
        language: 'Node.js',
        memory: process.memoryUsage().heapUsed,
        maintainer: '4SP'
      });
    }

    // Construct headers for the outbound request to the target
    const outboundHeaders = new Headers();
    for (const key in bareHeaders) {
        // Skip protected/unsupported headers
        if (['host', 'connection', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) continue;
        outboundHeaders.set(key, bareHeaders[key]);
    }

    // Handle request body
    let requestBody = null;
    if (['POST', 'PUT', 'PATCH'].includes(bareMethod.toUpperCase())) {
        // For Vercel, req is a Node stream
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        requestBody = Buffer.concat(chunks);
    }

    // Make the outbound request
    const response = await fetch(bareUrl, {
      method: bareMethod,
      headers: outboundHeaders,
      body: requestBody,
      redirect: 'manual',
    });

    // Set response status
    res.status(response.status);

    // Relay headers
    for (const [key, value] of response.headers.entries()) {
        if (!['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'content-encoding'].includes(key.toLowerCase())) {
            res.setHeader(key, value);
        }
    }

    // Relay body
    const reader = response.body.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }
    } finally {
        res.end();
    }

  } catch (error) {
    console.error('Bare server critical error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
}
