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

    if (category === 'music') {
        try {
            const musicResults = await yt.music.search(query, { type: 'video' });
            if (musicResults.sections) {
                musicResults.sections.forEach(section => {
                    if (section.contents) {
                        section.contents.forEach(item => {
                            if (item.id) {
                                results.push({
                                    type: 'video',
                                    id: item.id,
                                    title: item.title?.toString() || "Unknown Title",
                                    artist: item.author?.name || item.artists?.[0]?.name || "Unknown Artist",
                                    duration: item.duration?.text || item.duration?.toString() || "",
                                    thumbnail: item.thumbnails?.[0]?.url || "",
                                    views: item.views?.toString() || "",
                                    published: "",
                                    category: 'music'
                                });
                            }
                        });
                    }
                });
            }
        } catch (musicErr) {
            console.error("Music Search Error:", musicErr);
            // Fallback to standard search if music fails
            return handler({ ...req, query: { ...req.query, category: 'youtube' } }, res);
        }
    } else {
        const searchResults = await yt.search(query, { type: type || 'all' });
        results = searchResults.results.map(item => {
          if (item.type === 'Video') {
            return {
              type: 'video',
              id: item.id,
              title: item.title?.text || item.title?.toString() || "Unknown Video",
              artist: item.author?.name || "Unknown Artist",
              artistId: item.author?.id || "",
              duration: item.duration?.text || item.duration?.toString() || "",
              thumbnail: item.thumbnails?.[0]?.url || "",
              views: item.short_view_count?.text || item.view_count?.text || "",
              published: item.published?.text || ""
            };
          } else if (item.type === 'Channel') {
            return {
              type: 'channel',
              id: item.id,
              title: item.author?.name || item.title?.toString() || "Unknown Channel",
              thumbnail: item.thumbnails?.[0]?.url || "",
              subscribers: item.subscribers?.text || "",
              video_count: item.video_count?.text || "",
              description: item.description_snippet?.text || ""
            };
          }
          return null;
        }).filter(i => i !== null);
    }

    return res.status(200).json({ results });
    
  } catch (error) {
    console.error("Search API Critical Failure:", error);
    
    // FINAL FALLBACK: Invidious API
    try {
        const invRes = await fetch(`https://invidious.nerdvpn.de/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
        const invData = await invRes.json();
        
        if (Array.isArray(invData)) {
            const fallbackResults = invData.map(item => ({
                type: 'video',
                id: item.videoId,
                title: item.title,
                artist: item.author,
                artistId: item.authorId,
                duration: item.durationText,
                thumbnail: item.videoThumbnails?.find(t => t.quality === 'medium')?.url || item.videoThumbnails?.[0]?.url,
                views: item.viewCountText || "",
                published: item.publishedText || "",
                fallback: true
            }));
            return res.status(200).json({ results: fallbackResults });
        }
        throw new Error("Invidious fallback returned non-array data");
    } catch (fallbackError) {
        return res.status(500).json({ 
            error: "All search backends failed", 
            message: error.message,
            fallbackMessage: fallbackError.message
        });
    }
  }
}
