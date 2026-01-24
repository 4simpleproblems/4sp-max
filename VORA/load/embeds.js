// Vora MAX - Logic Engine
const isMoviePage = window.location.pathname.includes('movies.html');
const isSeriesPage = window.location.pathname.includes('series.html');
const isIndexPage = window.location.pathname.includes('index.html') || window.location.pathname.endsWith('vora/') || window.location.pathname.endsWith('/');

const AD_URL = "https://raw.githubusercontent.com/Himanshuxzx/test/refs/heads/main/document_6183624446532656632.mp4";

// Providers Configuration
const PROVIDERS = [
    { name: "Server 1 (Recommended)", movie: "https://player.videasy.net/movie/{id}", tv: "https://player.videasy.net/tv/{id}/{s}/{e}" },
    { name: "Server 2", movie: "https://test.autoembed.cc/embed/movie/{id}", tv: "https://test.autoembed.cc/embed/tv/{id}/{s}/{e}" },
    { name: "Server 3", movie: "https://vidrock.net/movie/{id}", tv: "https://vidrock.net/tv/{id}/{s}/{e}" },
    { name: "Server 4", movie: "https://moviesapi.club/movie/{id}", tv: "https://moviesapi.club/tv/{id}-{s}-{e}" }
];

let currentProviderIndex = 0;

// Helper to get embed URL
function getEmbedUrl(type, id, s = 1, e = 1) {
    const provider = PROVIDERS[currentProviderIndex];
    let url = type === 'movie' ? provider.movie : provider.tv;
    return url.replace('{id}', id).replace('{s}', s).replace('{e}', e);
}

// Autoplay State
let currentMedia = { type: null, id: null, s: null, e: null, item: null };
let nextMedia = null;
let preloadTriggered = false;

// 1. AGGRESSIVE CSS BLOCKER
(function() {
    const style = document.createElement('style');
    style.innerHTML = `
        video[src*="6183624446532656632"], 
        source[src*="6183624446532656632"],
        .w-full.h-full.object-cover.cursor-pointer[src*="raw.githubusercontent"] {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            position: absolute !important;
            top: -9999px !important;
            left: -9999px !important;
            width: 1px !important;
            height: 1px !important;
        }
    `;
    document.documentElement.appendChild(style);
})();

// 2. LOW-LEVEL API OVERRIDE
(function() {
    const forbidden = "6183624446532656632";
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function() {
        if (this.src && this.src.includes(forbidden)) {
            console.warn("Vora MAX: Playback blocked for blacklisted ad.");
            this.pause();
            this.remove();
            return Promise.reject("Blocked Ad");
        }
        return originalPlay.apply(this, arguments);
    };
    const originalLoad = HTMLMediaElement.prototype.load;
    HTMLMediaElement.prototype.load = function() {
        if (this.src && this.src.includes(forbidden)) {
            this.remove();
            return;
        }
        return originalLoad.apply(this, arguments);
    };
    const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
        set: function(val) {
            if (val && typeof val === 'string' && val.includes(forbidden)) return;
            originalSrcDescriptor.set.call(this, val);
        },
        get: originalSrcDescriptor.get
    });
})();

// 3. DOM SCANNER
const nukeAds = () => {
    const ads = document.querySelectorAll('video, source, iframe');
    ads.forEach(el => {
        const source = el.src || (el.querySelector('source')?.src) || "";
        if (source.includes("6183624446532656632")) el.remove();
    });
};
setInterval(nukeAds, 1000);
const adObserver = new MutationObserver(nukeAds);
adObserver.observe(document.documentElement, { childList: true, subtree: true });

// Library / Favorites Setup
let library = { likedMedia: [] };
function loadLibrary() {
    const stored = localStorage.getItem('vora_library');
    if (stored) library = JSON.parse(stored);
}
function saveLibrary() {
    localStorage.setItem('vora_library', JSON.stringify(library));
    renderFavorites();
}

