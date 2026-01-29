// api/video-info.mjs
// Optimized for yewtu.be as requested

const PRIMARY_INSTANCE = 'https://yewtu.be';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  try {
    // Attempt 1: Fetch from yewtu.be
    const response = await fetch(`${PRIMARY_INSTANCE}/api/v1/videos/${videoId}`);
    
    if (response.ok) {
        const data = await response.json();
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

    // Attempt 2: Fallback to oEmbed for metadata if yewtu.be API is slow/down
    const oEmbedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (oEmbedRes.ok) {
        const oEmbed = await oEmbedRes.json();
        return res.status(200).json({
            title: oEmbed.title,
            author: oEmbed.author_name,
            description: "Detailed metadata unavailable. Pulling from yewtu.be fallback.",
            duration: "0:00",
            views: "Unknown",
            fallback: true
        });
    }

    throw new Error("Video unavailable.");

  } catch (error) {
    console.error("Video Info Critical Failure:", error);
    return res.status(500).json({ error: error.message });
  }
}