// api/video-info.mjs
// Ultra-robust parallel pulling from multiple Invidious instances

const INSTANCES = [
    'https://invidious.nerdvpn.de',
    'https://iv.melmac.space',
    'https://invidious.no-logs.com',
    'https://yewtu.be'
];

async function fetchWithTimeout(url, timeout = 3000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  try {
    // Attempt 1: Race across multiple Invidious instances for the fastest response
    const fetchPromises = INSTANCES.map(async (baseUrl) => {
        try {
            const response = await fetchWithTimeout(`${baseUrl}/api/v1/videos/${videoId}`);
            if (!response.ok) throw new Error(`Instance ${baseUrl} returned ${response.status}`);
            const data = await response.json();
            if (!data.title) throw new Error("Incomplete data from instance");
            return { data, source: baseUrl };
        } catch (e) {
            throw e;
        }
    });

    // We want the FIRST successful result
    let winner;
    try {
        winner = await Promise.any(fetchPromises);
    } catch (e) {
        console.error("All Invidious instances failed for video-info");
    }

    if (winner) {
        const { data } = winner;
        return res.status(200).json({
            title: data.title,
            author: data.author,
            description: data.description,
            duration: data.lengthSeconds ? `${Math.floor(data.lengthSeconds / 60)}:${(data.lengthSeconds % 60).toString().padStart(2, '0')}` : "0:00",
            views: data.viewCount ? data.viewCount.toLocaleString() + " views" : "Unknown views",
            published: data.publishedText || "",
            channel_id: data.authorId || "",
            streaming_url: data.formatStreams?.[0]?.url || ""
        });
    }

    // Attempt 2: Fallback to oEmbed if all Invidious instances fail
    const oEmbedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (oEmbedRes.ok) {
        const oEmbed = await oEmbedRes.json();
        return res.status(200).json({
            title: oEmbed.title,
            author: oEmbed.author_name,
            description: "Detailed metadata unavailable. Pulling from fallback source.",
            duration: "0:00",
            views: "Unknown",
            fallback: true
        });
    }

    throw new Error("Video unavailable or restricted.");

  } catch (error) {
    console.error("Video Info Critical Failure:", error);
    return res.status(500).json({ error: error.message });
  }
}