function isLiked(id) {
    return library.likedMedia.some(m => m.id === id);
}

function toggleLike(item) {
    const index = library.likedMedia.findIndex(m => m.id === item.id);
    let favorited = false;
    if (index === -1) {
        library.likedMedia.push(item);
        favorited = true;
    } else {
        library.likedMedia.splice(index, 1);
        favorited = false;
    }
    saveLibrary();
    
    document.querySelectorAll(`.fav-trigger[data-id="${item.id}"] i`).forEach(icon => {
        if (favorited) {
            icon.className = 'far fa-star text-purple-500 scale-110';
            icon.classList.remove('opacity-40');
            icon.classList.add('opacity-100');
        } else {
            icon.className = 'far fa-star opacity-40';
            icon.classList.remove('text-purple-500', 'scale-110');
        }
    });

    const btn = document.getElementById('fav-btn-player');
    if (btn) btn.innerHTML = isLiked(item.id) ? '<i class="far fa-star text-purple-500"></i>' : '<i class="far fa-star"></i>';
}

// Rendering Logic
function createMediaCard(item) {
    if (!item.poster_path) return null;
    const isActuallyMovie = !!item.title || item.media_type === 'movie';
    const isActuallyTV = !!item.name || item.media_type === 'tv';
    if (isMoviePage && !isActuallyMovie) return null;
    if (isSeriesPage && !isActuallyTV) return null;

    const title = item.title || item.name;
    const poster = `https://image.tmdb.org/t/p/w500${item.poster_path}`;
    const effectiveType = isActuallyMovie ? 'movie' : 'tv';
    const link = isActuallyMovie ? 'movies.html' : 'series.html';
    
    const card = document.createElement('div');
    card.className = 'video-item group relative';
    const isFav = isLiked(item.id);
    const heartClass = isFav ? 'far text-purple-500 scale-110' : 'far opacity-40 group-hover:opacity-100';

    card.innerHTML = `
        <div class="thumbnail-container">
            <img src="${poster}" loading="lazy" onerror="this.closest('.video-item').style.display='none'">
            <a href="${link}#${item.id}" class="play-overlay">
                <i class="fas fa-play text-4xl text-white"></i>
            </a>
            <button class="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-md text-white border border-white/10 hover:scale-110 transition-all fav-trigger z-10" data-id="${item.id}" title="Like">
                <i class="${heartClass} fa-star"></i>
            </button>
        </div>
        <div class="p-4">
            <h3 class="text-white text-sm truncate mb-1 font-normal">${title}</h3>
            <p class="text-xs text-gray-500">${formatFullDate(item.release_date || item.first_air_date) || ''}</p>
        </div>
    `;

    card.querySelector('.fav-trigger').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLike({...item, id: item.id, media_type: effectiveType});
    });
    return card;
}

function createViewAllCard(link) {
    const card = document.createElement('a');
    card.href = link;
    card.className = 'video-item group flex flex-col items-center justify-center min-h-[300px] border-dashed border-2 border-brand-border hover:border-solid hover:border-purple-500 bg-white/5 hover:bg-white/10 transition-all rounded-[16px]';
    card.innerHTML = `
        <i class="fas fa-arrow-right text-3xl mb-4 text-purple-500 group-hover:translate-x-2 transition-transform"></i>
        <span class="text-white font-medium">View All</span>
    `;
    return card;
}

function renderFavorites() {
    const grid = document.getElementById('favoritesGrid');
    const section = document.getElementById('favorites-section');
    if (!grid) return;
    if (library.likedMedia.length === 0) {
        section.classList.add('hidden');
        return;
    }
    section.classList.remove('hidden');
    grid.innerHTML = '';
    library.likedMedia.forEach(item => {
        const card = createMediaCard(item);
        if (card) grid.appendChild(card);
    });
}

