import { Innertube } from 'youtubei.js';

let youtubePromise;

async function getYoutube() {
  if (!youtubePromise) {
    youtubePromise = Innertube.create();
  }
  return youtubePromise;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
    const format = info.chooseFormat({ type: 'video+audio', quality: 'best' });
    
    if (!format) {
        // Fallback to video only if best combined not found
        const videoOnly = info.chooseFormat({ type: 'video', quality: 'best' });
        const audioOnly = info.chooseFormat({ type: 'audio', quality: 'best' });
        return res.status(200).json({
            title: info.basic_info.title,
            author: info.basic_info.author,
            description: info.basic_info.short_description,
            formats: info.formats,
            adaptive_formats: info.adaptive_formats,
            streaming_url: videoOnly?.decipher(yt.session.player),
            audio_url: audioOnly?.decipher(yt.session.player)
        });
    }

    const streamingUrl = format.decipher(yt.session.player);

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
