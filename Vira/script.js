document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const videoGrid = document.getElementById('videoGrid');
    const noResultsMessage = document.getElementById('noResultsMessage');

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                // Close player if searching
                window.location.hash = ''; 
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
            videoGrid.innerHTML = `<p class="text-red-500 text-center col-span-full">Failed to load videos. Error: ${error.message}</p>`;
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
        const searchCloseBtn = document.getElementById('searchCloseBtn');

        if (!hash.startsWith('#video/')) {
            if (playerSection) playerSection.classList.add('hidden');
            if (dynamicSection) dynamicSection.classList.remove('hidden');
            if (viraPlayer) {
                viraPlayer.pause();
                viraPlayer.src = '';
            }
            if (embedIframe) embedIframe.src = '';
            if (searchCloseBtn) searchCloseBtn.classList.add('hidden');
            return;
        }

        const videoId = hash.replace('#video/', '');
        
        if (playerSection) playerSection.classList.remove('hidden');
        if (dynamicSection) dynamicSection.classList.add('hidden');
        if (searchCloseBtn) searchCloseBtn.classList.remove('hidden');
        
        if (playerTitle) playerTitle.textContent = 'Loading...';
        if (playerDescription) playerDescription.textContent = 'Preparing high fluency stream...';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });

        try {
            const res = await fetch(`/api/video-info?videoId=${videoId}`);
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            if (playerTitle) playerTitle.textContent = data.title;
            if (playerMetadata) playerMetadata.textContent = `${data.author} • ${data.duration}s • ${data.views || ''} views`;
            if (playerDescription) {
                playerDescription.innerHTML = `
                    <div class="mb-4 text-white font-medium flex items-center gap-2">
                        <i class="fas fa-check-circle text-accent-red"></i> ${data.author}
                    </div>
                    <div class="whitespace-pre-wrap">${data.description || 'No description available.'}</div>
                `;
            }

            // HIGH FLUENCY MODE: Use native video element if possible
            if (data.streaming_url && viraPlayer) {
                console.log("VIRA: Direct stream found. Engaging High Fluency Mode...");
                if (embedContainer) embedContainer.classList.add('hidden');
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
            
            if (viraPlayer) viraPlayer.classList.add('hidden');
            if (embedContainer) embedContainer.classList.remove('hidden');
            if (embedIframe) embedIframe.src = window.location.origin + window.__uv$config.prefix + window.__uv$config.encodeUrl(embedUrl);
            
            if (playerTitle && playerTitle.textContent === 'Loading...') {
                playerTitle.textContent = 'YouTube Video';
                playerDescription.textContent = 'Engaged failover mode. Direct metadata unavailable.';
            }
        }
    }

    window.closePlayer = function() {
        window.location.hash = '';
    };

    window.addEventListener('hashchange', loadVideoFromHash);
    
    // Initial check for hash on load
    if (window.location.hash) {
        loadVideoFromHash();
    }

    // Initial load, if there's a predefined query or to show recent videos
});
