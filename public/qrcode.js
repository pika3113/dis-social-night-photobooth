document.addEventListener('DOMContentLoaded', () => {
    const contentDiv = document.getElementById('content');
    let lastSessionId = null;

    async function checkLastSession() {
        try {
            const res = await fetch('/api/session/last-finished');
            const data = await res.json();

            if (data.success && data.sessionId !== lastSessionId) {
                lastSessionId = data.sessionId;
                updateDisplay(data);
            }
        } catch (err) {
            console.error('Error fetching last session:', err);
        }
    }

    function updateDisplay(data) {
        contentDiv.innerHTML = `
            <p class="instruction">Scan to download photos</p>
            <img src="${data.qrCode}" class="qr-image" alt="QR Code">
            <p class="sub-instruction">Session Code</p>
            <div class="session-code">${data.sessionId}</div>
        `;
    }

    // Poll every 2 seconds
    setInterval(checkLastSession, 2000);
    checkLastSession(); // Initial check
});
