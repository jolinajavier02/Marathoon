// State
const state = {
    currentView: 'landing',
    roomId: null,
    username: 'Guest_' + Math.floor(Math.random() * 1000),
    player: null,
    isHost: false,
    lastSyncTime: 0,
    isGenericPlayer: false
};

// DOM Elements
const views = {
    landing: document.getElementById('landing-view'),
    home: document.getElementById('home-view'),
    room: document.getElementById('room-view')
};

const landingButtons = {
    guest: document.getElementById('landing-guest-btn')
};

const inputs = {
    roomCode: document.getElementById('room-code-input'),
    videoUrl: document.getElementById('video-url-input'),
    chat: document.getElementById('chat-input')
};

const buttons = {
    createRoom: document.getElementById('create-room-btn'),
    joinRoom: document.getElementById('join-room-btn'),
    loadVideo: document.getElementById('load-video-btn'),
    sendMsg: document.getElementById('send-msg-btn'),
    invite: document.getElementById('invite-btn'),
    sync: document.getElementById('sync-btn')
};

const displays = {
    roomCode: document.getElementById('current-room-code'),
    chatMessages: document.getElementById('chat-messages'),
    userList: document.getElementById('user-list'),
    userCount: document.getElementById('user-count'),
    playerPlaceholder: document.getElementById('player-placeholder')
};

// Initialization
function init() {
    // Check URL for room code
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');

    if (roomCode) {
        joinRoom(roomCode);
    }

    // Landing Page Listeners


    if (landingButtons.guest) {
        landingButtons.guest.addEventListener('click', () => {
            state.username = 'Guest_' + Math.floor(Math.random() * 1000);
            showHomeView();
        });
    }

    // Event Listeners
    buttons.createRoom.addEventListener('click', createRoom);
    buttons.joinRoom.addEventListener('click', () => {
        const code = inputs.roomCode.value.trim();
        if (code) joinRoom(code);
    });

    buttons.loadVideo.addEventListener('click', loadVideoFromInput);

    buttons.invite.addEventListener('click', () => {
        const url = `${window.location.origin}${window.location.pathname}?room=${state.roomId}`;
        navigator.clipboard.writeText(url);
        const originalText = buttons.invite.innerHTML;
        buttons.invite.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => {
            buttons.invite.innerHTML = originalText;
        }, 2000);
    });

    buttons.sync.addEventListener('click', () => {
        if (state.player) {
            const time = state.player.getCurrentTime();
            updateRoomState({ timestamp: time, status: 'playing' });
        }
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

            e.target.classList.add('active');
            document.getElementById(`${e.target.dataset.tab}-tab`).classList.remove('hidden');
        });
    });

    // Load YouTube API
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    // Storage Listener for Syncing
    window.addEventListener('storage', handleStorageChange);
    // Video Chat Controls
    document.getElementById('toggle-cam').addEventListener('click', toggleCamera);
    document.getElementById('toggle-mic').addEventListener('click', toggleMic);

    // Movie Browser Controls
    document.getElementById('browse-movies-btn').addEventListener('click', () => {
        document.getElementById('movie-browser-modal').classList.remove('hidden');
        renderMovies('all');
    });

    document.querySelector('.close-modal-btn').addEventListener('click', () => {
        document.getElementById('movie-browser-modal').classList.add('hidden');
    });

    document.getElementById('movie-search-input').addEventListener('input', (e) => {
        filterMovies(e.target.value);
    });

    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderMovies(e.target.dataset.category);
        });
    });

    // Custom Controls Listeners
    document.getElementById('cc-play').addEventListener('click', togglePlay);
    document.getElementById('cc-rewind').addEventListener('click', () => seekRelative(-10));
    document.getElementById('cc-forward').addEventListener('click', () => seekRelative(10));
    document.getElementById('cc-volume').addEventListener('click', toggleMute);
    document.getElementById('volume-slider').addEventListener('input', (e) => setVolume(e.target.value));
    document.getElementById('cc-fullscreen').addEventListener('click', toggleFullscreen);
    document.getElementById('cc-exit').addEventListener('click', exitMovieMode);

    // Progress Bar Interaction
    document.getElementById('progress-container').addEventListener('click', (e) => {
        if (!state.player) return;
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const duration = state.player.getDuration();
        const seekTime = duration * percentage;
        state.player.seekTo(seekTime);
        updateRoomState({ timestamp: seekTime, status: 'playing' });
    });

    // Login Logic


    // Update progress bar loop
    setInterval(updateProgressBar, 1000);
}

