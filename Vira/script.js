document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const videoGrid = document.getElementById('videoGrid');
    const noResultsMessage = document.getElementById('noResultsMessage');

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                searchVideos(query);
            }
        }
    });

    async function searchVideos(query) {
        videoGrid.innerHTML = ''; // Clear previous results
        noResultsMessage.classList.add('hidden'); // Hide message

        videoGrid.innerHTML = '<p class="text-gray-500 text-center col-span-full">Searching...</p>';

        try {
            const searchRes = await fetch(`/api/search?query=${encodeURIComponent(query)}&type=video`);
            const data = await searchRes.json();

            if (data.results && data.results.length > 0) {
                renderResults(data.results);
            } else {
                noResultsMessage.textContent = 'No videos found for your search.';
                noResultsMessage.classList.remove('hidden');
                videoGrid.innerHTML = '';
            }
        } catch (error) {
            console.error("Failed to fetch search results:", error);
            videoGrid.innerHTML = '<p class="text-red-500 text-center col-span-full">Failed to load videos. Please try again later.</p>';
            noResultsMessage.classList.add('hidden');
        }
    }

    const instances = [
        'https://invidious.nerdvpn.de',
        'https://iv.melmac.space',
        'https://invidious.no-logs.com',
        'https://yewtu.be',
        'https://inv.zzls.xyz'
    ];
    let currentInstanceIndex = 0;

    window.playVideo = function(videoId) {
        window.location.hash = `video/${videoId}`;
    };

    window.switchInstance = function() {
        currentInstanceIndex = (currentInstanceIndex + 1) % instances.length;
        console.log(`VIRA: Manually switching to instance: ${instances[currentInstanceIndex]}`);
        loadVideoFromHash();
    };

    function renderResults(results) {
        videoGrid.innerHTML = ''; // Clear existing content
        results.forEach(item => {
            const videoItem = document.createElement('div');
            videoItem.classList.add('video-item', 'relative', 'group');
            videoItem.innerHTML = `
                <div class="thumbnail-container">
                    <img src="${item.thumbnail}" alt="${item.title}" class="w-full h-full object-cover">
                    <div class="play-overlay">
                        <i class="fas fa-play play-icon"></i>
                    </div>
                </div>
                <div class="p-4">
                    <h3 class="text-white text-base font-medium mb-1 line-clamp-2" title="${item.title}">${item.title}</h3>
                    <p class="text-gray-400 text-sm">${item.artist}</p>
                    <div class="flex justify-between items-center mt-2">
                        <p class="text-gray-500 text-xs">${item.duration}</p>
                        <p class="text-gray-500 text-[10px]">${item.views || ''} • ${item.published || ''}</p>
                    </div>
                </div>
            `;
            videoItem.addEventListener('click', () => playVideo(item.id));
            videoGrid.appendChild(videoItem);
        });
    }

    async function loadVideoFromHash() {
        const hash = window.location.hash;
        const playerSection = document.getElementById('player-section');
        const dynamicSection = document.getElementById('dynamic-section');
        const viraPlayer = document.getElementById('vira-player');
        const embedContainer = document.getElementById('embed-container');
        const embedIframe = document.getElementById('youtube-embed');
        const playerTitle = document.getElementById('player-title');
        const playerMetadata = document.getElementById('player-metadata');
        const playerDescription = document.getElementById('player-description');

        if (!hash.startsWith('#video/')) {
            playerSection.classList.add('hidden');
            dynamicSection.classList.remove('hidden');
            viraPlayer.pause();
            viraPlayer.src = '';
            embedIframe.src = '';
            return;
        }

        const videoId = hash.replace('#video/', '');
        
        playerSection.classList.remove('hidden');
        dynamicSection.classList.add('hidden');
        playerTitle.textContent = 'Loading...';
        playerDescription.textContent = 'Preparing high fluency stream...';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });

        try {
            const res = await fetch(`/api/video-info?videoId=${videoId}`);
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            playerTitle.textContent = data.title;
            playerMetadata.textContent = `${data.author} • ${data.duration}s • ${data.views || ''} views`;
            playerDescription.innerHTML = `
                <div class="mb-4 text-white font-medium flex items-center gap-2">
                    <i class="fas fa-check-circle text-accent-red"></i> ${data.author}
                </div>
                <div class="whitespace-pre-wrap">${data.description || 'No description available.'}</div>
            `;

            // HIGH FLUENCY MODE: Use native video element if possible
            if (data.streaming_url) {
                console.log("VIRA: Direct stream found. Engaging High Fluency Mode...");
                embedContainer.classList.add('hidden');
                viraPlayer.classList.remove('hidden');
                
                // Proxy the stream through UV
                const proxiedUrl = window.location.origin + window.__uv$config.prefix + window.__uv$config.encodeUrl(data.streaming_url);
                viraPlayer.src = proxiedUrl;
                viraPlayer.play().catch(e => console.warn("VIRA: Autoplay blocked."));
            } else {
                throw new Error("No direct stream available");
            }

        } catch (error) {
            console.error("VIRA: High Fluency failed, falling back to Invidious:", error);
            const baseUrl = instances[currentInstanceIndex];
            const embedUrl = `${baseUrl}/embed/${videoId}?autoplay=1`;
            
            viraPlayer.classList.add('hidden');
            embedContainer.classList.remove('hidden');
            embedIframe.src = window.location.origin + window.__uv$config.prefix + window.__uv$config.encodeUrl(embedUrl);
            
            if (playerTitle.textContent === 'Loading...') {
                playerTitle.textContent = 'YouTube Video';
                playerDescription.textContent = 'Engaged failover mode. Direct metadata unavailable.';
            }
        }
    }

    // Initial load, if there's a predefined query or to show recent videos
    // For now, let's just show the initial message.
    // You could call searchVideos('trending') or similar here if desired.
});
