// api/video-info.mjs
import { Innertube } from 'youtubei.js';

let youtubePromise; 

async function getYoutube() {
  if (!youtubePromise) {
    youtubePromise = (async () => {
      try {
        return await Innertube.create({ 
          cache: null,
          generate_session_locally: true 
        });
      } catch (e) {
        console.error("Innertube Create Error:", e);
        return null;
      }
    })();
  }
  return youtubePromise;
}

const BACKUP_INSTANCES = [
    'https://yewtu.be',
    'https://inv.vern.cc',
    'https://iv.melmac.space',
    'https://inv.odyssey346.dev'
];

async function fetchFromInvidious(videoId) {
    const fetchPromises = BACKUP_INSTANCES.map(async (baseUrl) => {
        try {
            const response = await fetch(`${baseUrl}/api/v1/videos/${videoId}`, { signal: AbortSignal.timeout(4000) });
            if (!response.ok) return null;
            const data = await response.json();
            if (!data || !data.title) return null;
            return data;
        } catch (e) { return null; }
    });

    try {
        const results = await Promise.all(fetchPromises);
        return results.find(r => r !== null);
    } catch (e) { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  try {
    // 1. Try our own scraper first (Hardened)
    const yt = await getYoutube();
    if (yt) {
        const ytInfo = await yt.getInfo(videoId).catch(() => null);
        if (ytInfo && ytInfo.basic_info) {
            let format = ytInfo.chooseFormat({ type: 'video+audio', quality: 'best' });
            if (!format) format = ytInfo.chooseFormat({ type: 'video', quality: 'best' });
            
            return res.status(200).json({
                title: ytInfo.basic_info.title || "YouTube Video",
                author: ytInfo.basic_info.author || "Unknown Creator",
                description: ytInfo.primary_info?.description?.text || ytInfo.basic_info.short_description || "",
                duration: ytInfo.basic_info.duration_text || "0:00",
                streaming_url: format ? format.decipher(yt.session.player) : "",
                channel_id: ytInfo.basic_info.channel_id || "",
                views: ytInfo.primary_info?.view_count?.text || `${ytInfo.basic_info.view_count || 0} views`,
                published: ytInfo.primary_info?.published?.text || ytInfo.basic_info.publish_date || ""
            });
        }
    }

    // 2. Fallback to Invidious
    const invData = await fetchFromInvidious(videoId);
    if (invData && invData.formatStreams && invData.formatStreams.length > 0) {
        return res.status(200).json({
            title: invData.title,
            author: invData.author,
            description: invData.description || "",
            duration: invData.lengthSeconds ? `${Math.floor(invData.lengthSeconds / 60)}:${(invData.lengthSeconds % 60).toString().padStart(2, '0')}` : "0:00",
            views: invData.viewCount ? invData.viewCount.toLocaleString() + " views" : "Unknown views",
            published: invData.publishedText || "",
            channel_id: invData.authorId || "",
            streaming_url: invData.formatStreams[0].url
        });
    }

    // 3. Absolute last resort: oEmbed (Metadata only)
    const oEmbedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`).catch(() => null);
    if (oEmbedRes && oEmbedRes.ok) {
        const oEmbed = await oEmbedRes.json();
        return res.status(200).json({
            title: oEmbed.title,
            author: oEmbed.author_name,
            description: "Detailed metadata and stream unavailable.",
            duration: "0:00",
            views: "Unknown",
            fallback: true
        });
    }

    throw new Error("Video completely unavailable.");

  } catch (error) {
    console.error("Video Info Critical Failure:", error);
    return res.status(200).json({ error: error.message, title: "Playback Error", fallback: true });
  }
}
