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
    const playlistList = document.getElementById('playlist-list');

    let currentCategory = 'youtube';
    let library = { playlists: [] };
    let itemToAdd = null;

    const instances = [
        'https://invidious.nerdvpn.de',
        'https://iv.melmac.space',
        'https://invidious.no-logs.com',
        'https://yewtu.be',
        'https://inv.zzls.xyz'
    ];
    let currentInstanceIndex = 0;

    // --- Initialization ---
    loadLibrary();
    renderPlaylistSidebar();

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query) {
                window.location.hash = ''; // Return to grid
                searchVideos(query);
            }
        }
    });

    // --- Library / Playlists ---
    function loadLibrary() {
        const stored = localStorage.getItem('vira_library');
        if (stored) {
            library = JSON.parse(stored);
        } else {
            // Initial empty library
            saveLibrary();
        }
    }

    function saveLibrary() {
        localStorage.setItem('vira_library', JSON.stringify(library));
        renderPlaylistSidebar();
    }

    function renderPlaylistSidebar() {
        if (!playlistList) return;
        playlistList.innerHTML = '';
        library.playlists.forEach(pl => {
            const link = document.createElement('a');
            link.href = 'javascript:void(0)';
            link.className = 'nav-link';
            link.innerHTML = `<i class="fas fa-list"></i> <span>${pl.name}</span>`;
            link.onclick = () => openPlaylist(pl.id);
            playlistList.appendChild(link);
        });
    }

    window.openCreatePlaylistModal = function() {
        document.getElementById('create-playlist-modal').classList.remove('hidden');
        document.getElementById('new-playlist-name').focus();
    };

    window.closeModals = function() {
        document.querySelectorAll('[id$="-modal"]').forEach(m => m.classList.add('hidden'));
        itemToAdd = null;
    };

    window.confirmCreatePlaylist = function() {
        const nameInput = document.getElementById('new-playlist-name');
        const name = nameInput.value.trim();
        if (name) {
            const newPl = {
                id: 'pl-' + Date.now(),
                name: name,
                videos: []
            };
            library.playlists.push(newPl);
            saveLibrary();
            nameInput.value = '';
            closeModals();
        }
    };

    window.addToPlaylist = function(item) {
        if (library.playlists.length === 0) {
            openCreatePlaylistModal();
            return;
        }
        itemToAdd = item;
        const modal = document.getElementById('add-to-playlist-modal');
        const list = document.getElementById('modal-playlist-list');
        list.innerHTML = '';
        library.playlists.forEach(pl => {
            const btn = document.createElement('button');
            btn.className = 'w-full text-left p-4 bg-black/40 hover:bg-accent-red hover:text-white rounded-[12px] transition-all flex justify-between items-center';
            btn.innerHTML = `<span>${pl.name}</span> <span class="text-xs opacity-60">${pl.videos.length} videos</span>`;
            btn.onclick = () => confirmAddToPlaylist(pl.id);
            list.appendChild(btn);
        });
        modal.classList.remove('hidden');
    };

    async function confirmAddToPlaylist(plId) {
        if (!itemToAdd) return;
        const pl = library.playlists.find(p => p.id === plId);
        if (pl) {
            const exists = pl.videos.some(v => v.id === itemToAdd.id);
            if (!exists) {
                pl.videos.push(itemToAdd);
                saveLibrary();
            }
        }
        closeModals();
    }

    function openPlaylist(plId) {
        window.location.hash = `playlist/${plId}`;
    }

    // --- Search & Results ---
    window.switchCategory = function(cat) {
        currentCategory = cat;
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
        const catEl = document.getElementById(`cat-${cat}`);
        if (catEl) catEl.classList.add('active');
        
        const title = document.querySelector('h2.text-2xl');
        if (title) title.textContent = 'Explore YouTube';
        
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
                        <button class="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-accent-red add-pl-btn" title="Add to Playlist">
                            <i class="fas fa-plus text-xs"></i>
                        </button>
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
                resultItem.addEventListener('click', (e) => {
                    if (e.target.closest('.add-pl-btn')) return;
                    playVideo(item.id);
                });
                resultItem.querySelector('.add-pl-btn').onclick = (e) => {
                    e.stopPropagation();
                    addToPlaylist(item);
                };
            } else if (item.type === 'channel' || item.type === 'channel_header') {
                const isHeader = item.type === 'channel_header';
                resultItem.classList.add('flex', 'flex-col', 'items-center', 'justify-center', 'p-8', 'bg-card-dark', 'border', 'border-brand-border', 'rounded-[24px]', 'col-span-full', 'mb-8');
                if (isHeader) resultItem.classList.add('bg-gradient-to-b', 'from-zinc-900', 'to-black');
                
                resultItem.innerHTML = `
                    <div class="flex flex-col md:flex-row items-center gap-8 w-full max-w-4xl">
                        <img src="${item.thumbnail}" class="w-32 h-32 rounded-full border-4 border-brand-border shadow-2xl" alt="${item.title}">
                        <div class="flex-grow text-center md:text-left">
                            <h2 class="text-3xl text-white font-medium mb-2">${item.title}</h2>
                            <p class="text-gray-400 text-sm leading-relaxed">${item.description || 'No channel description available.'}</p>
                        </div>
                    </div>
                    ${isHeader ? '<div class="w-full h-px bg-brand-border mt-12 mb-4"></div><h3 class="text-white text-xl self-start px-4">Latest Videos</h3>' : ''}
                `;
                if (!isHeader) resultItem.addEventListener('click', () => viewChannel(item.id));
            }
            videoGrid.appendChild(resultItem);
        });
    }

    // --- Navigation & Player ---
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

        if (hash.startsWith('#playlist/')) {
            const plId = hash.replace('#playlist/', '');
            const pl = library.playlists.find(p => p.id === plId);
            if (!pl) return;
            
            playerSection.classList.add('hidden');
            dynamicSection.classList.remove('hidden');
            const title = document.querySelector('h2.text-2xl');
            title.textContent = `Playlist: ${pl.name}`;
            
            if (pl.videos.length > 0) {
                renderResults(pl.videos);
            } else {
                videoGrid.innerHTML = '<p class="text-gray-500 text-center col-span-full py-20">This playlist is empty.</p>';
            }
            return;
        }

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
                    <span class="text-gray-400 font-medium hover:underline cursor-pointer" onclick="viewChannel('${data.channel_id}')">${data.author}</span> • 
                    <span class="text-gray-500">${data.duration}</span> • 
                    <span class="text-gray-500">${data.views}</span> • 
                    <span class="text-gray-500">${data.published || ''}</span>
                `;
            }
            if (playerDescription) {
                playerDescription.innerHTML = `
                    <div class="mb-4 text-white font-medium flex items-center gap-4">
                        <span class="hover:underline cursor-pointer flex items-center gap-2" onclick="viewChannel('${data.channel_id}')">
                            <i class="fas fa-check-circle text-accent-red"></i> ${data.author}
                        </span>
                        <button onclick='addToPlaylist(${JSON.stringify({id: videoId, title: data.title, artist: data.author, artistId: data.channel_id, thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`, duration: data.duration, views: data.views, published: data.published, type: "video"}).replace(/'/g, "&apos;")})' class="text-xs bg-brand-border px-3 py-1 rounded-full hover:bg-accent-red transition-all">
                            <i class="fas fa-plus"></i> Add to Playlist
                        </button>
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
