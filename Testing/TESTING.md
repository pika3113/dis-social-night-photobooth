# Testing Guide - Photobooth Edge Cases

## Setup

Before running tests, ensure:

```bash
# Install dependencies
npm install

# Create .env file with Cloudinary credentials
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
IS_ELECTRON=false
LOCAL_TRIGGER=true
PORT=3000
```

---

## Test Suite 1: Camera Trigger Reliability

### Test 1.1: Successful Trigger
**Scenario**: Camera is connected and ready
```bash
# Start server
npm start

# In browser: http://localhost:3000
# 1. Click "Start Photobooth"
# 2. Click "📸 Trigger Camera"

# Expected:
# ✓ Status shows "📸 Cheese! Waiting for camera..."
# ✓ Console shows "⚡ Executing direct trigger command..."
# ✓ Camera shutter fires
```

### Test 1.2: Timeout & Retry
**Scenario**: Camera is disconnected
```bash
# 1. Unplug/disable camera
# 2. Start server and session
# 3. Click "📸 Trigger Camera"

# Expected:
# ✓ First attempt fails
# ✓ Automatic retry 2 more times (see console)
# ✓ Status shows "Camera trigger timeout"
# ✓ No browser hang/freeze
```

### Test 1.3: Recovery After Failure
**Scenario**: Camera was offline, now online
```bash
# 1. Disconnect camera
# 2. Trigger (will fail and retry)
# 3. Reconnect camera
# 4. Click "📸 Trigger Camera" again

# Expected:
# ✓ Trigger now succeeds
# ✓ Photo uploaded successfully
```

---

## Test Suite 2: Photo Detection & Auto-Upload

### Test 2.1: Manual File Drop
**Scenario**: Manually place photo in `captured/` folder
```bash
# 1. Start server
# 2. Click "Start Photobooth"
# 3. Copy a test image to `./captured/test-photo.jpg`

# Expected:
# ✓ Server detects file within 2 seconds
# ✓ Auto-uploads to Cloudinary
# ✓ Photo appears in gallery
# ✓ Console shows "🆕 Photo detected" → "✅ Photo added to session"
```

### Test 2.2: File Still Writing (Partial Upload)
**Scenario**: Large file being written slowly
```bash
# 1. Start server and session
# 2. Use `dd` to copy large file slowly:
#    dd if=/dev/urandom of=./captured/large.jpg bs=1M count=5 &

# Expected:
# ✓ Watcher waits 2 seconds for file to stabilize
# ✓ No partial upload attempts
# ✓ Upload succeeds once file is complete
```

### Test 2.3: Multiple Photos Simultaneously
**Scenario**: Multiple photos appear in folder at once
```bash
# 1. Start server and session
# 2. Copy 5 images to ./captured/ folder rapidly

# Expected:
# ✓ Each photo detected and queued
# ✓ All 5 photos appear in gallery
# ✓ No duplicates or missed photos
```

---

## Test Suite 3: Memory & Session Cleanup

### Test 3.1: Memory Usage Over Time
**Scenario**: Run 50+ sessions and monitor memory
```bash
# Monitor memory before
free -h

# Run sessions in loop:
for i in {1..50}; do
  curl -X POST http://localhost:3000/api/session/start
  curl -X POST http://localhost:3000/api/upload -F "photos=@test.jpg"
  curl -X POST http://localhost:3000/api/session/finish
  sleep 2
done

# Check memory after
free -h

# Expected:
# ✓ Memory usage stable (not growing indefinitely)
# ✓ Sessions cleaned up after 24 hours
```

### Test 3.2: Session Cleanup Verification
**Scenario**: Verify cleanup runs
```bash
# 1. Start server (cleanup runs every 1 hour)
# 2. Watch console for cleanup logs

# Expected:
# ✓ Hourly: "🧹 Cleaned up X expired sessions"
# ✓ Old session data removed from memory
```

---

## Test Suite 4: Session Collision Prevention

### Test 4.1: Double-Click "Start"
**Scenario**: User accidentally clicks "Start" twice
```bash
# 1. Click "Start Photobooth"
# 2. Immediately click "Start Photobooth" again (before session starts)

# Expected:
# ✓ First click: Session starts successfully
# ✓ Second click: Error message "A session is already active"
# ✓ Only one session created
# ✓ HTTP 409 Conflict response
```

### Test 4.2: Session Isolation
**Scenario**: Two sessions started sequentially
```bash
# 1. Start session 1, take photo
# 2. Finish session 1
# 3. Start session 2
# 4. Take photo

# Expected:
# ✓ Session 1 has 1 photo
# ✓ Session 2 has 1 photo (not mixed)
# ✓ QR codes link to correct galleries
```

