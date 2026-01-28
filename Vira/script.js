document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const videoGrid = document.getElementById('videoGrid');
    const noResultsMessage = document.getElementById('noResultsMessage');
    const playerSection = document.getElementById('player-section');
    const dynamicSection = document.getElementById('dynamic-section');
    const viraPlayer = document.getElementById('vira-player');
    const embedContainer = document.getElementById('embed-container');
    const embedIframe = document.getElementById('youtube-embed');
    const playerTitle = document.getElementById('player-title');
    const playerMetadata = document.getElementById('player-metadata');
    const playerDescription = document.getElementById('player-description');
    const searchCloseBtn = document.getElementById('searchCloseBtn');

    let currentCategory = 'youtube';
    const instances = [
        'https://invidious.nerdvpn.de',
        'https://iv.melmac.space',
        'https://invidious.no-logs.com',
        'https://yewtu.be',
        'https://inv.zzls.xyz'
    ];
    let currentInstanceIndex = 0;

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                window.location.hash = ''; // Return to grid
                searchVideos(query);
            }
        }
    });

    window.switchCategory = function(cat) {
        currentCategory = cat;
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
        const catEl = document.getElementById(`cat-${cat}`);
        if (catEl) catEl.classList.add('active');
        
        const title = document.querySelector('h2.text-2xl');
        if (title) title.textContent = cat === 'youtube' ? 'Explore YouTube' : 'Explore YouTube Music';
        
        closePlayer();
        const query = searchInput.value.trim();
        if (query) searchVideos(query);
    };

    async function searchVideos(query) {
        if (!videoGrid) return;
        videoGrid.innerHTML = '';
        noResultsMessage.classList.add('hidden');
        videoGrid.innerHTML = '<p class="text-gray-500 text-center col-span-full">Searching...</p>';

        try {
            const searchRes = await fetch(`/api/search?query=${encodeURIComponent(query)}&type=all&category=${currentCategory}`);
            const data = await searchRes.json();

            if (data.results && data.results.length > 0) {
                renderResults(data.results);
            } else {
                noResultsMessage.textContent = 'No results found for your search.';
                noResultsMessage.classList.remove('hidden');
                videoGrid.innerHTML = '';
            }
        } catch (error) {
            console.error("Failed to fetch search results:", error);
            videoGrid.innerHTML = `<p class="text-red-500 text-center col-span-full">Failed to load results. Error: ${error.message}</p>`;
            noResultsMessage.classList.add('hidden');
        }
    }

    function renderResults(results) {
        videoGrid.innerHTML = '';
        results.forEach(item => {
            const resultItem = document.createElement('div');
            
            if (item.type === 'video') {
                resultItem.classList.add('video-item', 'relative', 'group');
                resultItem.innerHTML = `
                    <div class="thumbnail-container">
                        <img src="${item.thumbnail}" alt="${item.title}" class="w-full h-full object-cover">
                        <div class="play-overlay">
                            <i class="fas fa-play play-icon"></i>
                        </div>
                    </div>
                    <div class="p-4">
                        <h3 class="text-white text-base font-medium mb-1 line-clamp-2" title="${item.title}">${item.title}</h3>
                        <p class="text-gray-400 text-sm hover:text-white cursor-pointer transition-colors" onclick="event.stopPropagation(); viewChannel('${item.artistId}')">
                            ${item.artist}
                        </p>
                        <div class="flex justify-between items-center mt-2">
                            <p class="text-gray-500 text-xs">${item.duration}</p>
                            <p class="text-gray-500 text-[10px]">${item.views || ''} • ${item.published || ''}</p>
                        </div>
                    </div>
                `;
                resultItem.addEventListener('click', () => playVideo(item.id));
            } else if (item.type === 'channel') {
                resultItem.classList.add('flex', 'flex-col', 'items-center', 'justify-center', 'p-6', 'bg-card-dark', 'border', 'border-brand-border', 'rounded-[16px]', 'hover:border-accent-red', 'transition-all', 'cursor-pointer', 'col-span-full', 'md:col-span-1');
                resultItem.innerHTML = `
                    <img src="${item.thumbnail}" class="w-24 h-24 rounded-full mb-4 border-2 border-brand-border group-hover:border-accent-red transition-all" alt="${item.title}">
                    <h3 class="text-white text-lg font-medium mb-1 text-center">${item.title}</h3>
                    <p class="text-gray-500 text-sm mb-2 text-center">${item.subscribers} • ${item.video_count}</p>
                    <p class="text-gray-400 text-xs text-center line-clamp-2">${item.description}</p>
                `;
                resultItem.addEventListener('click', () => viewChannel(item.id));
            }
            videoGrid.appendChild(resultItem);
        });
    }

    window.playVideo = function(videoId) {
        window.location.hash = `video/${videoId}`;
    };

    window.viewChannel = function(channelId) {
        window.location.hash = `channel/${channelId}`;
    };

    window.switchInstance = function() {
        if (viraPlayer && !viraPlayer.classList.contains('hidden')) {
            viraPlayer.classList.add('hidden');
            viraPlayer.pause();
            viraPlayer.src = '';
            if (embedContainer) embedContainer.classList.remove('hidden');
        } else {
            currentInstanceIndex = (currentInstanceIndex + 1) % instances.length;
        }
        loadVideoFromHash();
    };

    async function loadVideoFromHash() {
        const hash = window.location.hash;

        if (hash.startsWith('#channel/')) {
            const channelId = hash.replace('#channel/', '');
            if (playerSection) playerSection.classList.add('hidden');
            if (dynamicSection) dynamicSection.classList.remove('hidden');
            if (viraPlayer) { viraPlayer.pause(); viraPlayer.src = ''; }
            if (embedIframe) embedIframe.src = '';
            searchVideos(channelId); 
            return;
        }

        if (!hash.startsWith('#video/')) {
            if (playerSection) playerSection.classList.add('hidden');
            if (dynamicSection) dynamicSection.classList.remove('hidden');
            if (viraPlayer) { viraPlayer.pause(); viraPlayer.src = ''; }
            if (embedIframe) embedIframe.src = '';
            if (searchCloseBtn) searchCloseBtn.classList.add('hidden');
            return;
        }

        const videoId = hash.replace('#video/', '');
        if (playerSection) playerSection.classList.remove('hidden');
        if (dynamicSection) dynamicSection.classList.add('hidden');
        if (searchCloseBtn) searchCloseBtn.classList.remove('hidden');
        
        if (playerTitle) playerTitle.textContent = 'Loading...';
        if (playerDescription) playerDescription.textContent = 'Preparing stream...';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });

        try {
            const res = await fetch(`/api/video-info?videoId=${videoId}`);
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            if (playerTitle) playerTitle.textContent = data.title;
            if (playerMetadata) {
                playerMetadata.innerHTML = `
                    <span class="text-gray-400">${data.author}</span> • 
                    <span class="text-gray-500">${data.duration}s</span> • 
                    <span class="text-gray-500">${data.views || ''} views</span>
                `;
            }
            if (playerDescription) {
                playerDescription.innerHTML = `
                    <div class="mb-4 text-white font-medium flex items-center gap-2">
                        <span class="hover:underline cursor-pointer" onclick="viewChannel('${data.channel_id}')">
                            <i class="fas fa-check-circle text-accent-red"></i> ${data.author}
                        </span>
                    </div>
                    <div class="whitespace-pre-wrap">${data.description || 'No description available.'}</div>
                `;
            }

            if (data.streaming_url && viraPlayer) {
                if (embedContainer) embedContainer.classList.add('hidden');
                viraPlayer.classList.remove('hidden');
                viraPlayer.src = window.location.origin + window.__uv$config.prefix + window.__uv$config.encodeUrl(data.streaming_url);
                viraPlayer.play().catch(() => {});
            } else {
                throw new Error("Direct stream unavailable");
            }
        } catch (error) {
            console.error("VIRA Error:", error);
            const baseUrl = instances[currentInstanceIndex];
            const embedUrl = `${baseUrl}/embed/${videoId}?autoplay=1`;
            if (viraPlayer) viraPlayer.classList.add('hidden');
            if (embedContainer) embedContainer.classList.remove('hidden');
            if (embedIframe) embedIframe.src = window.location.origin + window.__uv$config.prefix + window.__uv$config.encodeUrl(embedUrl);
        }
    }

    window.closePlayer = function() {
        window.location.hash = '';
    };

    window.addEventListener('hashchange', loadVideoFromHash);
    if (window.location.hash) loadVideoFromHash();
});