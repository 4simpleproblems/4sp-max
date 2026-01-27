const API_BASE_URL = 'http://localhost:3000'; // Assuming Piped-Backend runs on port 3000

const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const resultsDiv = document.getElementById('results');
const videoPlayer = document.querySelector('#player video');
const nowPlayingTitle = document.getElementById('nowPlayingTitle');

searchButton.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        performSearch();
    }
});

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    resultsDiv.innerHTML = 'Loading results...';

    try {
        const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        displaySearchResults(data.items);
    } catch (error) {
        console.error('Error fetching search results:', error);
        resultsDiv.innerHTML = `<p style="color: red;">Error loading search results: ${error.message}</p>`;
    }
}

function displaySearchResults(items) {
    resultsDiv.innerHTML = '';
    if (!items || items.length === 0) {
        resultsDiv.innerHTML = '<p>No results found.</p>';
        return;
    }

    items.forEach(item => {
        if (item.type === 'stream') { // Assuming 'stream' type for videos/music
            const videoItem = document.createElement('div');
            videoItem.classList.add('video-item');
            videoItem.innerHTML = `
                <img src="${item.thumbnail}" alt="${item.title}">
                <h4>${item.title}</h4>
            `;
            videoItem.addEventListener('click', () => playStream(item.url, item.title)); // Use item.url directly if it's the videoId, otherwise item.id
            resultsDiv.appendChild(videoItem);
        }
    });
}

async function playStream(streamUrl, title) {
    // Extract videoId from streamUrl or use item.id if available from search results
    let videoId;
    try {
        const urlObj = new URL(streamUrl);
        videoId = urlObj.searchParams.get('v'); // Common for YouTube URLs
        if (!videoId && streamUrl.includes('watch?v=')) {
            videoId = streamUrl.split('watch?v=')[1];
            // Remove any extra parameters like &list, &index etc.
            if (videoId.includes('&')) {
                videoId = videoId.split('&')[0];
            }
        } else if (!videoId && streamUrl.includes('/watch/')) { // Piped's own URL format might be different
             videoId = streamUrl.split('/watch/')[1];
             if (videoId.includes('?')) {
                 videoId = videoId.split('?')[0];
             }
        } else if (streamUrl.length === 11) { // Assume it's just the video ID if length is 11
            videoId = streamUrl;
        }

        if (!videoId) {
            console.error('Could not extract video ID from URL:', streamUrl);
            alert('Could not extract video ID from URL. Cannot play stream.');
            return;
        }
    } catch (e) {
        console.error('Error parsing stream URL:', e);
        // Fallback to assuming streamUrl is already the videoId if parsing fails
        videoId = streamUrl;
        if (videoId.length !== 11) { // Basic check for YouTube video ID length
            alert('Invalid video ID format. Cannot play stream.');
            return;
        }
    }


    nowPlayingTitle.textContent = title;

    try {
        const response = await fetch(`${API_BASE_URL}/streams/${encodeURIComponent(videoId)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Stream data:", data);

        // Find the best quality video format
        const videoFormat = data.videoStreams.find(s => s.quality === '1080p' && s.format === 'webm') ||
                            data.videoStreams.find(s => s.quality === '720p' && s.format === 'webm') ||
                            data.videoStreams.find(s => s.quality === '480p' && s.format === 'webm') ||
                            data.videoStreams.find(s => s.quality === '360p' && s.format === 'webm') ||
                            data.videoStreams[0]; // Fallback to first available

        // Find the best quality audio format
        const audioFormat = data.audioStreams.find(s => s.quality === 'audio/mp4') ||
                            data.audioStreams.find(s => s.quality === 'audio/webm') ||
                            data.audioStreams[0]; // Fallback to first available


        if (videoFormat && audioFormat) {
            // For adaptive streams, you might need to combine video and audio
            // This is a simplified approach, actual implementation might need a library like MediaSource Extensions
            // For now, let's try to use a single stream if available, or just the video stream for visual
            let playableUrl = videoFormat.url;
            if (videoFormat.url && !audioFormat.url) { // if video has audio combined
                 playableUrl = videoFormat.url;
            } else if (!videoFormat.url && audioFormat.url) { // if only audio
                 playableUrl = audioFormat.url;
            } else if (videoFormat.url && audioFormat.url && videoFormat.url !== audioFormat.url) {
                // This scenario means separate video and audio tracks.
                // HTML5 video tag can't play separate audio and video tracks directly.
                // A more advanced player (e.g., using MediaSource Extensions or a player library) would be needed here.
                // For simplicity, we'll just pick the video track if separate.
                console.warn("Separate video and audio streams detected. Playing video stream only. For combined playback, consider MediaSource Extensions or a player library.");
                playableUrl = videoFormat.url;
            } else if (videoFormat.url === audioFormat.url && videoFormat.url) {
                // Combined stream (video and audio in one)
                playableUrl = videoFormat.url;
            }


            videoPlayer.src = playableUrl;
            videoPlayer.load();
            videoPlayer.play();
        } else {
            videoPlayer.src = '';
            alert('No playable stream found.');
        }

    } catch (error) {
        console.error('Error fetching stream:', error);
        alert(`Error playing stream: ${error.message}`);
        videoPlayer.src = '';
    }
}
