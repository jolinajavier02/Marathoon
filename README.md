# Marathoon - Watch Together App

A premium, real-time video watching application where you can join rooms and watch YouTube videos in sync with friends.

## Features

-   **Real-time Syncing**: Play, pause, and seek are synchronized across users (simulated locally via browser storage for this demo).
-   **Room System**: Create unique rooms or join existing ones with a code.
-   **Live Chat**: Chat with other users in the room.
-   **Premium UI**: "Midnight Cinema" aesthetic with glassmorphism and smooth animations.
-   **Responsive**: Works on desktop and mobile.

## How to Run

Since this is a Vanilla JS application (no build step required), you can run it directly:

1.  Open the `index.html` file in your browser.
    -   Right-click `index.html` -> Open with -> Chrome/Safari/Edge.
2.  **To Test Syncing**:
    -   Open `index.html` in **two separate tabs** or windows.
    -   In Tab 1: Click "Create Room". Copy the Room Code.
    -   In Tab 2: Enter the Room Code and click "Join".
    -   Paste a YouTube link (e.g., `https://www.youtube.com/watch?v=dQw4w9WgXcQ`) in one tab and click "Load".
    -   Play/Pause in one tab, and watch the other tab sync automatically!

## Tech Stack

-   **HTML5 & CSS3**: Custom responsive design with CSS Variables and Flexbox.
-   **JavaScript (ES6+)**: Core logic for state management and syncing.
-   **YouTube IFrame API**: For controlling the video player.
-   **LocalStorage Events**: Used to simulate real-time WebSocket communication between tabs.

## Note on Real-World Usage

This version uses `localStorage` to demonstrate syncing between tabs on the *same computer*. To sync across different computers over the internet, a backend server (Node.js + Socket.io) would be required to relay messages.
