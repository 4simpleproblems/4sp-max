let youtubePromise; 

async function getYoutube() {
  if (!youtubePromise) {
    youtubePromise = (async () => {
      const { Innertube } = await import('youtubei.js');
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
    const info = await yt.getInfo(videoId);
    
    // Select the best combined format (video + audio) for fast loading
    const format = info.chooseFormat({ type: 'video+audio', quality: 'best' });
    const streamingUrl = format ? format.decipher(yt.session.player) : null;

    return res.status(200).json({
      title: info.basic_info.title,
      author: info.basic_info.author,
      description: info.primary_info?.description?.text || info.basic_info.short_description || "",
      // Use formatted strings if available, otherwise fallback to raw + units
      duration: info.basic_info.duration_text || `${Math.floor(info.basic_info.duration / 60)}:${(info.basic_info.duration % 60).toString().padStart(2, '0')}`,
      streaming_url: streamingUrl,
      channel_id: info.basic_info.channel_id,
      views: info.primary_info?.view_count?.text || `${info.basic_info.view_count} views`,
      published: info.primary_info?.published?.text || info.basic_info.publish_date
    });
  } catch (error) {
    console.error("Video Info Error:", error);
    try {
        const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        const data = await response.json();
        return res.status(200).json({
            title: data.title,
            author: data.author_name,
            description: "Detailed description unavailable (fallback mode).",
            duration: 0,
            fallback: true
        });
    } catch (fallbackError) {
        res.status(500).json({ error: error.message });
    }
  }
}
