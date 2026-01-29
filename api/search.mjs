// This runs on the server (Vercel), not the browser
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

  const { query, type, category } = req.query;
  if (!query) return res.status(400).json({ error: 'Missing query' });

  try {
    const yt = await getYoutube();
    let results = [];

    // CHANNEL VIEW LOGIC: If query looks like a Channel ID
    if (query.startsWith('UC') && query.length >= 20) {
        try {
            const channel = await yt.getChannel(query);
            const channelVideos = await channel.getVideos();
            
            results.push({
                type: 'channel_header',
                id: channel.metadata.id,
                title: channel.metadata.title,
                thumbnail: channel.metadata.thumbnail?.[0]?.url || "",
                description: channel.metadata.description || ""
            });

            const vids = channelVideos.videos || [];
            vids.forEach(v => {
                results.push({
                    type: 'video',
                    id: v.id,
                    title: v.title?.text || v.title?.toString(),
                    artist: channel.metadata.title,
                    artistId: channel.metadata.id,
                    duration: v.duration?.text || "",
                    thumbnail: v.thumbnails?.[0]?.url || "",
                    views: v.short_view_count?.text || "",
                    published: v.published?.text || ""
                });
            });
            return res.status(200).json({ results });
        } catch (e) {
            console.warn("Direct channel fetch failed, falling back to search", e);
        }
    }

    // Standard YouTube search
    const searchFilter = type || 'all'; 
    const searchResults = await yt.search(query, { type: searchFilter });
    
    results = searchResults.results.map(item => {
      if (item.type === 'Video') {
        return {
          type: 'video',
          id: item.id,
          title: item.title?.text || item.title?.toString() || "Unknown Video",
          artist: item.author?.name || "Unknown Artist",
          artistId: item.author?.id || "",
          duration: item.duration?.text || "",
          thumbnail: item.thumbnails?.[0]?.url || "",
          views: item.short_view_count?.text || "",
          published: item.published?.text || ""
        };
      } else if (item.type === 'Channel') {
        const channelThumb = item.thumbnails?.[0]?.url || 
                           item.author?.thumbnails?.[0]?.url || 
                           item.author?.avatar?.[0]?.url || 
                           "";
        return {
          type: 'channel',
          id: item.id,
          title: item.author?.name || item.title?.toString() || "Unknown Channel",
          thumbnail: channelThumb,
          video_count: item.video_count?.text || "",
          description: item.description_snippet?.text || ""
        };
      }
      return null;
    }).filter(i => i !== null);

    return res.status(200).json({ results });
    
  } catch (error) {
    console.error("Search API Critical Failure:", error);
    return res.status(500).json({ error: error.message });
  }
}