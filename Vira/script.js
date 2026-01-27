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

    window.playVideo = function(videoId) {
        window.location.hash = `video/${videoId}`;
    };

    async function loadVideoFromHash() {
        const hash = window.location.hash;
        const playerSection = document.getElementById('player-section');
        const dynamicSection = document.getElementById('dynamic-section');
        const videoPlayer = document.getElementById('custom-video-player');
        const playerTitle = document.getElementById('player-title');
        const playerMetadata = document.getElementById('player-metadata');
        const playerDescription = document.getElementById('player-description');

        if (!hash.startsWith('#video/')) {
            playerSection.classList.add('hidden');
            dynamicSection.classList.remove('hidden');
            videoPlayer.pause();
            videoPlayer.src = '';
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
            const res = await fetch(`/api/video-info?videoId=${videoId}`);
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            playerTitle.textContent = data.title;
            playerMetadata.textContent = `${data.author} • ${data.duration}s`;
            playerDescription.textContent = data.description || 'No description available.';

            if (data.streaming_url) {
                // Use UV proxy for the stream URL to bypass CORS/IP blocks
                if (window.__uv$config && window.__uv$config.prefix) {
                    videoPlayer.src = window.location.origin + window.__uv$config.prefix + window.__uv$config.encodeUrl(data.streaming_url);
                } else {
                    videoPlayer.src = data.streaming_url;
                }
                videoPlayer.play().catch(e => console.warn("Autoplay blocked or failed:", e));
            } else {
                playerDescription.textContent = 'Error: Could not retrieve a valid streaming URL.';
            }

        } catch (error) {
            console.error("Failed to load video info:", error);
            playerTitle.textContent = 'Error';
            playerDescription.textContent = 'Failed to load video information. It might be age-restricted or unavailable in your region.';
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
