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
    const info = await yt.getBasicInfo(videoId);
    
    return res.status(200).json({
      title: info.basic_info.title,
      author: info.basic_info.author,
      description: info.basic_info.short_description || "",
      duration: info.basic_info.duration
    });
  } catch (error) {
    console.error("Video Info Error:", error);
    // Fallback: try a simple fetch if Innertube fails
    try {
        const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        const data = await response.json();
        return res.status(200).json({
            title: data.title,
            author: data.author_name,
            description: "Detailed description unavailable (fallback mode).",
            duration: 0
        });
    } catch (fallbackError) {
        return res.status(500).json({ error: error.message });
    }
  }
}
