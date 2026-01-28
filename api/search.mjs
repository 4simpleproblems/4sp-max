// This runs on the server (Vercel), not the browser
let youtubePromise; // Store the promise of the InnerTube instance

// Cache the InnerTube instance so we don't recreate it on every request (Vercel warm starts)
async function getYoutube() {
  if (!youtubePromise) {
    youtubePromise = (async () => {
      // Use dynamic import
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

  const { query, type, category } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  try {
    const yt = await getYoutube();
    let results;

    if (category === 'music') {
        // Use YouTube Music search
        const musicResults = await yt.music.search(query, { type: 'video' });
        results = [];
        
        // Music search results are nested in sections/contents
        musicResults.sections.forEach(section => {
            if (section.contents) {
                section.contents.forEach(item => {
                    if (item.type === 'MusicVideo' || item.type === 'MusicResponsiveListItem') {
                        results.push({
                            type: 'video',
                            id: item.id,
                            title: item.title,
                            artist: item.author?.name || item.artists?.[0]?.name || "Unknown Artist",
                            duration: item.duration?.text || "",
                            thumbnail: item.thumbnails?.[0]?.url,
                            views: item.views || "",
                            published: "",
                            category: 'music'
                        });
                    }
                });
            }
        });
    } else {
        // Standard YouTube search
        const searchFilter = type || 'all'; 
        const searchResults = await yt.search(query, { type: searchFilter });
        
        results = searchResults.results.map(item => {
          if (item.type === 'Video') {
            return {
              type: 'video',
              id: item.id,
              title: item.title.text,
              artist: item.author.name,
              artistId: item.author.id,
              duration: item.duration.text,
              thumbnail: item.thumbnails[0].url,
              views: item.short_view_count?.text || "",
              published: item.published?.text || "",
              url: `https://www.youtube.com/watch?v=${item.id}`
            };
          } else if (item.type === 'Channel') {
            return {
              type: 'channel',
              id: item.id,
              title: item.author.name,
              thumbnail: item.thumbnails[0].url,
              subscribers: item.subscribers.text,
              video_count: item.video_count.text,
              description: item.description_snippet?.text || ""
            };
          }
          return null;
        }).filter(i => i !== null);
    }

    res.status(200).json({ results });
    
  } catch (error) {
    console.error("Search Error:", error);
    // Fallback to Invidious search API if YouTubei fails
    try {
        const invRes = await fetch(`https://invidious.nerdvpn.de/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
        const invData = await invRes.json();
        const results = invData.map(item => ({
            id: item.videoId,
            title: item.title,
            artist: item.author,
            duration: item.durationText,
            thumbnail: item.videoThumbnails.find(t => t.quality === 'medium')?.url || item.videoThumbnails[0].url,
            views: item.viewCountText || "",
            published: item.publishedText || "",
            url: `https://www.youtube.com/watch?v=${item.videoId}`,
            fallback: true
        }));
        return res.status(200).json({ results });
    } catch (fallbackError) {
        res.status(500).json({ error: error.message, stack: error.stack });
    }
  }
}