// ... (Previous Code) ...

// Movie Mode Logic
function enterMovieMode() {
    document.body.classList.add('movie-active');
    if (!state.isGenericPlayer) {
        document.getElementById('custom-controls').classList.remove('hidden');
    } else {
        document.getElementById('custom-controls').classList.add('hidden');
    }
    document.getElementById('standard-controls').style.display = 'none';

    // Hide YT controls via playerVars update (requires reload usually, but we can just overlay)
    // The overlay 'custom-controls' handles the UI.
}

function exitMovieMode() {
    document.body.classList.remove('movie-active');
    document.body.classList.remove('fullscreen-mode');
    document.getElementById('custom-controls').classList.add('hidden');
    document.getElementById('standard-controls').style.display = 'flex';

    if (state.player) {
        state.player.stopVideo();
    }
}

// Custom Control Functions
function togglePlay() {
    if (!state.player) return;
    const stateCode = state.player.getPlayerState();
    if (stateCode === YT.PlayerState.PLAYING) {
        state.player.pauseVideo();
        updateRoomState({ status: 'paused', timestamp: state.player.getCurrentTime() });
    } else {
        state.player.playVideo();
        updateRoomState({ status: 'playing', timestamp: state.player.getCurrentTime() });
    }
}

function seekRelative(seconds) {
    if (!state.player) return;
    const current = state.player.getCurrentTime();
    const newTime = current + seconds;
    state.player.seekTo(newTime);
    updateRoomState({ timestamp: newTime, status: 'playing' });
}

function toggleMute() {
    if (!state.player) return;
    if (state.player.isMuted()) {
        state.player.unMute();
        document.getElementById('cc-volume').innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        document.getElementById('volume-slider').value = state.player.getVolume();
    } else {
        state.player.mute();
        document.getElementById('cc-volume').innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        document.getElementById('volume-slider').value = 0;
    }
}

function setVolume(val) {
    if (!state.player) return;
    state.player.setVolume(val);
    if (val > 0 && state.player.isMuted()) {
        state.player.unMute();
        document.getElementById('cc-volume').innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    } else if (val == 0) {
        document.getElementById('cc-volume').innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    }
}

function toggleFullscreen() {
    document.body.classList.toggle('fullscreen-mode');
    const btn = document.getElementById('cc-fullscreen');
    if (document.body.classList.contains('fullscreen-mode')) {
        btn.innerHTML = '<i class="fa-solid fa-compress"></i>';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-expand"></i>';
    }
}

