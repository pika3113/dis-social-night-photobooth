document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const views = {
        start: document.getElementById('view-start'),
        session: document.getElementById('view-session'),
        result: document.getElementById('view-result')
    };
    
    const buttons = {
        start: document.getElementById('btn-start'),
        triggerDslr: document.getElementById('btn-trigger-dslr'),
        finish: document.getElementById('btn-finish'),
        done: document.getElementById('btn-done')
    };

    const sessionGallery = document.getElementById('session-gallery');
    const qrImage = document.getElementById('qr-image');
    const downloadLink = document.getElementById('download-link');
    const statusMessage = document.getElementById('status-message');
    const sessionCodeDisplay = document.getElementById('session-code-display');

    // State
    let pollInterval = null;
    let currentPhotoCount = 0;
    let currentSessionId = null;
    let isSessionActive = false;

    // Configuration
    const POLL_INTERVAL = 1000; // Poll every 1 second (faster updates)
    const POLL_TIMEOUT = 30000; // Stop polling after 30s of no active session
    const TRIGGER_TIMEOUT = 10000; // Reset "Waiting..." message after 10s
    let lastActivityTime = 0;
    let triggerTimeoutId = null;

    // --- Event Listeners ---

    buttons.start.addEventListener('click', startSession);
    buttons.triggerDslr.addEventListener('click', triggerDslr);
    buttons.finish.addEventListener('click', finishSession);
    buttons.done.addEventListener('click', resetToStart);

    // --- Functions ---

    function switchView(viewName) {
        Object.values(views).forEach(el => el.classList.add('hidden'));
        views[viewName].classList.remove('hidden');
    }

    function updateStatus(message, isError = false) {
        statusMessage.innerText = message;
        statusMessage.style.color = isError ? '#ff6b6b' : '#4CAF50';
    }

    async function triggerDslr() {
        if (!isSessionActive) {
            updateStatus('❌ No active session', true);
            return;
        }

        try {
            updateStatus('🔄 Sending trigger signal...', false);
            const res = await fetch('/api/session/trigger', { method: 'POST' });
            const data = await res.json();
            
            if (data.success) {
                updateStatus('📸 Cheese! Waiting for camera...', false);
                
                // Set timeout to reset message if photo doesn't arrive
                if (triggerTimeoutId) clearTimeout(triggerTimeoutId);
                triggerTimeoutId = setTimeout(() => {
                    if (statusMessage.innerText.includes('Waiting for camera')) {
                        updateStatus('⚠️ Photo taking too long. Try again?', true);
                    }
                }, TRIGGER_TIMEOUT);
            } else {
                updateStatus(`❌ ${data.error || 'Trigger failed'}`, true);
            }
        } catch (err) {
            console.error('Trigger failed:', err);
            updateStatus('❌ Failed to trigger camera. Check console.', true);
        }
    }

    async function startSession() {
        try {
            updateStatus('🔄 Starting session...', false);
            const res = await fetch('/api/session/start', { method: 'POST' });
            const data = await res.json();
            
            if (data.success) {
                currentSessionId = data.sessionId;
                isSessionActive = true;
                lastActivityTime = Date.now();
                currentPhotoCount = 0;
                sessionGallery.innerHTML = '';
                switchView('session');
                updateStatus('Ready!', false);
                startPolling();
            } else {
                updateStatus(`❌ ${data.error || 'Could not start session'}`, true);
            }
        } catch (err) {
            console.error('Failed to start session:', err);
            updateStatus('❌ Could not start session. Check console.', true);
        }
    }

    function startPolling() {
        // Clear any existing poll
        if (pollInterval) clearInterval(pollInterval);
        
        pollInterval = setInterval(async () => {
            try {
                // Pass currentSessionId to ensure we track the right session even if server restarts
                const url = currentSessionId 
                    ? `/api/session/current?sessionId=${currentSessionId}`
                    : '/api/session/current';
                    
                const res = await fetch(url);
                const data = await res.json();
                
                if (data.active) {
                    lastActivityTime = Date.now();
                    isSessionActive = true;
                    
                    // Update status message based on remote camera status
                    if (data.status && data.status !== 'Ready') {
                        if (data.status === 'Capturing') {
                            updateStatus('📸 Camera is capturing...', false);
                        } else if (data.status === 'Uploading') {
                            updateStatus('☁️  Uploading photo...', false);
                        } else {
                            updateStatus(`ℹ️  ${data.status}`, false);
                        }
                    }

                    if (data.photos && data.photos.length > currentPhotoCount) {
                        updateGallery(data.photos);
                        currentPhotoCount = data.photos.length;
                        updateStatus(`✅ ${currentPhotoCount} photo${currentPhotoCount !== 1 ? 's' : ''} captured!`, false);
                        
                        // Clear timeout if photo arrived
                        if (triggerTimeoutId) {
                            clearTimeout(triggerTimeoutId);
                            triggerTimeoutId = null;
                        }
                    }
                } else {
                    // Session is no longer active
                    isSessionActive = false;
                    
                    // Check if polling should stop (no activity timeout)
                    if (Date.now() - lastActivityTime > POLL_TIMEOUT) {
                        console.log('⏱️  Polling timeout: session inactive for too long');
                        stopPolling();
                    }
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, POLL_INTERVAL);
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
            console.log('⏹️  Polling stopped');
        }
    }

    function updateGallery(photos) {
        sessionGallery.innerHTML = photos.map(photo => `
            <div class="photo-card">
                <img src="${photo.cloudinaryUrl}" alt="Session Photo" loading="lazy">
            </div>
        `).join('');
        
        // Scroll to bottom
        sessionGallery.scrollTop = sessionGallery.scrollHeight;
    }

    async function finishSession() {
        if (!isSessionActive || currentPhotoCount === 0) {
            updateStatus('❌ Cannot finish: no photos taken', true);
            return;
        }

        stopPolling();
        
        try {
            updateStatus('🔄 Generating QR code...', false);
            const res = await fetch('/api/session/finish', { method: 'POST' });
            const data = await res.json();
            
            if (data.success) {
                qrImage.src = data.qrCode;
                downloadLink.href = data.downloadUrl;
                
                // Display the 4-digit session code
                if (sessionCodeDisplay) {
                    sessionCodeDisplay.innerText = data.sessionId;
                }

                isSessionActive = false;
                switchView('result');
                updateStatus(`🎉 ${data.photoCount} photos ready!`, false);
            } else {
                updateStatus(`❌ ${data.error || 'Error finishing session'}`, true);
            }
        } catch (err) {
            console.error('Failed to finish session:', err);
            updateStatus('❌ Error finishing session. Check console.', true);
        }
    }

    function resetToStart() {
        stopPolling();
        currentSessionId = null;
        isSessionActive = false;
        currentPhotoCount = 0;
        updateStatus('Waiting for photos...', false);
        switchView('start');
    }
});
