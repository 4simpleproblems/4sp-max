let youtubePromise; // Store the promise of the InnerTube instance

// Cache the InnerTube instance so we don't recreate it on every request (Vercel warm starts)
async function getYoutube() {
  if (!youtubePromise) {
    youtubePromise = (async () => {
      // Use dynamic import
      const { Innertube } = await import('youtubei.js');
      // generate_session_locally: true is often needed for serverless
      return Innertube.create({ 
        cache: null,
        generate_session_locally: true 
      });
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
    
    let info;
    try {
        info = await yt.getInfo(videoId);
    } catch (infoError) {
        console.warn("yt.getInfo failed, trying yt.getBasicInfo:", infoError.message);
        // Fallback to basic info if full info fails (sometimes works for age-restricted etc.)
        info = await yt.getBasicInfo(videoId);
    }
    
    // Get the best format that has both video and audio
    // youtubei.js v16+ uses different format selection methods
    let streamingUrl;
    try {
        const format = info.chooseFormat({ type: 'video+audio', quality: 'best' }) || 
                       info.chooseFormat({ type: 'video', quality: 'best' });
        
        if (format) {
            streamingUrl = format.decipher(yt.session.player);
        }
    } catch (formatError) {
        console.error("Format selection/decipher error:", formatError);
    }

    if (!streamingUrl) {
        // Last ditch effort: find any format with a URL
        const anyFormat = info.formats?.find(f => f.url) || info.adaptive_formats?.find(f => f.url);
        if (anyFormat) {
            streamingUrl = anyFormat.decipher ? anyFormat.decipher(yt.session.player) : anyFormat.url;
        }
    }

    if (!streamingUrl) {
        return res.status(404).json({ error: 'No playable format found for video ' + videoId });
    }

    res.status(200).json({
      title: info.basic_info.title,
      author: info.basic_info.author,
      description: info.basic_info.short_description,
      duration: info.basic_info.duration,
      streaming_url: streamingUrl
    });
    
  } catch (error) {
    console.error("Video Info Critical Error:", error);
    // Return detailed error so we can see it in the client console
    res.status(500).json({ 
        error: `Video Info Error: ${error.message}`, 
        stack: error.stack,
        videoId: videoId
    });
  }
}
