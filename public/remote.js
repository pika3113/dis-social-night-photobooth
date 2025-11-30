document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const views = {
        idle: document.getElementById('view-idle'),
        active: document.getElementById('view-active')
    };
    
    const buttons = {
        start: document.getElementById('btn-start'),
        trigger: document.getElementById('btn-trigger'),
        finish: document.getElementById('btn-finish')
    };

    const statusMessage = document.getElementById('status-message');
    const sessionIdDisplay = document.getElementById('session-id-display');
    const btnText = document.getElementById('capture-btn-text');

    // State
    let pollInterval = null;
    let isSessionActive = false;
    let currentSessionId = null;
    let isCountingDown = false;
    let isTriggering = false;
    let countdownTimeoutId = null;
    let triggerTimeoutId = null;
    let currentPhotoCount = 0;

    // Config
    const POLL_INTERVAL = 200; // Fast polling
    const TRIGGER_TIMEOUT = 10000;

    // --- Event Listeners ---
    buttons.start.addEventListener('click', startSession);
    buttons.trigger.addEventListener('click', triggerCamera);
    buttons.finish.addEventListener('click', finishSession);

    // --- Functions ---

    function updateStatus(msg) {
        statusMessage.textContent = msg;
    }

    function switchView(view) {
        Object.values(views).forEach(el => el.classList.add('hidden'));
        views[view].classList.remove('hidden');
    }

    async function startSession() {
        try {
            updateStatus('Starting...');
            const res = await fetch('/api/session/start', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                // Polling will pick up the new session
            }
        } catch (err) {
            console.error(err);
            updateStatus('Failed to start');
        }
    }

    async function finishSession() {
        if (currentPhotoCount > 0) {
            if (!confirm('Finish session?')) return;
            try {
                updateStatus('Finishing...');
                await fetch('/api/session/finish', { method: 'POST' });
                // Polling will detect end
            } catch (err) {
                console.error(err);
            }
        } else {
            if (!confirm('Cancel session?')) return;
            try {
                updateStatus('Cancelling...');
                await fetch('/api/session/cancel', { method: 'POST' });
                // Polling will detect end
            } catch (err) {
                console.error(err);
            }
        }
    }

    function updateFinishButton() {
        if (currentPhotoCount > 0) {
            buttons.finish.textContent = 'Finish Session';
            buttons.finish.style.borderColor = ''; // Reset
            buttons.finish.style.color = '';
        } else {
            buttons.finish.textContent = 'Cancel Session';
            buttons.finish.style.borderColor = 'rgba(255, 107, 107, 0.8)'; // Reddish
            buttons.finish.style.color = 'rgba(255, 107, 107, 1)';
        }
    }

    function stopCountdown() {
        if (countdownTimeoutId) clearTimeout(countdownTimeoutId);
        isCountingDown = false;
        isTriggering = false;
        buttons.trigger.classList.remove('counting-down');
        buttons.trigger.disabled = false;
        buttons.finish.disabled = false; // Re-enable finish
        if (btnText) btnText.textContent = 'Capture';
    }

    async function triggerCamera() {
        if (!isSessionActive) return;

        // Disable button
        buttons.trigger.disabled = true;
        buttons.finish.disabled = true; // Disable finish during capture
        // isCountingDown = true; // No local countdown
        // buttons.trigger.classList.add('counting-down'); // No visual change on button
        
        // Notify server of countdown start (sync with main display)
        // Server will calculate the target time based on its own clock
        try {
            updateStatus('Look at the screen!');
            if (btnText) btnText.textContent = 'Smile!';
            
            await fetch('/api/session/countdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    sessionId: currentSessionId
                })
            });
            
            // We don't need to count down locally anymore, the server handles the trigger
            // Just wait for the photo to arrive via polling
            isTriggering = true;
            
        } catch (e) { 
            console.error('Failed to sync countdown', e);
            updateStatus('Error starting countdown');
            buttons.trigger.disabled = false;
            buttons.finish.disabled = false; // Re-enable finish on error
            // isCountingDown = false;
            // buttons.trigger.classList.remove('counting-down');
            if (btnText) btnText.textContent = 'Capture';
        }
    }

    // Removed local countdown logic as server handles it now
    /*
    const runCountdown = () => { ... }
    const performTrigger = async () => { ... }
    */

    // Polling Loop
    setInterval(async () => {
        try {
            const res = await fetch('/api/session/current');
            const data = await res.json();

            if (data.active) {
                if (!isSessionActive) {
                    // Session just started or we just joined
                    isSessionActive = true;
                    currentSessionId = data.sessionId;
                    sessionIdDisplay.textContent = `Session: ${data.sessionId}`;
                    switchView('active');
                    updateStatus('Ready');
                }

                // Update photo count and button state
                if (data.photos) {
                    const newCount = data.photos.length;
                    
                    // Check for new photos
                    if (newCount > currentPhotoCount) {
                        currentPhotoCount = newCount;
                        updateStatus(`${currentPhotoCount} Captured!`);
                        
                        // Reset trigger state immediately
                        if (triggerTimeoutId) clearTimeout(triggerTimeoutId);
                        isTriggering = false;
                        buttons.trigger.disabled = false;
                        buttons.finish.disabled = false; // Re-enable finish
                        if (btnText) btnText.textContent = 'Capture';
                    } else {
                        currentPhotoCount = newCount;
                    }
                    updateFinishButton();
                }

                // Unlock if server says Ready (even if photo hasn't arrived yet)
                // But ONLY if we are not currently in a countdown
                const isServerCountingDown = data.countdownTarget && (data.countdownTarget > Date.now());
                
                // Aggressive unlock: If status is Ready OR we've been triggering for > 5s
                // Also unlock if status is 'Uploading' - we don't need to wait for upload to finish!
                if (((data.status === 'Ready' || data.status === 'Uploading') && !isServerCountingDown) || (isTriggering && Date.now() - (triggerTimeoutId ? 0 : Date.now()) > 5000)) {
                    if (isTriggering) {
                        isTriggering = false;
                        buttons.trigger.disabled = false;
                        buttons.finish.disabled = false;
                        if (btnText) btnText.textContent = 'Capture';
                        updateStatus('Ready for next');
                    }
                }

                // Update status if not locally busy
                if (!isCountingDown && !isTriggering) {
                    // Only update text if we are not in the middle of our own countdown
                    // And if the server status is interesting
                    if (data.status === 'Capturing') {
                        // updateStatus('Camera capturing...');
                    } else if (data.status === 'Uploading') {
                        // Don't show uploading status, just show Ready so user knows they can click
                        updateStatus('Ready for next');
                    } else {
                        // updateStatus('Ready');
                    }
                }

            } else {
                if (isSessionActive) {
                    // Session ended
                    isSessionActive = false;
                    currentSessionId = null;
                    currentPhotoCount = 0;
                    sessionIdDisplay.textContent = '';
                    switchView('idle');
                    updateStatus('No active session');
                    stopCountdown();
                } else {
                    // Still idle
                    switchView('idle');
                    updateStatus('Ready to start');
                }
            }
        } catch (err) {
            console.error('Poll error', err);
        }
    }, POLL_INTERVAL);

});
