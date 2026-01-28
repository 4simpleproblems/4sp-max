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

    async function loadVideoFromHash() {
        const hash = window.location.hash;
        const playerSection = document.getElementById('player-section');
        const dynamicSection = document.getElementById('dynamic-section');
        const embedIframe = document.getElementById('youtube-embed');
        const playerTitle = document.getElementById('player-title');
        const playerMetadata = document.getElementById('player-metadata');
        const playerDescription = document.getElementById('player-description');

        if (!hash.startsWith('#video/')) {
            playerSection.classList.add('hidden');
            dynamicSection.classList.remove('hidden');
            embedIframe.src = '';
            return;
        }

        const videoId = hash.replace('#video/', '');
        
        // Show player, hide results
        playerSection.classList.remove('hidden');
        dynamicSection.classList.add('hidden');
        playerTitle.textContent = 'Loading...';
        playerDescription.textContent = 'Fetching video data...';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });

        try {
            // We still fetch metadata for the UI
            const res = await fetch(`/api/video-info?videoId=${videoId}`);
            const data = await res.json();

            if (!res.ok || data.error) {
                console.error("API Error Response:", data);
                playerTitle.textContent = 'YouTube Video';
                playerDescription.textContent = 'Metadata failed to load, but the video will still attempt to play.';
            } else {
                playerTitle.textContent = data.title;
                playerMetadata.textContent = `${data.author} • ${data.duration}s`;
                playerDescription.textContent = data.description || 'No description available.';
            }

            const baseUrl = instances[currentInstanceIndex];
            const embedUrl = `${baseUrl}/embed/${videoId}?autoplay=1`;
            
            console.log(`VIRA: Attempting instance ${currentInstanceIndex + 1}: ${baseUrl}`);

            // Use UV proxy for the embed URL
            if (window.__uv$config && window.__uv$config.prefix) {
                embedIframe.src = window.location.origin + window.__uv$config.prefix + window.__uv$config.encodeUrl(embedUrl);
            } else {
                embedIframe.src = embedUrl;
            }

        } catch (error) {
            console.error("Failed to setup video playback:", error);
            playerTitle.textContent = 'Playback Setup Error';
            playerDescription.innerHTML = `
                <div class="text-red-500 font-medium mb-2">Failed to initialize the video player.</div>
                <div class="mt-4">
                    <button onclick="closePlayer()" class="text-xs underline hover:text-white">Back to results</button>
                </div>
            `;
        }
    }

    window.closePlayer = function() {
        window.location.hash = '';
    };

    window.addEventListener('hashchange', loadVideoFromHash);
    
    // Initial check
    if (window.location.hash) loadVideoFromHash();

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
                    <p class="text-gray-500 text-xs">${item.duration}</p>
                </div>
            `;
            videoItem.addEventListener('click', () => playVideo(item.id));
            videoGrid.appendChild(videoItem);
        });
    }

    // Initial load, if there's a predefined query or to show recent videos
    // For now, let's just show the initial message.
    // You could call searchVideos('trending') or similar here if desired.
});