function updateProgressBar() {
    if (!state.player || !state.player.getCurrentTime) return;

    const current = state.player.getCurrentTime();
    const duration = state.player.getDuration();

    if (duration) {
        const percent = (current / duration) * 100;
        document.getElementById('progress-bar').style.width = `${percent}%`;

        document.getElementById('current-time').textContent = formatTime(current);
        document.getElementById('total-time').textContent = formatTime(duration);
    }

    // Update Play/Pause Icon based on state
    const playBtn = document.getElementById('cc-play');
    if (state.player.getPlayerState() === YT.PlayerState.PLAYING) {
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    } else {
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Update renderMovies to use enterMovieMode
// We need to redefine renderMovies or update the event listener logic.
// Since I can't easily redefine, I'll update the event listener logic in the next step or assume I can overwrite the previous function if I replace it.
// Actually, I will just overwrite the renderMovies function below.

function renderMovies(category) {
    const grid = document.getElementById('movies-grid');
    grid.innerHTML = '';

    const filtered = category === 'all'
        ? movieDatabase
        : movieDatabase.filter(m => m.category === category);

    filtered.forEach(movie => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
            <img src="${movie.image}" class="movie-poster" alt="${movie.title}">
            <div class="movie-info">
                <div class="movie-title">${movie.title}</div>
                <div class="movie-meta">
                    <span class="movie-rating"><i class="fa-solid fa-star"></i> ${movie.rating}</span>
                    <span>${movie.category === 'couples' ? '❤️' : movie.category === 'inspiring' ? '✨' : '🍿'}</span>
                </div>
            </div>
        `;
        card.addEventListener('click', () => {
            loadVideo(movie.videoId);
            enterMovieMode(); // Trigger Movie Mode
            updateRoomState({ videoId: movie.videoId, timestamp: 0, status: 'playing' });
            document.getElementById('movie-browser-modal').classList.add('hidden');
        });
        grid.appendChild(card);
    });
}

// Room Logic
function createRoom() {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    state.isHost = true;
    joinRoom(newRoomId);
}

function joinRoom(roomId) {
    state.roomId = roomId;
    state.currentView = 'room';

    // Update URL without reload
    const newUrl = `${window.location.pathname}?room=${roomId}`;
    try {
        window.history.pushState({ path: newUrl }, '', newUrl);
    } catch (e) {
        console.log('PushState failed (likely due to file:// protocol):', e);
    }

    // Update UI
    // Update UI
    views.landing.classList.add('hidden');
    views.home.classList.add('hidden');
    views.room.classList.remove('hidden');
    document.body.classList.add('room-active');
    displays.roomCode.textContent = roomId;

    // Initialize Room State in LocalStorage if not exists
    const roomKey = `marathoon_room_${roomId}`;
    if (!localStorage.getItem(roomKey)) {
        localStorage.setItem(roomKey, JSON.stringify({
            videoId: null,
            status: 'paused',
            timestamp: 0,
            lastUpdate: Date.now(),
            chat: []
        }));
    } else {
        // Load existing state
        const roomState = JSON.parse(localStorage.getItem(roomKey));
        if (roomState.videoId) {
            loadVideo(roomState.videoId);
        }
    }
}

// Video Logic
function loadVideoFromInput() {
    const url = inputs.videoUrl.value.trim();
    if (!url) return;

    const videoId = extractVideoID(url);
    if (videoId) {
        loadVideo(videoId);
        updateRoomState({ videoId: videoId, timestamp: 0, status: 'playing' });
    } else if (url.startsWith('http')) {
        // Assume generic video URL
        loadVideo(url);
        updateRoomState({ videoId: url, timestamp: 0, status: 'playing' });
    } else {
        alert('Invalid URL. Please enter a valid YouTube or Video link.');
    }
}

function extractVideoID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function loadVideo(videoId) {
    displays.playerPlaceholder.style.display = 'none';

    // Check if it's a URL (Generic Player)
    if (videoId.includes('http') || videoId.includes('vidsrc')) {
        state.isGenericPlayer = true;
        if (state.player && typeof state.player.stopVideo === 'function') {
            state.player.stopVideo();
        }
        document.getElementById('youtube-player').style.display = 'none';
        document.getElementById('generic-player').classList.remove('hidden');
        document.getElementById('generic-iframe').src = videoId;

        // Hide custom controls if they were visible
        document.getElementById('custom-controls').classList.add('hidden');
        return;
    }

    // YouTube Logic
    state.isGenericPlayer = false;
    document.getElementById('generic-player').classList.add('hidden');
    document.getElementById('generic-iframe').src = '';
    document.getElementById('youtube-player').style.display = 'block';

    if (typeof YT === 'undefined' || !YT.Player) {
        alert('YouTube API is still loading. Please wait a moment and try again.');
        return;
    }

    if (state.player) {
        state.player.loadVideoById(videoId);
    } else {
        state.player = new YT.Player('youtube-player', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'playsinline': 1,
                'controls': 1, // Allow user controls, but we will try to sync events
                'rel': 0
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });
    }
}

// YouTube API Callbacks
function onPlayerReady(event) {
    // Check if we need to seek to a specific time from room state
    const roomKey = `marathoon_room_${state.roomId}`;
    const roomState = JSON.parse(localStorage.getItem(roomKey));
    if (roomState && roomState.timestamp > 0) {
        event.target.seekTo(roomState.timestamp);
    }
}

function onPlayerStateChange(event) {
    // 1 = Playing, 2 = Paused
    if (event.data === YT.PlayerState.PLAYING) {
        updateRoomState({
            status: 'playing',
            timestamp: state.player.getCurrentTime()
        });
    } else if (event.data === YT.PlayerState.PAUSED) {
        updateRoomState({
            status: 'paused',
            timestamp: state.player.getCurrentTime()
        });
    }
}

// Syncing Logic
function updateRoomState(updates) {
    if (!state.roomId) return;

    const roomKey = `marathoon_room_${state.roomId}`;
    const current = JSON.parse(localStorage.getItem(roomKey) || '{}');

    const newState = {
        ...current,
        ...updates,
        lastUpdate: Date.now(),
        senderId: state.username // To avoid self-loop
    };

    localStorage.setItem(roomKey, JSON.stringify(newState));
}

function handleStorageChange(e) {
    if (!e.key.startsWith('marathoon_room_')) return;
    if (e.key !== `marathoon_room_${state.roomId}`) return;

    const newState = JSON.parse(e.newValue);
    if (newState.senderId === state.username) return; // Ignore own updates

    // Sync Video
    if (newState.videoId && (!state.player || state.player.getVideoData().video_id !== newState.videoId)) {
        loadVideo(newState.videoId);
    }

    if (state.player && state.player.getPlayerState) {
        const playerState = state.player.getPlayerState();
        const currentTime = state.player.getCurrentTime();

        // Sync Play/Pause
        if (newState.status === 'playing' && playerState !== YT.PlayerState.PLAYING) {
            state.player.playVideo();
        } else if (newState.status === 'paused' && playerState !== YT.PlayerState.PAUSED) {
            state.player.pauseVideo();
        }

        // Sync Time (if drift > 2 seconds)
        if (Math.abs(currentTime - newState.timestamp) > 2) {
            state.player.seekTo(newState.timestamp);
        }
    }
}

// Chat Logic Removed
function sendChatMessage() { return; }


function addChatMessage() { return; }

// Global API Ready function
window.onYouTubeIframeAPIReady = function () {
    console.log("YouTube API Ready");
};

// Start
// Video Chat Logic
let localStream = null;

async function startCamera() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const videoElement = document.getElementById('local-video');
        videoElement.srcObject = localStream;

        // Mute local audio feedback
        videoElement.muted = true;
    } catch (err) {
        console.error("Error accessing media devices:", err);
        alert("Could not access camera/microphone. Please ensure you have granted permissions.");
    }
}

function toggleCamera() {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    const btn = document.getElementById('toggle-cam');
    btn.classList.toggle('off', !videoTrack.enabled);
    btn.innerHTML = videoTrack.enabled ? '<i class="fa-solid fa-video"></i>' : '<i class="fa-solid fa-video-slash"></i>';
}

function toggleMic() {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    const btn = document.getElementById('toggle-mic');
    btn.classList.toggle('off', !audioTrack.enabled);
    btn.innerHTML = audioTrack.enabled ? '<i class="fa-solid fa-microphone"></i>' : '<i class="fa-solid fa-microphone-slash"></i>';
}

// Movie Database (Mock)
const movieDatabase = [

    {
        id: 'couple1',
        title: 'The Notebook',
        category: 'couples',
        image: 'https://image.tmdb.org/t/p/w500/rNzQyW4f8B8cQeg7Dgj3n6eT5k9.jpg',
        rating: '7.9',
        videoId: 'FC6biTjEyZw' // Trailer ID
    },
    {
        id: 'couple2',
        title: 'La La Land',
        category: 'couples',
        image: 'https://image.tmdb.org/t/p/w500/uDO8zWDhfWwoUyZ4aq9KnNoBTvC.jpg',
        rating: '8.0',
        videoId: '0pdqf4P9MB8'
    },
    {
        id: 'couple3',
        title: 'About Time',
        category: 'couples',
        image: 'https://image.tmdb.org/t/p/w500/iL1O0nvkQpM8y9r9Zl7lGqDqDq.jpg',
        rating: '7.8',
        videoId: 'T7A810duHvw'
    },
    {
        id: 'inspire1',
        title: 'The Pursuit of Happyness',
        category: 'inspiring',
        image: 'https://image.tmdb.org/t/p/w500/u6hTSrTabdC6QIG9ALlHCXkkCE8.jpg',
        rating: '8.0',
        videoId: '89Kq8SDyvjc'
    },
    {
        id: 'inspire2',
        title: 'Hidden Figures',
        category: 'inspiring',
        image: 'https://image.tmdb.org/t/p/w500/997ToEZTau29yF6EnpddO0WjU6.jpg',
        rating: '7.8',
        videoId: '5wfrDhgUMGI'
    },
    {
        id: 'ent1',
        title: 'Avengers: Endgame',
        category: 'entertainment',
        image: 'https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg',
        rating: '8.4',
        videoId: 'TcMBFSGVi1c'
    },
    {
        id: 'ent2',
        title: 'Inception',
        category: 'entertainment',
        image: 'https://image.tmdb.org/t/p/w500/9gk7admal4zl67Yrxt875q01NBE.jpg',
        rating: '8.8',
        videoId: 'YoHD9XEInc0'
    },
    {
        id: 'ent3',
        title: 'Spider-Man: Across the Spider-Verse',
        category: 'entertainment',
        image: 'https://image.tmdb.org/t/p/w500/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg',
        rating: '8.4',
        videoId: 'cqGjhVJWtEg'
    }
];

function renderMovies(category) {
    const grid = document.getElementById('movies-grid');
    grid.innerHTML = '';

    const filtered = category === 'all'
        ? movieDatabase
        : movieDatabase.filter(m => m.category === category);

    filtered.forEach(movie => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
            <img src="${movie.image}" class="movie-poster" alt="${movie.title}">
            <div class="movie-info">
                <div class="movie-title">${movie.title}</div>
                <div class="movie-meta">
                    <span class="movie-rating"><i class="fa-solid fa-star"></i> ${movie.rating}</span>
                    <span>${movie.category === 'couples' ? '❤️' : movie.category === 'inspiring' ? '✨' : '🍿'}</span>
                </div>
            </div>
        `;
        card.addEventListener('click', () => {
            loadVideo(movie.videoId);
            updateRoomState({ videoId: movie.videoId, timestamp: 0, status: 'playing' });
            addChatMessage('System', `Started watching: ${movie.title}`);
            document.getElementById('movie-browser-modal').classList.add('hidden');
        });
        grid.appendChild(card);
    });
}

function filterMovies(query) {
    const term = query.toLowerCase();
    const grid = document.getElementById('movies-grid');
    const cards = grid.children;

    // Note: This is a simple visual filter based on currently rendered items
    // For better UX with categories, we might want to re-render based on DB
    const currentCategory = document.querySelector('.cat-btn.active').dataset.category;
    const baseList = currentCategory === 'all'
        ? movieDatabase
        : movieDatabase.filter(m => m.category === currentCategory);

    const filtered = baseList.filter(m => m.title.toLowerCase().includes(term));

    // Re-render specifically for search to keep it clean
    grid.innerHTML = '';
    filtered.forEach(movie => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
            <img src="${movie.image}" class="movie-poster" alt="${movie.title}">
            <div class="movie-info">
                <div class="movie-title">${movie.title}</div>
                <div class="movie-meta">
                    <span class="movie-rating"><i class="fa-solid fa-star"></i> ${movie.rating}</span>
                    <span>${movie.category === 'couples' ? '❤️' : movie.category === 'inspiring' ? '✨' : '🍿'}</span>
                </div>
            </div>
        `;
        card.addEventListener('click', () => {
            loadVideo(movie.videoId);
            updateRoomState({ videoId: movie.videoId, timestamp: 0, status: 'playing' });
            addChatMessage('System', `Started watching: ${movie.title}`);
            document.getElementById('movie-browser-modal').classList.add('hidden');
        });
        grid.appendChild(card);
    });
}

// Start
init();

function showHomeView() {
    views.landing.classList.add('hidden');
    views.home.classList.remove('hidden');
    state.currentView = 'home';
}

function createRoom() {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    state.isHost = true;
    joinRoom(newRoomId);
}

function createRoomWithMovie(videoId) {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    state.isHost = true;

    // Pre-set video in local storage for the new room
    const roomKey = `marathoon_room_${newRoomId}`;
    const movie = movieDatabase.find(m => m.videoId === videoId);
    localStorage.setItem(roomKey, JSON.stringify({
        videoId: videoId,
        status: 'playing',
        timestamp: 0,
        lastUpdate: Date.now()
    }));

    joinRoom(newRoomId);
}
}