async function renderTmdb(res, endpoint) {
    try {
        const data = await res.json();
        let grid;
        if (isIndexPage && !isSearchActive) {
            grid = endpoint.includes('movie') ? document.getElementById('moviesGrid') : document.getElementById('seriesGrid');
        } else {
            grid = document.getElementById('videoGrid');
        }
        if (!grid || !data.results || window.location.hash) return;
        if (data.page === 1) grid.innerHTML = '';
        const itemsToShow = (isIndexPage && !isSearchActive) ? data.results.slice(0, 11) : data.results;
        itemsToShow.forEach(item => {
            const card = createMediaCard(item);
            if (card) grid.appendChild(card);
        });
        if (isIndexPage && !isSearchActive) grid.appendChild(createViewAllCard(endpoint.includes('movie') ? 'movies.html' : 'series.html'));
        isLoading = false;
        if (data.page >= data.total_pages) hasMore = false;
    } catch (e) {
        console.error("Error rendering TMDB:", e);
        isLoading = false;
    }
}

// Pagination Logic
let currentPage = 1, currentEndpoint = '', isLoading = false, hasMore = true, isSearchActive = false;
window.addEventListener('scroll', () => {
    if (isLoading || !hasMore || window.location.hash || (isIndexPage && !isSearchActive)) return;
    const scrollHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const clientHeight = window.innerHeight;
    if (scrollTop + clientHeight >= scrollHeight - 1000) {
        isLoading = true;
        currentPage++;
        window.themoviedb(currentEndpoint.split('?')[0], { params: { page: currentPage, language: getTmdbLanguage() } });
    }
});

const originalThemoviedb = themoviedb;
window.themoviedb = async function(a, e) {
    if (e?.params?.page === 1 || !e?.params?.page) {
        currentEndpoint = a;
        currentPage = 1;
        hasMore = true;
    }
    const res = await originalThemoviedb(a, e);
    if (res && res.clone) renderTmdb(res.clone(), a);
    return res;
};

async function fetchSeason(id, seasonNum) {
    const res = await originalThemoviedb(`tv/${id}/season/${seasonNum}`, { params: { language: getTmdbLanguage() } });
    return await res.json();
}

async function loadFromHash() {
    const hash = window.location.hash.substring(1);
    if (!hash) {
        const playerView = document.getElementById('player-view');
        if (playerView) playerView.remove();
        if (isIndexPage) {
            document.getElementById('favorites-section')?.classList.remove('hidden');
            renderFavorites();
        }
        return;
    };
    let type = isSeriesPage ? 'tv' : 'movie';
    document.querySelectorAll('.video-grid').forEach(g => g.innerHTML = '');
    document.getElementById('favorites-section')?.classList.add('hidden');
    document.getElementById('dynamic-section')?.classList.add('hidden');
    const main = document.querySelector('main');
    let playerView = document.getElementById('player-view');
    if (!playerView) {
        playerView = document.createElement('div');
        playerView.id = 'player-view';
        playerView.className = 'w-full mb-12';
        main.prepend(playerView);
    }
    playerView.innerHTML = `<div class="text-center py-20"><i class="fas fa-spinner fa-spin text-3xl text-purple-500"></i></div>`;
    async function tryLoad(t) {
        try {
            if (window.checkBare) await window.checkBare();
            const res = await originalThemoviedb(`${t}/${hash}`, { params: { language: getTmdbLanguage() } });
            if (!res.ok) throw new Error();
            const item = await res.json();
            renderPlayerUI(t, hash, item);
        } catch (e) {
            if (t === 'movie' && isIndexPage) tryLoad('tv');
            else playerView.innerHTML = `<div class="text-center py-20 text-white font-normal">Error loading media.</div>`;
        }
    }
    tryLoad(type);
}

// Proxy Helper
function proxyUrl(url) {
    if (typeof Ultraviolet === 'undefined') return url;
    return window.location.origin + "/VORA/VERN_SYSTEM/uv/service/" + Ultraviolet.codec.xor.encode(url);
}

