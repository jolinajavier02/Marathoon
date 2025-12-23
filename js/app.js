// State
const state = {
    currentView: 'landing',
    roomId: null,
    username: 'Guest_' + Math.floor(Math.random() * 1000),
    player: null,
    isHost: false,
    lastSyncTime: 0
};

// DOM Elements
const views = {
    landing: document.getElementById('landing-view'),
    room: document.getElementById('room-view')
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
    copyLink: document.getElementById('copy-link-btn'),
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

    // Event Listeners
    buttons.createRoom.addEventListener('click', createRoom);
    buttons.joinRoom.addEventListener('click', () => {
        const code = inputs.roomCode.value.trim();
        if (code) joinRoom(code);
    });

    buttons.loadVideo.addEventListener('click', loadVideoFromInput);

    buttons.sendMsg.addEventListener('click', sendChatMessage);
    inputs.chat.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    buttons.copyLink.addEventListener('click', () => {
        const url = `${window.location.origin}${window.location.pathname}?room=${state.roomId}`;
        navigator.clipboard.writeText(url);
        alert('Room link copied to clipboard!');
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

    // Initialize Camera when joining room
    document.querySelector('.tab-btn[data-tab="users"]').addEventListener('click', () => {
        if (!localStream) startCamera();
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
    window.history.pushState({ path: newUrl }, '', newUrl);

    // Update UI
    views.landing.classList.add('hidden');
    views.room.classList.remove('hidden');
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
        // Load chat
        if (roomState.chat) {
            roomState.chat.forEach(msg => addChatMessage(msg.user, msg.text, false));
        }
    }

    addChatMessage('System', `You joined room ${roomId}`);
}

// Video Logic
function loadVideoFromInput() {
    const url = inputs.videoUrl.value;
    const videoId = extractVideoID(url);
    if (videoId) {
        loadVideo(videoId);
        updateRoomState({ videoId: videoId, timestamp: 0, status: 'playing' });
        addChatMessage('System', 'Loaded new video');
    } else {
        alert('Invalid YouTube URL');
    }
}

function extractVideoID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function loadVideo(videoId) {
    displays.playerPlaceholder.style.display = 'none';

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

    // Sync Chat (Check for new messages)
    // In a real app, we'd append. Here we just reload if length changed.
    // Ideally we store chat separately or handle it better.
    // For this demo, we'll just check the last message.
    if (newState.chat && newState.chat.length > 0) {
        const lastMsg = newState.chat[newState.chat.length - 1];
        // Simple check to avoid duplicates in UI (not robust but works for demo)
        const lastUiMsg = displays.chatMessages.lastElementChild;
        if (!lastUiMsg || lastUiMsg.textContent.indexOf(lastMsg.text) === -1) {
            // Re-render all chat for simplicity in this storage-based demo
            displays.chatMessages.innerHTML = '';
            newState.chat.forEach(msg => addChatMessage(msg.user, msg.text, false));
        }
    }
}

// Chat Logic
function sendChatMessage() {
    const text = inputs.chat.value.trim();
    if (!text) return;

    addChatMessage('You', text, true);
    inputs.chat.value = '';

    // Save to storage
    const roomKey = `marathoon_room_${state.roomId}`;
    const current = JSON.parse(localStorage.getItem(roomKey) || '{}');
    const chat = current.chat || [];
    chat.push({ user: state.username, text: text, time: Date.now() });

    updateRoomState({ chat: chat });
}

function addChatMessage(user, text, isMe) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message';
    msgDiv.innerHTML = `<span class="user" style="color: ${isMe ? 'var(--primary-color)' : 'var(--secondary-color)'}">${user}:</span> ${text}`;
    displays.chatMessages.appendChild(msgDiv);
    displays.chatMessages.scrollTop = displays.chatMessages.scrollHeight;
}

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
