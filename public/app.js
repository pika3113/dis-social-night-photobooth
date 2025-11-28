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
        done: document.getElementById('btn-done'),
        cancel: document.getElementById('btn-cancel')
    };

    const sessionGallery = document.getElementById('session-gallery');
    const qrImage = document.getElementById('qr-image');
    const downloadLink = document.getElementById('download-link');
    const statusMessage = document.getElementById('status-message');
    const sessionCodeDisplay = document.getElementById('session-code-display');
    const photoCountBadge = document.getElementById('photo-count');
    const resultSubtitle = document.getElementById('result-subtitle');

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
    if (buttons.cancel) buttons.cancel.addEventListener('click', cancelSession);

    // Event delegation for delete buttons
    if (sessionGallery) {
        sessionGallery.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-btn') || e.target.closest('.delete-btn')) {
                const btn = e.target.classList.contains('delete-btn') ? e.target : e.target.closest('.delete-btn');
                const photoId = btn.dataset.id;
                deletePhoto(photoId);
            }
        });
    }

    // --- Functions ---

    function switchView(viewName) {
        Object.values(views).forEach(el => el.classList.add('hidden'));
        views[viewName].classList.remove('hidden');
    }

    function updateStatus(message, isError = false) {
        statusMessage.innerText = message;
        if (isError) {
            statusMessage.style.background = 'rgba(0, 0, 0, 0.6)';
            statusMessage.style.borderColor = 'rgba(255, 107, 107, 0.9)';
            statusMessage.style.color = '#fff';
            statusMessage.style.textShadow = '0 2px 8px rgba(0, 0, 0, 0.8)';
        } else {
            statusMessage.style.background = 'rgba(0, 0, 0, 0.6)';
            statusMessage.style.borderColor = 'rgba(76, 175, 80, 0.9)';
            statusMessage.style.color = '#fff';
            statusMessage.style.textShadow = '0 2px 8px rgba(0, 0, 0, 0.8)';
        }
    }

    async function triggerDslr() {
        if (!isSessionActive) {
            updateStatus('❌ No active session', true);
            return;
        }

        // Disable button immediately
        buttons.triggerDslr.disabled = true;
        const btnText = document.getElementById('capture-btn-text');
        if (btnText) btnText.textContent = 'Wait...';

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
                        buttons.triggerDslr.disabled = false; // Re-enable on timeout
                        if (btnText) btnText.textContent = 'Capture';
                    }
                }, TRIGGER_TIMEOUT);
            } else {
                updateStatus(`❌ ${data.error || 'Trigger failed'}`, true);
                buttons.triggerDslr.disabled = false; // Re-enable on error
                if (btnText) btnText.textContent = 'Capture';
            }
        } catch (err) {
            console.error('Trigger failed:', err);
            updateStatus('❌ Failed to trigger camera. Check console.', true);
            buttons.triggerDslr.disabled = false; // Re-enable on error
            if (btnText) btnText.textContent = 'Capture';
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
                updateGallery([]);
                
                // Display session code in header
                const activeSessionCode = document.getElementById('active-session-code');
                if (activeSessionCode) {
                    activeSessionCode.textContent = data.sessionId;
                }
                
                switchView('session');
                updateStatus('Ready', false);
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
                    const btnText = document.getElementById('capture-btn-text');
                    
                    if (data.status && data.status !== 'Ready') {
                        if (data.status === 'Capturing') {
                            updateStatus('📸 Camera is capturing...', false);
                            if (btnText) btnText.textContent = 'Snap!';
                        } else if (data.status === 'Uploading') {
                            updateStatus('☁️  Uploading photo...', false);
                            if (btnText) btnText.textContent = 'Saving...';
                        } else {
                            updateStatus(`ℹ️  ${data.status}`, false);
                            if (btnText) btnText.textContent = 'Busy';
                        }
                        // Disable button if busy
                        buttons.triggerDslr.disabled = true;
                    } else {
                        // Enable button if ready
                        buttons.triggerDslr.disabled = false;
                        if (btnText) btnText.textContent = 'Capture';
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
        if (!sessionGallery) return;

        if (photos.length === 0) {
            sessionGallery.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📷</span>
                    <p>No photos yet. Click "Capture Photo" to begin!</p>
                </div>
            `;
            if (photoCountBadge) photoCountBadge.textContent = '0';
        } else {
            sessionGallery.innerHTML = photos.map(photo => `
                <div class="photo-card">
                    <img src="${photo.cloudinaryUrl}" alt="Session Photo" loading="lazy">
                    <button class="delete-btn" data-id="${photo.photoId || photo.cloudinaryPublicId}" title="Delete Photo">×</button>
                </div>
            `).join('');
            
            if (photoCountBadge) photoCountBadge.textContent = photos.length;
            
            // Scroll to bottom
            sessionGallery.scrollTop = sessionGallery.scrollHeight;
        }
    }

    async function deletePhoto(photoId) {
        if (!confirm('Are you sure you want to delete this photo?')) return;

        try {
            updateStatus('🗑️ Deleting photo...', false);
            const res = await fetch('/api/session/photo', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: currentSessionId, photoId })
            });
            const data = await res.json();

            if (data.success) {
                updateStatus('✅ Photo deleted', false);
                
                // Remove from UI immediately
                const btn = document.querySelector(`.delete-btn[data-id="${photoId}"]`);
                if (btn) {
                    const card = btn.closest('.photo-card');
                    if (card) {
                        card.remove();
                        
                        // Update count
                        currentPhotoCount--;
                        if (photoCountBadge) photoCountBadge.textContent = currentPhotoCount;
                        
                        // Check empty state
                        if (currentPhotoCount === 0 && sessionGallery) {
                             sessionGallery.innerHTML = `
                                <div class="empty-state">
                                    <span class="empty-icon">📷</span>
                                    <p>No photos yet. Click "Capture Photo" to begin!</p>
                                </div>
                            `;
                        }
                    }
                }
            } else {
                updateStatus(`❌ ${data.error || 'Delete failed'}`, true);
            }
        } catch (err) {
            console.error('Delete failed:', err);
            updateStatus('❌ Delete failed', true);
        }
    }

    async function cancelSession() {
        if (!confirm('Are you sure you want to cancel this session? All photos will be discarded.')) return;

        stopPolling();
        
        try {
            updateStatus('🚫 Cancelling session...', false);
            await fetch('/api/session/cancel', { method: 'POST' });
            resetToStart();
            updateStatus('Session cancelled', false);
        } catch (err) {
            console.error('Cancel failed:', err);
            resetToStart(); // Reset anyway
        }
    }

    async function finishSession() {
        if (!isSessionActive || currentPhotoCount === 0) {
            updateStatus('❌ Cannot finish: no photos taken', true);
            return;
        }

        stopPolling();
        
        try {
            updateStatus('🔄 Finishing session...', false);
            const res = await fetch('/api/session/finish', { method: 'POST' });
            const data = await res.json();
            
            if (data.success) {
                // Update result subtitle
                if (resultSubtitle) {
                    resultSubtitle.textContent = `${data.photoCount} photo${data.photoCount !== 1 ? 's' : ''} captured!`;
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
        updateGallery([]);
        updateStatus('Ready', false);
        switchView('start');
    }
});
