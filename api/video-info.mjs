let youtubePromise; // Store the promise of the InnerTube instance

// Cache the InnerTube instance so we don't recreate it on every request (Vercel warm starts)
async function getYoutube() {
  if (!youtubePromise) {
    youtubePromise = (async () => {
      // Use dynamic import
      const { Innertube } = await import('youtubei.js');
      return Innertube.create({ cache: null });
    })();
  }
  return youtubePromise;
}

export default async function handler(req, res) {
  // enable CORS so your frontend can call this
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId parameter' });
  }

  try {
    const yt = await getYoutube();
    const info = await yt.getInfo(videoId);
    
    // Get the best format that has both video and audio
    // youtubei.js v16+ uses different format selection methods
    const format = info.chooseFormat({ type: 'video+audio', quality: 'best' });
    
    let streamingUrl;
    if (format) {
        streamingUrl = format.decipher(yt.session.player);
    } else {
        // Fallback: try to get video only and just use that if combined fails
        const videoOnly = info.chooseFormat({ type: 'video', quality: 'best' });
        if (videoOnly) {
            streamingUrl = videoOnly.decipher(yt.session.player);
        }
    }

    if (!streamingUrl) {
        return res.status(404).json({ error: 'No playable format found' });
    }

    res.status(200).json({
      title: info.basic_info.title,
      author: info.basic_info.author,
      description: info.basic_info.short_description,
      duration: info.basic_info.duration,
      streaming_url: streamingUrl
    });
    
  } catch (error) {
    console.error("Video Info Error:", error);
    res.status(500).json({ error: 'Failed to fetch video info', details: error.message });
  }
}