---

## Test Suite 5: Upload Failure & Retry

### Test 5.1: Cloudinary Unavailable
**Scenario**: Simulate Cloudinary being down
```bash
# 1. Block Cloudinary in firewall/hosts file
# 2. Start session and try to upload photo

# Expected:
# ✓ Upload fails
# ✓ File added to retry queue
# ✓ Frontend shows: "X photos queued for retry"
```

### Test 5.2: Network Interruption Recovery
**Scenario**: Network drops and returns
```bash
# Terminal 1: Start server with upload logging
DEBUG=* npm start

# Terminal 2: Upload photo during network loss
# 1. Start session
# 2. Disable WiFi/internet
# 3. Try to upload
# 4. Re-enable WiFi after 5 seconds

# Expected:
# ✓ Upload queued when network down
# ✓ Automatic retry after network returns
# ✓ Photo successfully uploaded
# ✓ Console shows retry attempts
```

### Test 5.3: Partial Upload Recovery
**Scenario**: Connection drops mid-stream
```bash
# Use proxy to simulate connection drop:
# 1. Set up proxy with timeout (tc/iptables)
# 2. Attempt large file upload
# 3. Kill connection during upload

# Expected:
# ✓ Upload fails
# ✓ Queued for retry
# ✓ No orphaned Cloudinary resources
```

---

## Test Suite 6: Polling Timeout

### Test 6.1: Server Restart During Polling
**Scenario**: Server crashes while frontend polling
```bash
# 1. Start session
# 2. Get to "Say Cheese!" screen (polling active)
# 3. Stop server: Ctrl+C

# Monitor browser
# Expected:
# ✓ Polling continues briefly
# ✓ After 30 seconds: Polling stops
# ✓ No console errors about repeated failed fetches
```

### Test 6.2: Polling Activity Timeout
**Scenario**: Session inactive for 30+ seconds
```bash
# 1. Start session but don't take photos
# 2. Wait 30+ seconds

# Expected:
# ✓ Polling stops automatically
# ✓ Browser console shows: "Polling timeout"
# ✓ CPU/network usage drops
```

---

## Test Suite 7: QR Code URL (Local IP)

### Test 7.1: Local IP Detection
**Scenario**: Verify QR code uses local IP
```bash
# Find local IP:
# Linux/Mac: ifconfig | grep "inet "
# Windows: ipconfig | grep "IPv4"

# 1. Start session
# 2. Open DevTools → Network
# 3. Click "Finish"
# 4. Inspect QR code request

# Expected:
# ✓ QR code contains http://192.168.x.x:3000 (not localhost)
# ✓ Guests on same network can scan and access
```

### Test 7.2: Mobile QR Scanning
**Scenario**: Scan QR from smartphone
```bash
# 1. Start photobooth on desktop/laptop
# 2. Take photo and finish session
# 3. From phone on same network: Scan QR code

# Expected:
# ✓ Phone accesses gallery successfully
# ✓ Gallery shows photos
# ✓ Can view and zoom photos
```

---

## Test Suite 8: Photo Count Validation

### Test 8.1: Finish With Zero Photos
**Scenario**: Click "Finish" without taking any photos
```bash
# 1. Click "Start Photobooth"
# 2. Immediately click "Finish" (no photos)

# Expected:
# ✓ Error message: "Cannot finish with 0 photos"
# ✓ HTTP 400 Bad Request
# ✓ Session remains active
# ✓ Can retry with photos
```

### Test 8.2: Finish With Multiple Photos
**Scenario**: Take multiple photos then finish
```bash
# 1. Start session
# 2. Take 5 photos
# 3. Click "Finish"

# Expected:
# ✓ QR code generated successfully
# ✓ Gallery shows all 5 photos
# ✓ Session status shows "5 photos ready"
```

---

## Test Suite 9: Webcam Integration

### Test 9.1: Webcam Without Active Session
**Scenario**: Click "Webcam" button with no session
```bash
# 1. On start screen, click "Webcam" (if visible)
# Or: Start session, cancel, then click webcam

# Expected:
# ✓ Error: "No active session for webcam capture"
# ✓ Webcam modal doesn't open
```

### Test 9.2: Webcam Photo Upload
**Scenario**: Capture and upload webcam photo
```bash
# 1. Start photobooth session
# 2. Click "Webcam"
# 3. Click "SNAP!" to capture
# 4. Upload begins

# Expected:
# ✓ Status shows "📤 Uploading webcam photo..."
# ✓ Photo appears in gallery
# ✓ Photo linked to active session (not mixed)
# ✓ Can continue with camera trigger or more webcam
```

