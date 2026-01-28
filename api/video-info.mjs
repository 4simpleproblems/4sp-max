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

  // RACE: Try Invidious API and YouTubei.js in parallel for maximum speed
  try {
    const invResPromise = fetch(`https://invidious.nerdvpn.de/api/v1/videos/${videoId}`).then(r => r.json()).catch(() => null);
    const ytPromise = getYoutube().then(yt => yt.getInfo(videoId)).catch(() => null);

    const [invData, ytInfo] = await Promise.all([invResPromise, ytPromise]);

    if (ytInfo) {
        let format = ytInfo.chooseFormat({ type: 'video+audio', quality: 'best' });
        if (!format) format = ytInfo.chooseFormat({ type: 'video', quality: 'best' });
        
        return res.status(200).json({
            title: ytInfo.basic_info.title,
            author: ytInfo.basic_info.author,
            description: ytInfo.primary_info?.description?.text || ytInfo.basic_info.short_description || "",
            duration: ytInfo.basic_info.duration_text || "0:00",
            streaming_url: format ? format.decipher(ytInfo.session.player) : (invData?.formatStreams?.[0]?.url || ""),
            channel_id: ytInfo.basic_info.channel_id,
            views: ytInfo.primary_info?.view_count?.text || `${ytInfo.basic_info.view_count} views`,
            published: ytInfo.primary_info?.published?.text || ytInfo.basic_info.publish_date
        });
    }

    if (invData) {
        return res.status(200).json({
            title: invData.title,
            author: invData.author,
            description: invData.description,
            duration: invData.lengthSeconds,
            streaming_url: invData.formatStreams?.[0]?.url || "",
            channel_id: invData.authorId,
            views: invData.viewCount,
            published: invData.publishedText
        });
    }

    // FINAL FALLBACK
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    const data = await response.json();
    return res.status(200).json({
        title: data.title,
        author: data.author_name,
        description: "Metadata fallback active.",
        duration: "0:00",
        views: "Unknown",
        fallback: true
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
