document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
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
    const dynamicTitle = document.getElementById('dynamic-title');

    // --- State ---
    let currentCategory = 'youtube';
    let library = { playlists: [] };
    let itemToAdd = null;
    let currentInstanceIndex = 0;
    
    const instances = [
        'https://invidious.nerdvpn.de',
        'https://iv.melmac.space',
        'https://invidious.no-logs.com',
        'https://yewtu.be',
        'https://inv.zzls.xyz'
    ];

    // --- Helpers ---
    const getEl = (id) => document.getElementById(id);
    const hide = (el) => el && el.classList.add('hidden');
    const show = (el) => el && el.classList.remove('hidden');

    // --- Initialization ---
    loadLibrary();
    renderPlaylistSidebar();

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = searchInput.value.trim();
                if (query) {
                    window.location.hash = ''; // Clear video state
                    searchVideos(query);
                }
            }
        });
    }

    // --- Library Management ---
    function loadLibrary() {
        const stored = localStorage.getItem('vira_library');
        if (stored) {
            try {
                library = JSON.parse(stored);
                if (!library.playlists) library.playlists = [];
            } catch (e) {
                console.error("Library parse failed:", e);
                library = { playlists: [] };
            }
        }
        renderPlaylistSidebar();
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
            link.className = 'nav-link flex items-center gap-2 px-4 py-2 hover:bg-white/5 rounded-lg transition-all';
            link.innerHTML = "<i class=\"fas fa-list text-gray-500\"></i> <span class=\"truncate text-sm\">${pl.name}</span>";
            link.onclick = () => window.location.hash = `playlist/${pl.id}`;
            playlistList.appendChild(link);
        });
    }

    window.openCreatePlaylistModal = () => {
        const modal = getEl('create-playlist-modal');
        if (modal) show(modal);
        const input = getEl('new-playlist-name');
        if (input) { input.value = ''; input.focus(); }
    };

    window.closeModals = () => {
        document.querySelectorAll('[id$="-modal"]').forEach(hide);
        itemToAdd = null;
    };

    window.confirmCreatePlaylist = () => {
        const input = getEl('new-playlist-name');
        const name = input ? input.value.trim() : '';
        if (name) {
            library.playlists.push({ id: 'pl-' + Date.now(), name, videos: [] });
            saveLibrary();
            closeModals();
        }
    };

    window.addToPlaylist = (item) => {
        if (library.playlists.length === 0) {
            window.openCreatePlaylistModal();
            return;
        }
        itemToAdd = item;
        const list = getEl('modal-playlist-list');
        if (list) {
            list.innerHTML = '';
            library.playlists.forEach(pl => {
                const btn = document.createElement('button');
                btn.className = 'w-full text-left p-4 bg-black/40 hover:bg-accent-red hover:text-white rounded-[12px] transition-all flex justify-between items-center group';
                btn.innerHTML = `<span>${pl.name}</span> <span class="text-xs opacity-60 group-hover:opacity-100">${pl.videos.length} videos</span>`;
                btn.onclick = () => {
                    const exists = pl.videos.some(v => v.id === itemToAdd.id);
                    if (!exists) {
                        pl.videos.push({...itemToAdd});
                        saveLibrary();
                    }
                    closeModals();
                };
                list.appendChild(btn);
            });
        }
        show(getEl('add-to-playlist-modal'));
    };

    window.deletePlaylist = (plId) => {
        if (confirm("Delete this playlist?")) {
            library.playlists = library.playlists.filter(p => p.id !== plId);
            saveLibrary();
            window.location.hash = '';
            const title = document.querySelector('h2.text-2xl');
            if (title) title.textContent = 'Explore YouTube';
            searchVideos('trending');
        }
    };

    // --- Search & Results ---
    async function searchVideos(query) {
        if (!videoGrid) return;
        videoGrid.innerHTML = '<div class="col-span-full py-20 flex flex-col items-center gap-4 text-gray-500"><i class="fas fa-circle-notch fa-spin text-3xl"></i><p>Searching YouTube...</p></div>';
        if (noResultsMessage) hide(noResultsMessage);

        try {
            const res = await fetch(`/api/search?query=${encodeURIComponent(query)}&category=${currentCategory}`);
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                renderResults(data.results);
            } else {
                if (noResultsMessage) {
                    noResultsMessage.textContent = 'No results found.';
                    show(noResultsMessage);
                }
                videoGrid.innerHTML = '';
            }
        } catch (e) {
            videoGrid.innerHTML = `<p class="text-red-500 text-center col-span-full py-20">Search failed: ${e.message}</p>`;
        }
    }

    function renderResults(results) {
        if (!videoGrid) return;
        videoGrid.innerHTML = '';
        results.forEach(item => {
            const resultItem = document.createElement('div');
            
            if (item.type === 'video') {
                resultItem.classList.add('video-item', 'relative', 'group');
                resultItem.innerHTML = "                <div class=\"thumbnail-container\">
                    <img src=\"${item.thumbnail}\" alt=\"" class="w-full h-full object-cover">
                    <div class="play-overlay"><i class="fas fa-play play-icon"></i></div>
                    <button class="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-accent-red z-10 add-pl-btn" title="Add to Playlist">
                        <i class="fas fa-plus text-xs"></i>
                    </button>
                </div>
                <div class="p-4">
                    <h3 class="text-white text-base font-medium mb-1 line-clamp-2" title=\"${item.title}\">${item.title}</h3>
                    <p class="text-gray-400 text-sm hover:text-white cursor-pointer transition-colors author-link" onclick="event.stopPropagation(); window.location.hash='channel/${item.artistId}'">
                        ${item.artist}
                    </p>
                    <div class="flex justify-between items-center mt-2 text-gray-500 text-xs">
                        <span>${item.duration}</span><span>${item.views || ''}</span>
                    </div>
                </div>
";
                resultItem.addEventListener('click', (e) => {
                    if (e.target.closest('.add-pl-btn') || e.target.closest('.author-link')) return;
                    window.location.hash = `video/${item.id}`;
                });
                const addBtn = resultItem.querySelector('.add-pl-btn');
                if (addBtn) addBtn.onclick = (e) => {
                    e.stopPropagation();
                    window.addToPlaylist(item);
                };
            } else if (item.type === 'channel' || item.type === 'channel_header') {
                const isHeader = item.type === 'channel_header';
                resultItem.className = 'flex flex-col items-center p-8 bg-card-dark border border-brand-border rounded-[24px] col-span-full mb-8';
                if (isHeader) resultItem.classList.add('bg-gradient-to-b', 'from-zinc-900', 'to-black');
                else resultItem.classList.add('cursor-pointer', 'hover:border-accent-red', 'transition-all', 'group');
                
                resultItem.innerHTML = "                <div class=\"flex flex-col md:flex-row items-center gap-8 w-full max-w-4xl\">
                    <img src=\"${item.thumbnail}\" class="w-32 h-32 rounded-full border-4 border-brand-border bg-black shadow-2xl transition-transform group-hover:scale-105" alt="${item.title}">
                    <div class="flex-grow text-center md:text-left">
                        <h2 class="text-3xl text-white font-medium mb-2">${item.title}</h2>
                        <p class="text-gray-400 text-sm leading-relaxed line-clamp-3">${item.description || 'No channel description available.'}</p>
                    </div>
                </div>
                ${isHeader ? '<div class="w-full h-px bg-brand-border mt-12 mb-4"></div><h3 class="text-white text-xl self-start px-4">Latest Videos</h3>' : ''}
";
                if (!isHeader) resultItem.addEventListener('click', () => window.location.hash = `channel/${item.id}`);
            }
            videoGrid.appendChild(resultItem);
        });
    }

    // --- Navigation & Player ---
    window.switchInstance = () => {
        if (viraPlayer && !viraPlayer.classList.contains('hidden')) {
            viraPlayer.classList.add('hidden');
            viraPlayer.pause();
            viraPlayer.src = '';
            if (embedContainer) show(embedContainer);
        } else {
            currentInstanceIndex = (currentInstanceIndex + 1) % instances.length;
        }
        loadVideoFromHash();
    };

    async function loadVideoFromHash() {
        const hash = window.location.hash;
        if (!playerSection || !dynamicSection) return;

        if (hash.startsWith('#playlist/')) {
            const plId = hash.replace('#playlist/', '');
            const pl = library.playlists.find(p => p.id === plId);
            if (!pl) return;
            
            hide(playerSection); show(dynamicSection);
            if (viraPlayer) { viraPlayer.pause(); viraPlayer.src = ''; }
            if (embedIframe) embedIframe.src = '';
            
            const title = document.querySelector('h2.text-2xl');
            if (title) title.textContent = `Playlist: ${pl.name}`;
            if (dynamicTitle) dynamicTitle.textContent = pl.name;
            
            if (pl.videos && pl.videos.length > 0) {
                renderResults(pl.videos);
                const delContainer = document.createElement('div');
                delContainer.className = 'col-span-full flex justify-center mt-12 pt-8 border-t border-brand-border';
                delContainer.innerHTML = `<button onclick="deletePlaylist('${pl.id}')" class="text-red-500 text-xs hover:underline flex items-center gap-2"><i class="fas fa-trash"></i> Delete Playlist</button>`;
                videoGrid.appendChild(delContainer);
            } else {
                videoGrid.innerHTML = '<div class="col-span-full py-20 flex flex-col items-center gap-4 text-gray-500 italic"><p>This playlist is empty.</p><button onclick="deletePlaylist(\'"+pl.id+"\')" class="text-xs underline">Delete Playlist</button></div>';
            }
            return;
        }

        if (hash.startsWith('#channel/')) {
            const channelId = hash.replace('#channel/', '');
            hide(playerSection); show(dynamicSection);
            if (viraPlayer) { viraPlayer.pause(); viraPlayer.src = ''; }
            if (embedIframe) embedIframe.src = '';
            if (dynamicTitle) dynamicTitle.textContent = 'Channel View';
            searchVideos(channelId); 
            return;
        }

        if (!hash.startsWith('#video/')) {
            hide(playerSection); show(dynamicSection);
            if (searchCloseBtn) hide(searchCloseBtn);
            if (viraPlayer) { viraPlayer.pause(); viraPlayer.src = ''; }
            if (embedIframe) embedIframe.src = '';
            const mainTitle = document.querySelector('h2.text-2xl');
            if (mainTitle && !mainTitle.textContent.startsWith('Playlist:')) {
                mainTitle.textContent = 'Explore YouTube';
            }
            if (dynamicTitle) dynamicTitle.textContent = 'Search Results';
            return;
        }

        const videoId = hash.replace('#video/', '');
        show(playerSection); hide(dynamicSection);
        if (searchCloseBtn) show(searchCloseBtn);
        
        if (playerTitle) playerTitle.textContent = 'Loading...';
        if (playerDescription) playerDescription.innerHTML = '<p class="text-gray-500 italic">Preparing stream...</p>';
        if (playerMetadata) playerMetadata.textContent = '';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });

        try {
            const res = await fetch(`/api/video-info?videoId=${videoId}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            if (playerTitle) playerTitle.textContent = data.title;
            if (playerMetadata) {
                playerMetadata.innerHTML = "                <span class=\"text-gray-400 font-medium cursor-pointer hover:underline\" onclick=\"window.location.hash='channel/${data.channel_id}'\">${data.author}</span> • 
                <span class=\"text-gray-500\">${data.duration}</span> • 
                <span class=\"text-gray-500\">${data.views}</span>
            ";
            }
            if (playerDescription) {
                playerDescription.innerHTML = "                <div class=\"mb-6 flex items-center gap-4\">
                    <span class=\"hover:underline cursor-pointer flex items-center gap-2 text-white font-medium\" onclick=\"window.location.hash='channel/${data.channel_id}'\">
                        <i class=\"fas fa-check-circle text-accent-red\"></i> ${data.author}
                    </span>
                    <button id=\"player-add-pl-btn\" class=\"text-xs bg-brand-border px-3 py-1 rounded-full hover:bg-accent-red transition-all text-white\">
                        <i class=\"fas fa-plus\"></i> Add to Playlist
                    </button>
                </div>
                <div class=\"whitespace-pre-wrap text-sm leading-relaxed\">${data.description || 'No description available.'}</div>
";
                const addBtn = document.getElementById('player-add-pl-btn');
                if (addBtn) addBtn.onclick = () => window.addToPlaylist({
                    type: 'video', id: videoId, title: data.title, artist: data.author, artistId: data.channel_id,
                    thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`, duration: data.duration, views: data.views
                });
            }

            if (data.streaming_url && viraPlayer) {
                hide(embedContainer); show(viraPlayer);
                viraPlayer.src = window.location.origin + window.__uv$config.prefix + window.__uv$config.encodeUrl(data.streaming_url);
                viraPlayer.play().catch(() => {});
            } else { throw new Error("Direct stream unavailable"); }

        } catch (error) {
            console.warn("VIRA: Direct pulling failed, using failover:", error);
            const baseUrl = instances[currentInstanceIndex];
            const embedUrl = `${baseUrl}/embed/${videoId}?autoplay=1`;
            if (viraPlayer) { hide(viraPlayer); viraPlayer.pause(); }
            show(embedContainer);
            if (embedIframe) embedIframe.src = window.location.origin + window.__uv$config.prefix + window.__uv$config.encodeUrl(embedUrl);
        }
    }

    window.closePlayer = () => { window.location.hash = ''; };

    window.addEventListener('hashchange', loadVideoFromHash);
    if (window.location.hash) loadVideoFromHash();
});