### Test 9.3: Webcam Cancel
**Scenario**: Open webcam and cancel
```bash
# 1. Start session
# 2. Click "Webcam"
# 3. Click "❌ Cancel"

# Expected:
# ✓ Modal closes
# ✓ Camera stream stops
# ✓ No photos uploaded
# ✓ Session remains active
```

---

## Test Suite 10: Captured Folder Creation

### Test 10.1: First Run
**Scenario**: Start server for first time
```bash
# 1. Delete ./captured folder
# 2. Start server: npm start

# Expected:
# ✓ Console shows: "📁 Created captured folder: ..."
# ✓ Folder exists after startup
# ✓ Camera can write to folder
```

---

## Test Suite 11: Network Resilience

### Test 11.1: Simulate Offline Venue
**Scenario**: No internet connectivity
```bash
# 1. Disable WiFi/internet
# 2. Start server (works locally)
# 3. Start session
# 4. Trigger camera (photo stored locally)
# 5. Enable internet
# 6. Wait 5 seconds

# Expected:
# ✓ Photo captured and stored in ./captured
# ✓ When internet returns, auto-uploaded
# ✓ No photos lost
```

### Test 11.2: Slow Network
**Scenario**: High latency/slow uploads
```bash
# Use network throttling:
# Chrome DevTools → Network tab → Throttle to "Slow 4G"

# 1. Start session
# 2. Upload large photo

# Expected:
# ✓ Upload retries if timeout
# ✓ Eventually succeeds
# ✓ No user-facing errors
```

---

## Test Suite 12: Error Handling & Feedback

### Test 12.1: Status Message Updates
**Scenario**: Monitor all status messages
```bash
# Follow the status message element during full flow:
# 1. Start → "🔄 Starting session..."
# 2. Session active → "Ready! Click trigger or upload photos."
# 3. Take photo → "📸 X photos captured!"
# 4. Finish → "🔄 Generating QR code..."
# 5. Complete → "🎉 X photos ready!"

# Expected:
# ✓ Real-time status updates
# ✓ Colors change (green=success, red=error)
# ✓ All messages helpful and clear
```

### Test 12.2: Console Logging
**Scenario**: Debug logs are comprehensive
```bash
# 1. Open browser console (F12)
# 2. Open server console
# 3. Run full photobooth flow

# Expected:
# ✓ Browser console shows state changes
# ✓ Server console shows detailed operation logs
# ✓ Timestamps on all logs
# ✓ Can trace entire flow
```

---

## Performance Tests

### Load Test: 100 Sessions
```bash
# Load test script
for i in {1..100}; do
  # Start session
  curl -s -X POST http://localhost:3000/api/session/start
  
  # Upload photo
  curl -s -X POST http://localhost:3000/api/upload \
    -F "photos=@test.jpg"
  
  # Finish session
  curl -s -X POST http://localhost:3000/api/session/finish
  
  sleep 1
done

# Monitor:
# - Memory usage (should stabilize)
# - CPU usage (should be reasonable)
# - Response times (should be <500ms)
```

---

## Debugging Tips

### Enable Verbose Logging
```bash
DEBUG=* npm start
```

### Check Upload Queue Status
```bash
# Add to server.js for debugging:
setInterval(() => {
  console.log(`Upload queue backlog: ${uploadQueue.length} items`);
}, 10000);
```

### Monitor File Watcher
```bash
# Check for file watch limits:
cat /proc/sys/fs/inotify/max_user_watches

# Increase if needed:
echo 524288 | sudo tee /proc/sys/fs/inotify/max_user_watches
```

### Network Traffic Analysis
```bash
# Monitor uploads
tcpdump -i any -A 'tcp port 443'

# Monitor local connections
netstat -an | grep 3000
```

---

## Known Limitations

1. **Single Camera Only**: Only one active session at a time (can run multiple instances)
2. **In-Memory DB**: Sessions lost on server restart (add persistent DB for production)
3. **Local IP Detection**: May fail behind NAT/corporate firewalls
4. **File Watcher**: Requires OS file system watcher support (all modern systems have this)

---

## Test Results Template

Use this to document test results:

```
Test Suite: [Suite Name]
Test Case: [Test Name]
Date: [Date]
Environment: [Windows/Mac/Linux, Node v, etc]

Steps:
1. [Step 1]
2. [Step 2]

Expected Result:
- [ ] Expectation 1
- [ ] Expectation 2

Actual Result:
[Describe what actually happened]

Status: [PASS/FAIL]
Notes: [Any issues or observations]
```

---

## Continuous Integration

To automate testing, add to `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
```

