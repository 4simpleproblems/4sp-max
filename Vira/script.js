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

    window.playVideo = function(videoId, title, artist, duration) {
        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const playerSection = document.getElementById('player-section');
        const dynamicSection = document.getElementById('dynamic-section');
        const mainPlayer = document.getElementById('main-player');
        const playerTitle = document.getElementById('player-title');
        const playerMetadata = document.getElementById('player-metadata');

        if (window.__uv$config && window.__uv$config.prefix) {
            const proxiedUrl = window.location.origin + window.__uv$config.prefix + window.__uv$config.encodeUrl(youtubeUrl);
            
            // Update UI
            playerTitle.textContent = title;
            playerMetadata.textContent = `${artist} • ${duration}`;
            mainPlayer.src = proxiedUrl;
            
            playerSection.classList.remove('hidden');
            dynamicSection.classList.add('hidden');
            
            // Scroll to top of player
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            console.error("UV proxy not configured, opening directly.");
            window.open(youtubeUrl, '_blank');
        }
    }

    window.closePlayer = function() {
        const playerSection = document.getElementById('player-section');
        const dynamicSection = document.getElementById('dynamic-section');
        const mainPlayer = document.getElementById('main-player');

        playerSection.classList.add('hidden');
        dynamicSection.classList.remove('hidden');
        mainPlayer.src = ''; // Stop video
    }

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
            videoItem.addEventListener('click', () => playVideo(item.id, item.title, item.artist, item.duration));
            videoGrid.appendChild(videoItem);
        });
    }

    // Initial load, if there's a predefined query or to show recent videos
    // For now, let's just show the initial message.
    // You could call searchVideos('trending') or similar here if desired.
});
