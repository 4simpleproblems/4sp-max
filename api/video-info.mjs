// api/video-info.mjs
// Failsafe video information extractor

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  try {
    // Attempt 1: Fetch from Invidious (Best for streams and full metadata)
    const invRes = await fetch(`https://invidious.nerdvpn.de/api/v1/videos/${videoId}`);
    if (invRes.ok) {
        const invData = await invRes.json();
        return res.status(200).json({
            title: invData.title,
            author: invData.author,
            description: invData.description,
            duration: invData.lengthSeconds ? `${Math.floor(invData.lengthSeconds / 60)}:${(invData.lengthSeconds % 60).toString().padStart(2, '0')}` : "0:00",
            views: invData.viewCount ? invData.viewCount.toLocaleString() + " views" : "Unknown views",
            published: invData.publishedText || "",
            channel_id: invData.authorId || "",
            streaming_url: invData.formatStreams?.[0]?.url || ""
        });
    }

    // Attempt 2: Fallback to oEmbed (Always works for basic metadata)
    const oEmbedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (oEmbedRes.ok) {
        const oEmbed = await oEmbedRes.json();
        return res.status(200).json({
            title: oEmbed.title,
            author: oEmbed.author_name,
            description: "Detailed metadata unavailable. Stream will use failover mode.",
            duration: "0:00",
            views: "Unknown",
            fallback: true
        });
    }

    throw new Error("Video not found or restricted.");

  } catch (error) {
    console.error("Video Info API Failure:", error);
    return res.status(500).json({ error: error.message });
  }
}
