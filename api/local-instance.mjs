// api/local-instance.mjs
// A local "Invidious-compatible" API wrapper for Vira
// This allows the frontend to treat our own server as a reliable instance

import { Innertube } from 'youtubei.js';

let youtubePromise; 

async function getYoutube() {
  if (!youtubePromise) {
    youtubePromise = Innertube.create({ 
      cache: null,
      generate_session_locally: true 
    });
  }
  return youtubePromise;
}

export default async function handler(req, res) {
  const { videoId } = req.query;
  // Handle Invidious-style path /api/v1/videos/:id
  const vid = videoId || req.url.split('/').pop().split('?')[0];

  if (!vid || vid === 'local-instance') {
    return res.status(400).json({ error: 'Missing videoId' });
  }

  try {
    const yt = await getYoutube();
    const info = await yt.getInfo(vid);
    
    // Select best format
    let format = info.chooseFormat({ type: 'video+audio', quality: 'best' });
    if (!format) format = info.chooseFormat({ type: 'video', quality: 'best' });

    // Map to Invidious-compatible JSON structure
    return res.status(200).json({
      title: info.basic_info.title,
      videoId: vid,
      author: info.basic_info.author,
      authorId: info.basic_info.channel_id,
      description: info.primary_info?.description?.text || "",
      lengthSeconds: info.basic_info.duration || 0,
      viewCount: info.basic_info.view_count || 0,
      publishedText: info.primary_info?.published?.text || "",
      formatStreams: [
        {
          url: format ? format.decipher(yt.session.player) : "",
          quality: format?.quality_label || "720p",
          container: "mp4"
        }
      ]
    });
  } catch (error) {
    console.error("Local Instance Failure:", error);
    return res.status(500).json({ error: error.message });
  }
}
