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
            
            // Add a special "Channel Info" item at the top
            results.push({
                type: 'channel_header',
                id: channel.metadata.id,
                title: channel.metadata.title,
                thumbnail: channel.metadata.thumbnail?.[0]?.url || "",
                subscribers: channel.metadata.subscriber_count || "",
                description: channel.metadata.description || ""
            });

            // Add the channel's videos
            channelVideos.videos.forEach(v => {
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

    if (category === 'music') {
        try {
            // yt.music.search returns a complex object with sections
            const musicResults = await yt.music.search(query, { type: 'video' });
            
            // Log for debugging if empty (visible in Vercel logs)
            if (!musicResults.sections || musicResults.sections.length === 0) {
                console.log("Music search returned no sections for:", query);
            }

            musicResults.sections.forEach(section => {
                const contents = section.contents || section.items || [];
                contents.forEach(item => {
                    // Try to catch any item that looks like a video/song
                    if (item.id || item.videoId) {
                        results.push({
                            type: 'video',
                            id: item.id || item.videoId,
                            title: item.title?.toString() || "Unknown Song",
                            artist: item.author?.name || item.artists?.[0]?.name || "Unknown Artist",
                            duration: item.duration?.text || "",
                            thumbnail: item.thumbnails?.[0]?.url || "",
                            views: item.views?.toString() || "",
                            category: 'music'
                        });
                    }
                });
            });
            
            // If still empty, try standard search but flag as music
            if (results.length === 0) {
                const fallback = await yt.search(query, { type: 'video' });
                results = fallback.results.map(item => ({
                    type: 'video',
                    id: item.id,
                    title: item.title?.text || item.title?.toString(),
                    artist: item.author?.name || "Unknown Artist",
                    duration: item.duration?.text || "",
                    thumbnail: item.thumbnails?.[0]?.url || "",
                    views: item.short_view_count?.text || "",
                    published: item.published?.text || "",
                    category: 'music'
                })).filter(i => i !== null);
            }
        } catch (musicErr) {
            console.error("Music Search Error:", musicErr);
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
              duration: item.duration?.text || "",
              thumbnail: item.thumbnails?.[0]?.url || "",
              views: item.short_view_count?.text || "",
              published: item.published?.text || ""
            };
          } else if (item.type === 'Channel') {
            return {
              type: 'channel',
              id: item.id,
              title: item.author?.name || item.title?.toString() || "Unknown Channel",
              thumbnail: item.thumbnails?.[0]?.url || item.author?.thumbnails?.[0]?.url || "",
              subscribers: item.subscribers?.text || item.subscriber_count?.text || "",
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
        throw new Error("Invidious fallback failure");
    } catch (fallbackError) {
        return res.status(500).json({ error: error.message });
    }
  }
}