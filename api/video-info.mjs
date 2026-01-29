// api/video-info.mjs
import { Innertube } from 'youtubei.js';

let youtubePromise; 

async function getYoutube() {
  if (!youtubePromise) {
    youtubePromise = (async () => {
      return Innertube.create({ 
        cache: null,
        generate_session_locally: true 
      });
    })();
  }
  return youtubePromise;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  try {
    const yt = await getYoutube();
    
    // Attempt 1: Fetch from our own backend (youtubei.js)
    // This is the "implement in Vira" approach the user wanted
    const ytInfo = await yt.getInfo(videoId).catch(() => null);

    if (ytInfo) {
        let format = ytInfo.chooseFormat({ type: 'video+audio', quality: 'best' });
        if (!format) format = ytInfo.chooseFormat({ type: 'video', quality: 'best' });
        
        return res.status(200).json({
            title: ytInfo.basic_info.title,
            author: ytInfo.basic_info.author,
            description: ytInfo.primary_info?.description?.text || ytInfo.basic_info.short_description || "",
            duration: ytInfo.basic_info.duration_text || "0:00",
            streaming_url: format ? format.decipher(yt.session.player) : "",
            channel_id: ytInfo.basic_info.channel_id,
            views: ytInfo.primary_info?.view_count?.text || `${ytInfo.basic_info.view_count} views`,
            published: ytInfo.primary_info?.published?.text || ytInfo.basic_info.publish_date
        });
    }

    // Attempt 2: Fallback to yewtu.be API
    const invRes = await fetch(`https://yewtu.be/api/v1/videos/${videoId}`).catch(() => null);
    if (invRes && invRes.ok) {
        const data = await invRes.json();
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

    throw new Error("Video unavailable.");

  } catch (error) {
    console.error("Video Info Critical Failure:", error);
    return res.status(500).json({ error: error.message });
  }
}