function renderPlayerUI(type, id, item) {
    currentMedia = { type, id, s: 1, e: 1, item };
    preloadTriggered = false;
    nextMedia = null;

    const playerView = document.getElementById('player-view');
    const title = item.title || item.name;
    const embedUrl = proxyUrl(getEmbedUrl(type, id));
    const heartClass = isLiked(item.id) ? 'far text-purple-500' : 'far';
    const sortedSeasons = [...(item.seasons || [])].sort((a, b) => {
        if (a.season_number === 0) return 1;
        if (b.season_number === 0) return -1;
        return a.season_number - b.season_number;
    });
    playerView.innerHTML = `
        <div class="flex flex-col gap-6">
            <div id="video-container" class="relative w-full aspect-video bg-black rounded-[16px] overflow-hidden shadow-2xl border border-brand-border">
                <iframe id="main-player" src="${embedUrl}" class="w-full h-full border-none" allowfullscreen></iframe>
            </div>

            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-grow flex flex-col gap-2">
                    <label class="text-xs text-gray-500 font-medium ml-1 uppercase">Server / Provider</label>
                    <select id="provider-select" class="bg-card-dark border border-brand-border text-white p-3 rounded-[12px] outline-none focus:border-purple-500 cursor-pointer">
                        ${PROVIDERS.map((p, i) => `<option value="${i}" ${i === currentProviderIndex ? 'selected' : ''}>${p.name}</option>`).join('')}
                    </select>
                </div>
                ${type === 'tv' ? `
                <div class="flex-grow flex flex-col gap-2">
                    <label class="text-xs text-gray-500 font-medium ml-1 uppercase">Season</label>
                    <select id="season-select" class="bg-card-dark border border-brand-border text-white p-3 rounded-[12px] outline-none focus:border-purple-500 cursor-pointer">
                        ${sortedSeasons.map(s => `<option value="${s.season_number}" ${s.season_number === 1 ? 'selected' : ''}>Season ${s.season_number}</option>`).join('')}
                    </select>
                </div>
                ` : ''}
            </div>

            <div id="series-controls" class="${type === 'tv' ? '' : 'hidden'} bg-card-dark p-6 rounded-[16px] border border-brand-border flex flex-col gap-4">
                <div id="episode-list" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-60 overflow-y-auto pr-2"></div>
            </div>

            <div class="bg-card-dark p-8 rounded-[16px] border border-brand-border shadow-xl">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h2 class="text-3xl text-white mb-2 font-normal">${title}</h2>
                        <p class="text-gray-500 text-sm">${formatFullDate(item.release_date || item.first_air_date) || ''}</p>
                    </div>
                    <button id="fav-btn-player" class="w-12 h-12 flex items-center justify-center rounded-full bg-deep-black border border-brand-border hover:border-purple-500 transition-all text-xl">
                        <i class="${heartClass} fa-star"></i>
                    </button>
                </div>
                <p class="text-gray-400 leading-relaxed mb-8">${item.overview || 'No description available.'}</p>
                <button onclick="window.location.hash=''; window.location.reload();" class="px-6 py-3 rounded-[12px] bg-deep-black border border-brand-border hover:border-purple-500 text-white text-sm font-medium transition-all">
                    <i class="fas fa-arrow-left"></i> Back to Catalog
                </button>
            </div>
        </div>
    `;
    document.getElementById('fav-btn-player').onclick = () => toggleLike({...item, id: item.id, media_type: type});

    const providerSelect = document.getElementById('provider-select');
    providerSelect.onchange = () => {
        currentProviderIndex = parseInt(providerSelect.value);
        if (type === 'tv') {
            playEpisode(id, currentMedia.s, currentMedia.e);
        } else {
            const player = document.getElementById('main-player');
            player.src = proxyUrl(getEmbedUrl('movie', id));
        }
    };

    if (type === 'tv') {
        const seasonSelect = document.getElementById('season-select');
        seasonSelect.onchange = async () => {
            const seasonData = await fetchSeason(id, seasonSelect.value);
            const epList = document.getElementById('episode-list');
            epList.innerHTML = seasonData.episodes.map(ep => `
                <button onclick="playEpisode('${id}', ${seasonSelect.value}, ${ep.episode_number})" class="p-2 bg-deep-black border border-brand-border rounded-lg text-xs hover:border-accent-red transition-all truncate text-left text-white text-normal ep-btn" data-ep="${ep.episode_number}">
                    Ep ${ep.episode_number}: ${ep.name}
                </button>
            `).join('');
            findNextEpisode();
            
            // Highlight active if same season
            if (parseInt(seasonSelect.value) === currentMedia.s) {
                document.querySelectorAll('.ep-btn').forEach(btn => {
                    if (parseInt(btn.getAttribute('data-ep')) === currentMedia.e) {
                        btn.classList.add('border-purple-500', 'bg-purple-500/10');
                    }
                });
            }
        };
        seasonSelect.dispatchEvent(new Event('change'));
    }
}

