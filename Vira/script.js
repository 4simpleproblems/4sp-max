document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    let currentCategory = 'youtube';
    let library = { playlists: [] };
    let itemToAdd = null;
    let currentInstanceIndex = 0;
    
    const instances = [
        window.location.origin + '/api/local-instance',
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

    const searchInput = getEl('searchInput');
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
            } catch (e) { library = { playlists: [] }; }
        }
        renderPlaylistSidebar();
    }

    function saveLibrary() {
        localStorage.setItem('vira_library', JSON.stringify(library));
        renderPlaylistSidebar();
    }

    function renderPlaylistSidebar() {
        const list = getEl('playlist-list');
        if (!list) return;
        list.innerHTML = '';
        library.playlists.forEach(pl => {
            const link = document.createElement('a');
            link.href = 'javascript:void(0)';
            link.className = 'nav-link';
            link.innerHTML = `<i class="fas fa-list"></i> <span class="truncate">${pl.name}</span>`;
            link.onclick = () => window.location.hash = `playlist/${pl.id}`;
            list.appendChild(link);
        });
    }

    window.openCreatePlaylistModal = () => {
        show(getEl('create-playlist-modal'));
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
            searchVideos('trending');
        }
    };

    // --- Core Logic ---
    window.switchCategory = (cat) => {
        currentCategory = cat;
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
        const catEl = getEl(`cat-${cat}`);
        if (catEl) catEl.classList.add('active');
        closePlayer();
        const query = searchInput ? searchInput.value.trim() : '';
        if (query) searchVideos(query);
    };

    async function searchVideos(query) {
        const grid = getEl('videoGrid');
        if (!grid) return;
        grid.innerHTML = '<div class="col-span-full py-20 flex flex-col items-center gap-4 text-gray-500"><i class="fas fa-circle-notch fa-spin text-3xl"></i><p>Searching YouTube...</p></div>';
        hide(getEl('noResultsMessage'));

        try {
            const res = await fetch(`/api/search?query=${encodeURIComponent(query)}&category=${currentCategory}`);
            const data = await res.json();
            if (data.results && data.results.length > 0) renderResults(data.results);
            else grid.innerHTML = '<p class="text-gray-500 text-center col-span-full py-20">No results found.</p>';
        } catch (e) {
            grid.innerHTML = `<p class="text-red-500 text-center col-span-full py-20">Search failed: ${e.message}</p>`;
        }
    }

    function renderResults(results) {
        const grid = getEl('videoGrid');
        if (!grid) return;
        grid.innerHTML = '';
        results.forEach(item => {
            const card = document.createElement('div');
            if (item.type === 'video') {
                card.className = 'video-item relative group';
                card.innerHTML = `
                    <div class="thumbnail-container">
                        <img src="${item.thumbnail}" alt="" class="w-full h-full object-cover">
                        <div class="play-overlay"><i class="fas fa-play play-icon"></i></div>
                        <button class="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-accent-red z-10" onclick="event.stopPropagation(); addToPlaylist(${JSON.stringify(item).replace(/'/g, "&apos;")})">
                            <i class="fas fa-plus text-xs"></i>
                        </button>
                    </div>
                    <div class="p-4">
                        <h3 class="text-white text-base font-medium mb-1 line-clamp-2">${item.title}</h3>
                        <p class="text-gray-400 text-sm hover:text-white cursor-pointer" onclick="event.stopPropagation(); window.location.hash='channel/${item.artistId}'">${item.artist}</p>
                        <div class="flex justify-between items-center mt-2 text-gray-500 text-xs">
                            <span>${item.duration}</span><span>${item.views || ''}</span>
                        </div>
                    </div>
                `;
                card.onclick = () => window.location.hash = `video/${item.id}`;
            } else if (item.type === 'channel' || item.type === 'channel_header') {
                const isHeader = item.type === 'channel_header';
                card.className = 'flex flex-col items-center p-8 bg-card-dark border border-brand-border rounded-[24px] col-span-full mb-8';
                if (isHeader) card.classList.add('bg-gradient-to-b', 'from-zinc-900', 'to-black');
                else card.classList.add('cursor-pointer', 'hover:border-accent-red', 'transition-all');
                
                card.innerHTML = `
                    <div class="flex flex-col md:flex-row items-center gap-8 w-full max-w-4xl">
                        <img src="${item.thumbnail}" class="w-32 h-32 rounded-full border-4 border-brand-border bg-black shadow-2xl">
                        <div class="flex-grow text-center md:text-left">
                            <h2 class="text-3xl text-white font-medium mb-2">${item.title}</h2>
                            <p class="text-gray-400 text-sm leading-relaxed">${item.description || ''}</p>
                        </div>
                    </div>
                    ${isHeader ? '<div class="w-full h-px bg-brand-border mt-12 mb-4"></div><h3 class="text-white text-xl self-start px-4">Latest Videos</h3>' : ''}
                `;
                if (!isHeader) card.onclick = () => window.location.hash = `channel/${item.id}`;
            }
            grid.appendChild(card);
        });
    }

    // --- Player Logic ---
    async function loadVideoFromHash() {
        const hash = window.location.hash;
        const playerSec = getEl('player-section');
        const gridSec = getEl('dynamic-section');
        const viraPlayer = getEl('vira-player');
        const embedCont = getEl('embed-container');
        const embedIframe = getEl('youtube-embed');
        const closeBtn = getEl('searchCloseBtn');
        
        if (!playerSec || !gridSec) return;

        if (hash.startsWith('#playlist/')) {
            const pl = library.playlists.find(p => p.id === hash.replace('#playlist/', ''));
            if (!pl) return;
            hide(playerSec); show(gridSec);
            if (viraPlayer) { viraPlayer.pause(); viraPlayer.src = ''; }
            if (embedIframe) embedIframe.src = '';
            document.querySelector('h2.text-2xl').textContent = `Playlist: ${pl.name}`;
            getEl('dynamic-title').textContent = pl.name;
            renderResults(pl.videos);
            const delBox = document.createElement('div');
            delBox.className = 'col-span-full flex justify-center mt-10';
            delBox.innerHTML = `<button onclick="deletePlaylist('${pl.id}')" class="text-red-500 text-xs hover:underline">Delete Playlist</button>`;
            getEl('videoGrid').appendChild(delBox);
            return;
        }

        if (hash.startsWith('#channel/')) {
            hide(playerSec); show(gridSec);
            if (viraPlayer) { viraPlayer.pause(); viraPlayer.src = ''; }
            if (embedIframe) embedIframe.src = '';
            getEl('dynamic-title').textContent = 'Channel View';
            searchVideos(hash.replace('#channel/', ''));
            return;
        }

        if (!hash.startsWith('#video/')) {
            hide(playerSec); show(gridSec); hide(closeBtn);
            if (viraPlayer) { viraPlayer.pause(); viraPlayer.src = ''; }
            if (embedIframe) embedIframe.src = '';
            return;
        }

        const videoId = hash.replace('#video/', '');
        show(playerSec); hide(gridSec); show(closeBtn);
        getEl('player-title').textContent = 'Loading...';
        getEl('player-description').textContent = 'Connecting to stream...';
        window.scrollTo({ top: 0, behavior: 'smooth' });

        try {
            const res = await fetch(`/api/video-info?videoId=${videoId}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            getEl('player-title').textContent = data.title;
            getEl('player-metadata').innerHTML = `<span class="text-gray-400 font-medium cursor-pointer hover:underline" onclick="window.location.hash='channel/${data.channel_id}'">${data.author}</span> • <span class="text-gray-500">${data.duration}</span> • <span class="text-gray-500">${data.views}</span>`;
            getEl('player-description').innerHTML = `<div class="whitespace-pre-wrap">${data.description}</div><button id="player-add-btn" class="mt-6 bg-brand-border px-4 py-2 rounded-full text-xs hover:bg-accent-red transition-all">Add to Playlist</button>`;
            
            const addBtn = getEl('player-add-btn');
            if (addBtn) addBtn.onclick = () => window.addToPlaylist({
                type: 'video',
                id: videoId,
                title: data.title,
                artist: data.author,
                artistId: data.channel_id,
                thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
                duration: data.duration,
                views: data.views
            });

            if (data.streaming_url && viraPlayer) {
                hide(embedCont); show(viraPlayer);
                viraPlayer.src = window.location.origin + window.__uv$config.prefix + window.__uv$config.encodeUrl(data.streaming_url);
                viraPlayer.play().catch(() => {});
            } else { throw new Error("No stream"); }
        } catch (error) {
            console.warn("VIRA: Direct pulling failed, using failover:", error);
            // Skip local-instance for embeds as it doesn't support them
            const validEmbedInstances = instances.filter(url => !url.includes('/api/local-instance'));
            const baseUrl = validEmbedInstances[currentInstanceIndex % validEmbedInstances.length];
            const embedUrl = `${baseUrl}/embed/${videoId}?autoplay=1`;
            if (viraPlayer) { hide(viraPlayer); viraPlayer.pause(); }
            show(embedContainer);
            if (embedIframe) embedIframe.src = window.location.origin + window.__uv$config.prefix + window.__uv$config.encodeUrl(embedUrl);
        }
    }

    window.closePlayer = () => window.location.hash = '';
    window.switchInstance = () => {
        currentInstanceIndex = (currentInstanceIndex + 1) % instances.length;
        loadVideoFromHash();
    };

    window.addEventListener('hashchange', loadVideoFromHash);
    if (window.location.hash) loadVideoFromHash();
});