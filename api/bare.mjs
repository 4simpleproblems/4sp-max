// 4sp-max/api/bare.mjs
// This serverless function acts as the Bare server for Ultraviolet (UV).
// It receives proxied requests from the UV service worker,
// makes the actual request to the target, and returns the response.

export default async function handler(req, res) {
  try {
    // Extract the target URL, method, and headers from the incoming request.
    // UV typically sends these in custom headers following the Bare server protocol.
    const bareUrl = req.headers['x-bare-url'];
    const bareMethod = req.headers['x-bare-method'] || req.method;
    // x-bare-headers might be JSON stringified
    const bareHeaders = JSON.parse(req.headers['x-bare-headers'] || '{}');

    if (!bareUrl) {
      console.error('Bare server: Missing x-bare-url header');
      return res.status(400).send('Missing x-bare-url header');
    }

    // Construct headers for the outbound request to the target
    const outboundHeaders = new Headers();
    for (const key in bareHeaders) {
      outboundHeaders.set(key, bareHeaders[key]);
    }
    // Remove headers that should not be forwarded or might cause issues
    outboundHeaders.delete('host'); // Host header should be set by the fetch target

    // Handle request body for methods like POST, PUT, PATCH
    let requestBody = null;
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      requestBody = await new Promise((resolve) => {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => resolve(body));
      });
    }

    // Make the outbound request to the target URL
    const response = await fetch(bareUrl, {
      method: bareMethod,
      headers: outboundHeaders,
      body: requestBody,
      redirect: 'manual', // Important for proxying; we handle redirects manually
    });

    // Set response status and headers for the client
    res.status(response.status);

    for (const [key, value] of response.headers.entries()) {
        // Exclude hop-by-hop headers that are handled by fetch or Vercel
        if (!['connection', 'keep-alive', 'transfer-encoding', 'upgrade'].includes(key.toLowerCase())) {
            res.setHeader(key, value);
        }
    }

    // Stream the response body back to the client
    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
      } catch (err) {
        console.error('Streaming error:', err);
      } finally {
        res.end();
      }
    } else {
      res.end();
    }

  } catch (error) {
    console.error('Bare server critical error:', error);
    res.status(500).send('Bare server error: ' + error.message);
  }
}