window.playEpisode = function(id, s, e) {
    currentMedia.s = parseInt(s);
    currentMedia.e = parseInt(e);
    preloadTriggered = false;
    
    const player = document.getElementById('main-player');
    player.src = proxyUrl(getEmbedUrl('tv', id, s, e));
    
    // Cleanup next player if exists
    const oldNext = document.getElementById('next-player');
    if (oldNext) oldNext.remove();

    // Highlight active episode
    document.querySelectorAll('.ep-btn').forEach(btn => {
        if (parseInt(btn.getAttribute('data-ep')) === currentMedia.e) {
            btn.classList.add('border-purple-500', 'bg-purple-500/10');
        } else {
            btn.classList.remove('border-purple-500', 'bg-purple-500/10');
        }
    });

    findNextEpisode();
};

async function findNextEpisode() {
    if (currentMedia.type !== 'tv') return;
    const { id, s, e, item } = currentMedia;
    
    try {
        const seasonData = await fetchSeason(id, s);
        const nextEp = seasonData.episodes.find(ep => ep.episode_number === e + 1);
        
        if (nextEp) {
            nextMedia = { id, s, e: e + 1 };
        } else {
            // Find next season correctly even if numbers aren't perfectly sequential
            const sortedSeasons = [...(item.seasons || [])]
                .filter(sea => sea.season_number > 0)
                .sort((a, b) => a.season_number - b.season_number);
            const nextSeason = sortedSeasons.find(sea => sea.season_number > s);
            
            if (nextSeason) {
                nextMedia = { id, s: nextSeason.season_number, e: 1 };
            } else {
                nextMedia = null;
            }
        }
    } catch (err) {
        console.error("Error finding next episode:", err);
    }
}

function preloadNext() {
    if (!nextMedia) return;
    const container = document.getElementById('video-container');
    if (!container) return;

    let nextPlayer = document.getElementById('next-player');
    if (nextPlayer) nextPlayer.remove();

    nextPlayer = document.createElement('iframe');
    nextPlayer.id = 'next-player';
    nextPlayer.className = 'w-full h-full border-none absolute top-0 left-0 hidden';
    nextPlayer.allowFullscreen = true;
    container.appendChild(nextPlayer);

    nextPlayer.src = proxyUrl(getEmbedUrl('tv', nextMedia.id, nextMedia.s, nextMedia.e));
    
    nextPlayer.onload = () => {
        try {
            const doc = nextPlayer.contentDocument || nextPlayer.contentWindow.document;
            const video = doc.querySelector('video');
            if (video) {
                video.muted = true;
                video.play().catch(() => {});
                // Apply buffer fix to preloaded player too
                if (window.Hls) {
                    Hls.DefaultConfig.maxBufferLength = 60;
                    Hls.DefaultConfig.maxMaxBufferLength = 600;
                }
            }
        } catch (e) {}
    };
}

