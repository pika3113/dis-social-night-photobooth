document.addEventListener('DOMContentLoaded', () => {
    const contentDiv = document.getElementById('content');
    let lastSessionsHash = ''; // Simple way to detect changes

    async function checkRecentSessions() {
        try {
            const res = await fetch('/api/session/recent-finished');
            const data = await res.json();

            if (data.success) {
                // Create a simple hash of session IDs to detect changes
                const currentHash = data.sessions.map(s => s.sessionId).join(',');
                
                if (currentHash !== lastSessionsHash) {
                    lastSessionsHash = currentHash;
                    updateDisplay(data.sessions);
                }
            }
        } catch (err) {
            console.error('Error fetching recent sessions:', err);
        }
    }

    function updateDisplay(sessions) {
        if (sessions.length === 0) {
            contentDiv.innerHTML = '<div class="loading">Waiting for completed session...</div>';
            return;
        }

        // Sort so oldest is on the right (reverse of the API which returns newest first)
        // API returns [Newest, Middle, Oldest]
        // We want display: [Newest, Middle, Oldest] -> Flex row
        // Wait, user asked: "oldest one is on the right"
        // So Left: Newest, Right: Oldest.
        // The API returns [Newest, Older, Oldest].
        // So we just map them in order.

        const cardsHtml = sessions.map((session, index) => `
            <div class="qr-card ${index === 0 ? 'latest' : ''}">
                <div class="qr-label">${index === 0 ? 'Latest Session' : 'Previous Session'}</div>
                <img src="${session.qrCode}" class="qr-image" alt="QR Code">
                <div class="session-code">${session.sessionId}</div>
                <p class="instruction-small">Scan to download</p>
            </div>
        `).join('');

        contentDiv.innerHTML = `
            <div class="qr-grid">
                ${cardsHtml}
            </div>
        `;
    }

    // Poll every 2 seconds
    setInterval(checkRecentSessions, 2000);
    checkRecentSessions(); // Initial check
});
