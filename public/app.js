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
    let isCountingDown = false;
    let isTriggering = false;

    // Configuration
    const POLL_INTERVAL = 200; // Poll every 200ms (very fast updates)
    const POLL_TIMEOUT = 30000; // Stop polling after 30s of no active session
    const TRIGGER_TIMEOUT = 10000; // Reset "Waiting..." message after 10s
    let lastActivityTime = 0;
    let triggerTimeoutId = null;
    let countdownTimeoutId = null; // Track countdown timer

    // --- Event Listeners ---

    if (buttons.start) buttons.start.addEventListener('click', startSession);
    if (buttons.triggerDslr) buttons.triggerDslr.addEventListener('click', triggerDslr);
    if (buttons.finish) buttons.finish.addEventListener('click', finishSession);
    // "Start Next Session" should immediately start a new session, skipping the start screen
    if (buttons.done) buttons.done.addEventListener('click', startSession); 
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

    // Initialize Camera Preview
    async function initCameraPreview() {
        const videoEl = document.getElementById('camera-preview');
        if (!videoEl) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'user', // Prefer front camera
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }, 
                audio: false 
            });
            videoEl.srcObject = stream;
            console.log('📷 Camera preview started');
        } catch (err) {
            console.warn('⚠️ Could not start camera preview:', err);
            // Fallback to gradient background if camera fails
            document.body.style.background = 'linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab)';
            document.body.style.backgroundSize = '400% 400%';
            document.body.style.animation = 'gradientShift 15s ease infinite';
        }
    }

    // Start camera immediately
    initCameraPreview();

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

    function stopCountdown() {
        if (countdownTimeoutId) {
            clearTimeout(countdownTimeoutId);
            countdownTimeoutId = null;
        }
        isCountingDown = false;
        isTriggering = false;
        buttons.triggerDslr.classList.remove('counting-down');
        buttons.triggerDslr.disabled = false;
        const btnText = document.getElementById('capture-btn-text');
        if (btnText) btnText.textContent = 'Capture';
    }

    async function triggerDslr() {
        if (!isSessionActive) {
            updateStatus('❌ No active session', true);
            return;
        }

        // Disable button immediately
        buttons.triggerDslr.disabled = true;
        isCountingDown = true;
        buttons.triggerDslr.classList.add('counting-down'); // Add class for big numbers
        const btnText = document.getElementById('capture-btn-text');
        
        // 3-Second Countdown
        let countdown = 3;
        let triggerSent = false; // Flag to ensure we don't send twice
        
        const runCountdown = () => {
            // Abort if session is no longer active
            if (!isSessionActive) {
                stopCountdown();
                return;
            }

            if (countdown > 0) {
                if (btnText) btnText.textContent = countdown;
                updateStatus(`📸 Smile! ${countdown}...`, false);
                
                // Latency compensation: Trigger 0.5s before the end (when countdown is 1)
                if (countdown === 1) {
                    setTimeout(() => {
                        // Only trigger if we haven't been cancelled
                        if (isSessionActive && isCountingDown) {
                            console.log('Pre-triggering camera (latency compensation)...');
                            performTrigger();
                            triggerSent = true;
                        }
                    }, 600);
                }

                countdown--;
                countdownTimeoutId = setTimeout(runCountdown, 1000);
            } else {
                // Countdown finished
                isCountingDown = false;
                buttons.triggerDslr.classList.remove('counting-down'); // Remove class
                isTriggering = true;
                if (btnText) btnText.textContent = 'Wait...';
                
                // Only trigger if we haven't already (fallback)
                if (!triggerSent) {
                    performTrigger();
                }
            }
        };

        const performTrigger = async () => {
            // Double check session active before triggering
            if (!isSessionActive) {
                stopCountdown();
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
                            buttons.triggerDslr.disabled = false; // Re-enable on timeout
                            isTriggering = false;
                            if (btnText) btnText.textContent = 'Capture';
                        }
                    }, TRIGGER_TIMEOUT);
                } else {
                    updateStatus(`❌ ${data.error || 'Trigger failed'}`, true);
                    buttons.triggerDslr.disabled = false; // Re-enable on error
                    isTriggering = false;
                    if (btnText) btnText.textContent = 'Capture';
                }
            } catch (err) {
                console.error('Trigger failed:', err);
                updateStatus('❌ Failed to trigger camera. Check console.', true);
                buttons.triggerDslr.disabled = false; // Re-enable on error
                isTriggering = false;
                if (btnText) btnText.textContent = 'Capture';
            }
        };

        // Start the countdown
        runCountdown();
    }

    // Check for remote session start
    async function checkForRemoteSession() {
        try {
            const res = await fetch('/api/session/current');
            const data = await res.json();
            
            if (data.active && !isSessionActive) {
                console.log('Remote session detected:', data.sessionId);
                joinSession(data);
            }
        } catch (err) {
            // Silent error
        }
    }

    function joinSession(data) {
        currentSessionId = data.sessionId;
        isSessionActive = true;
        lastActivityTime = Date.now();
        currentPhotoCount = 0;
        
        // Display session code
        const activeSessionCode = document.getElementById('active-session-code');
        if (activeSessionCode) {
            activeSessionCode.textContent = data.sessionId;
        }
        
        switchView('session');
        updateStatus('Ready', false);
        startPolling();
        
        // Initial update
        if (data.photos) {
            updateGallery(data.photos);
            currentPhotoCount = data.photos.length;
            if (photoCountBadge) photoCountBadge.textContent = currentPhotoCount;
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
                    
                    // Check for remote countdown
                    if (data.countdownTarget) {
                        // Calculate remaining time
                        // We want to show 3, 2, 1. 
                        // If remaining is 4 (due to buffer), clamp it to 3.
                        let remaining = Math.ceil((data.countdownTarget - Date.now()) / 1000);
                        
                        if (remaining > 3) remaining = 3; // Clamp to 3 max
                        
                        if (remaining > 0) {
                            showRemoteCountdown(remaining);
                        } else {
                            hideRemoteCountdown();
                        }
                    } else {
                        hideRemoteCountdown();
                    }

                    // Check for new photos FIRST and prioritize enabling button
                    if (data.photos && data.photos.length > currentPhotoCount) {
                        // Show the latest photo briefly
                        const latestPhoto = data.photos[data.photos.length - 1];
                        showLatestPhoto(latestPhoto);
                        
                        updateGallery(data.photos); // Keep this to update count
                        currentPhotoCount = data.photos.length;
                        updateStatus(`✅ ${currentPhotoCount} photo${currentPhotoCount !== 1 ? 's' : ''} captured!`, false);
                        
                        // Clear timeout if photo arrived
                        if (triggerTimeoutId) {
                            clearTimeout(triggerTimeoutId);
                            triggerTimeoutId = null;
                        }
                        
                        // Reset triggering state if we got a photo
                        isTriggering = false;
                        
                        // FORCE ENABLE BUTTON IMMEDIATELY (Priority #1)
                        buttons.triggerDslr.disabled = false;
                        if (btnText) btnText.textContent = 'Capture';
                    }
                    
                    // Only update status/disable button if we didn't just finish a capture
                    // If we just got a photo, we ignore "Uploading" status from server as it might be stale
                    const justGotPhoto = data.photos && data.photos.length > currentPhotoCount;
                    
                    if (!justGotPhoto) {
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
                            // Enable button if ready, but only if we are not locally busy
                            if (!isCountingDown && !isTriggering) {
                                buttons.triggerDslr.disabled = false;
                                if (btnText) btnText.textContent = 'Capture';
                            }
                        }
                    }
                } else {
                    // Session is no longer active
                    if (isSessionActive) {
                        console.log('Session ended remotely');
                        // Handle remote finish (now resets to start screen per request)
                        finishSessionRemotely();
                        return;
                    }
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

    function showLatestPhoto(photo) {
        const container = document.getElementById('latest-photo-container');
        const img = document.getElementById('latest-photo-img');
        
        if (container && img && photo) {
            img.src = photo.cloudinaryUrl;
            container.classList.remove('hidden');
            
            // Hide after 5 seconds (updated from 3s)
            setTimeout(() => {
                container.classList.add('hidden');
            }, 5000);
        }
    }

    function showRemoteCountdown(num) {
        let container = document.getElementById('remote-countdown-overlay');
        if (!container) {
            // Create if missing
            container = document.createElement('div');
            container.id = 'remote-countdown-overlay';
            container.className = 'countdown-overlay';
            document.body.appendChild(container);
        }
        
        // Only update if changed to prevent jitter
        if (container.textContent !== String(num)) {
            container.textContent = num;
            // Reset animation
            container.style.animation = 'none';
            container.offsetHeight; /* trigger reflow */
            container.style.animation = null; 
        }
        container.classList.remove('hidden');
    }

    function hideRemoteCountdown() {
        const container = document.getElementById('remote-countdown-overlay');
        if (container) {
            container.classList.add('hidden');
        }
    }

    function updateGallery(photos) {
        // If we have a new photo (detected by length change in startPolling), show it briefly
        // This function is now mostly for initial load or if we wanted to show a list
        // But per request, we only show the latest one briefly.
        
        // However, updateGallery is called with ALL photos.
        // We only want to trigger the "flash" if it's a NEW photo.
        // The logic in startPolling handles the "new photo" check.
        // So we can just delegate to showLatestPhoto if called from there.
        
        // But wait, updateGallery is also called on joinSession.
        // We probably don't want to flash the last photo on join, only on new capture.
        
        // Let's modify startPolling to call showLatestPhoto directly instead of updateGallery
        // and leave updateGallery for... actually we don't need a gallery anymore.
        
        if (!sessionGallery) return;
        
        // Update count badge
        if (photoCountBadge) photoCountBadge.textContent = photos.length;
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
        stopCountdown(); // Stop any pending countdown
        
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

    async function finishSessionRemotely() {
        console.log('Session finished remotely, resetting to start screen');
        // Per user request: Skip the result screen and go straight back to start
        resetToStart();
    }

    function resetToStart() {
        stopPolling();
        stopCountdown(); // Stop any pending countdown
        currentSessionId = null;
        isSessionActive = false;
        currentPhotoCount = 0;
        updateGallery([]);
        updateStatus('Ready', false);
        switchView('start');
    }

    // Poll for remote session start when idle
    checkForRemoteSession(); // Check immediately on load
    setInterval(() => {
        if (!isSessionActive) {
            checkForRemoteSession();
        }
    }, 1000);
});