function swapPlayers() {
    const main = document.getElementById('main-player');
    const next = document.getElementById('next-player');
    if (!main || !next || !next.src || next.src === 'about:blank') return;

    main.id = 'old-player';
    next.id = 'main-player';
    
    main.classList.add('hidden');
    next.classList.remove('hidden');
    
    try {
        const doc = next.contentDocument || next.contentWindow.document;
        const video = doc.querySelector('video');
        if (video) {
            video.muted = false;
            video.play().catch(() => {});
        }
    } catch (e) {}

    // Update state
    currentMedia.s = nextMedia.s;
    currentMedia.e = nextMedia.e;
    preloadTriggered = false;
    
    setTimeout(() => main.remove(), 1000); // Graceful removal
    findNextEpisode();
}

// Monitor playback
setInterval(() => {
    const main = document.getElementById('main-player');
    if (!main) return;

    try {
        const doc = main.contentDocument || main.contentWindow.document;
        const video = doc.querySelector('video');
        
        if (video) {
            // Buffering Fix - Inject config
            if (!video.hlsFixed && (window.Hls || doc.defaultView.Hls)) {
                const HlsRef = window.Hls || doc.defaultView.Hls;
                HlsRef.DefaultConfig.maxBufferLength = 60;
                HlsRef.DefaultConfig.maxMaxBufferLength = 600;
                video.hlsFixed = true;
            }

            const remaining = video.duration - video.currentTime;
            
            // Start preloading 10 seconds before end
            if (remaining <= 10 && remaining > 0 && !preloadTriggered && nextMedia) {
                preloadTriggered = true;
                preloadNext();
            }

            // Swap when video ends or near end
            if (video.ended || (remaining < 0.5 && remaining > 0 && preloadTriggered)) {
                swapPlayers();
            }
        }
    } catch (e) {}
}, 500);

function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    isSearchActive = true;
    if (isIndexPage) {
        document.getElementById('moviesGrid')?.parentElement.classList.add('hidden');
        document.getElementById('seriesGrid')?.parentElement.classList.add('hidden');
        document.getElementById('favorites-section')?.classList.add('hidden');
        document.getElementById('dynamic-section')?.classList.remove('hidden');
    }
    const grid = document.getElementById('videoGrid');
    if (grid) grid.innerHTML = '<div class="text-center py-20 col-span-full text-white"><i class="fas fa-spinner fa-spin text-3xl text-purple-500"></i></div>';
    window.location.hash = ''; 
    let endpoint = isMoviePage ? 'search/movie' : (isSeriesPage ? 'search/tv' : 'search/multi');
    window.themoviedb(endpoint, { params: { query: query, language: getTmdbLanguage() } });
}

document.addEventListener('DOMContentLoaded', () => {
    loadLibrary();
    renderFavorites();
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
        const searchIcon = searchInput.previousElementSibling;
        if (searchIcon && searchIcon.classList.contains('fa-search')) {
            searchIcon.style.cursor = 'pointer';
            searchIcon.onclick = performSearch;
        }
    }
    if (window.location.hash) {
        loadFromHash();
    } else {
        if (isIndexPage) {
            window.themoviedb(`trending/movie/week?language=${getTmdbLanguage()}&page=1`);
            window.themoviedb(`trending/tv/week?language=${getTmdbLanguage()}&page=1`);
        } else if (isMoviePage) {
            window.themoviedb(`discover/movie`, { params: { sort_by: 'primary_release_date.desc', 'primary_release_date.lte': new Date().toISOString().split('T')[0], language: getTmdbLanguage(), page: 1 } });
        } else if (isSeriesPage) {
            window.themoviedb(`discover/tv`, { params: { sort_by: 'first_air_date.desc', 'first_air_date.lte': new Date().toISOString().split('T')[0], language: getTmdbLanguage(), page: 1 } });
        }
    }
});

window.addEventListener('hashchange', loadFromHash);