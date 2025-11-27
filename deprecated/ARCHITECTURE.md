# Photobooth Application - Updated Architecture

This document outlines the improvements made to the photobooth application to fix critical gaps and edge cases.

## Quick Start

### Installation
```bash
npm install
```

### Configuration
Create a `.env` file:
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
PORT=3000
NODE_ENV=development
IS_ELECTRON=false
LOCAL_TRIGGER=true
DEBUG=false
```

### Running

**Development (with auto-reload)**
```bash
npm run dev
```

**Production**
```bash
npm start
```

**With Watcher Script** (for headless camera)
```bash
npm start &
npm run watcher
```

**Electron Desktop App**
```bash
npm run electron
```

---

## Architecture Overview

### New Features

```
┌─────────────────────────────────────────────────────────┐
│                     Photobooth Server                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Session Management (No Collisions)            │   │
│  │  - Prevents double-start                       │   │
│  │  - Auto-cleanup after 24 hours                 │   │
│  │  - Photo count validation                      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Camera Trigger with Retry Logic               │   │
│  │  - 3 automatic retries                         │   │
│  │  - 5-second timeout                            │   │
│  │  - Direct execution + watcher fallback         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  File Watcher for Auto-Upload                  │   │
│  │  - Detects new photos in captured/             │   │
│  │  - Auto-uploads to Cloudinary                  │   │
│  │  - 2-second stabilization threshold            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Upload Resilience                              │   │
│  │  - 3 retry attempts per upload                 │   │
│  │  - 5-second background retry queue             │   │
│  │  - Network failure graceful handling           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  QR Code with Local IP Detection               │   │
│  │  - Auto-detects IPv4 address                   │   │
│  │  - Mobile-scannable from local network         │   │
│  │  - Fallback to localhost if needed             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   Frontend (Browser)                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Smart Polling                                  │   │
│  │  - Real-time photo detection (2s interval)    │   │
│  │  - Auto-stop after 30s inactivity             │   │
│  │  - Session state validation                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Webcam Integration (Session-Aware)            │   │
│  │  - Requires active session                     │   │
│  │  - Same upload path as camera                 │   │
│  │  - Cancel/retry capability                    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Real-Time Status Feedback                     │   │
│  │  - Operation state messages                    │   │
│  │  - Error notifications                        │   │
│  │  - Color-coded feedback (green/red)           │   │
│  └─────────────────────────────────────────────────┘   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Configuration Constants

Edit these in `server.js` to tune behavior:

| Constant | Default | Purpose |
|----------|---------|---------|
| `CAMERA_TRIGGER_TIMEOUT` | 5000ms | Max wait for camera command |
| `CAMERA_TRIGGER_RETRIES` | 3 | Retry attempts on failure |
| `SESSION_CLEANUP_INTERVAL` | 1 hour | How often to cleanup old sessions |
| `SESSION_EXPIRY_TIME` | 24 hours | How long to keep session data (fallback) |
| `UPLOAD_RETRY_ATTEMPTS` | 3 | Max upload retry attempts |
| `UPLOAD_RETRY_DELAY` | 1000ms | Delay between retry attempts |
| `QR_CLEANUP_DELAY` | 5 minutes | Time before clearing session after QR generated |

---

## API Changes

### `/api/session/trigger` (Enhanced)

**Request**
```http
POST /api/session/trigger
Content-Type: application/json
```

**Response (Success)**
```json
{
  "success": true,
  "message": "📸 Cheese! Waiting for camera..."
}
```

**Response (Error)**
```json
{
  "success": false,
  "error": "No active session",
  "message": "Start a session before triggering camera"
}
```

**Improvements**
- Returns error if no active session
- Includes retry feedback
- 5-second timeout protection
- Automatic 3x retry

---

### `/api/session/start` (Collision-Safe)

**Request**
```http
POST /api/session/start
Content-Type: application/json
```

**Response (Success)**
```json
{
  "success": true,
  "sessionId": "a1b2"
}
```

**Response (Collision)**
```json
{
  "success": false,
  "error": "A session is already active",
  "activeSessionId": "a1b2",
  "statusCode": 409
}
```

**Improvements**
- Guards against double-click
- Returns HTTP 409 on collision
- Initializes file watcher

---

### `/api/session/finish` (Validated)

**Request**
```http
POST /api/session/finish
Content-Type: application/json
```

**Response (Success)**
```json
{
  "success": true,
  "sessionId": "a1b2",
  "qrCode": "data:image/png;base64,...",
  "downloadUrl": "http://192.168.1.100:3000/a1b2",
  "photoCount": 5
}
```

**Response (No Photos)**
```json
{
  "success": false,
  "error": "Cannot finish with 0 photos. Take at least one photo.",
  "photoCount": 0,
  "statusCode": 400
}
```

**Improvements**
- Validates photo count (minimum 1)
- Auto-detects local IP for QR code
- Mobile-friendly URL in QR
- Returns photo count

---

### `/api/upload` (Resilient)

**Request**
```http
POST /api/upload
Content-Type: multipart/form-data

photos: [file1, file2, ...]
```

**Response (Partial Success)**
```json
{
  "success": true,
  "sessionId": "a1b2",
  "photoCount": 4,
  "failedCount": 1,
  "message": "1 photos queued for retry"
}
```

**Improvements**
- Handles partial upload failures
- Queues failed uploads for retry
- Reports success even with failures
- Automatically retries every 5 seconds

---

## Data Structures

### Session Object
```javascript
{
  sessionId: "a1b2",
  photos: [
    {
      cloudinaryUrl: "https://res.cloudinary.com/...",
      cloudinaryPublicId: "dis social night 2025/a1b2/capture_1234567890",
      photoId: "capture_1234567890",
      timestamp: 1234567890000
    }
  ],
  isSinglePhoto: false,
  uploadDate: Date,
  isActive: true,
  createdAt: 1234567890000
}
```

### Upload Queue Item
```javascript
{
  buffer: Buffer,           // File buffer
  sessionId: "a1b2",
  photoId: "capture_123",
  attempts: 0               // Retry counter
}
```

---

## File Structure

```
dis-social-night-photobooth/
├── server.js              # Main Express server (UPDATED)
├── public/
│   ├── app.js             # Frontend logic (UPDATED)
│   ├── index.html
│   └── styles.css
├── api/
│   └── index.js           # Vercel serverless export
├── utils/
│   └── logger.js          # NEW: Enhanced logging
├── captured/              # Camera output folder (auto-created)
├── logs/                  # Log files (auto-created)
├── scripts/
│   └── camera-watcher.js  # Daemon for headless trigger
├── FIXES.md               # NEW: Detailed fix documentation
├── TESTING.md             # NEW: Comprehensive test guide
├── package.json
└── .env                   # Configuration (create this)
```

---

## Migration Guide

### From Previous Version

If upgrading from the original photobooth:

1. **Backup your data**
   ```bash
   cp -r photosDatabase.* backup/
   ```

2. **Update dependencies**
   ```bash
   npm install
   npm audit fix
   ```

3. **Create `.env` file** (required now)
   ```bash
   cp .env.example .env
   # Edit with your Cloudinary credentials
   ```

4. **Clear old sessions** (in-memory db is fresh)
   ```bash
   # Sessions from previous version won't carry over
   # This is fine - they'll be re-created as needed
   ```

5. **Test thoroughly**
   - See `TESTING.md` for comprehensive test cases
   - Run full session flow before production use

### Breaking Changes

- **`/api/session/trigger`** now returns error if no active session
- **`/api/session/finish`** now validates minimum 1 photo
- **`/api/session/start`** returns 409 on collision
- **`/api/upload`** may report partial failures
- **QR codes now use local IP** (not localhost)

### Backwards Compatible

These endpoints work the same as before:
- `GET /api/session/current`
- `GET /api/photo/:photoId`
- `GET /:sessionId` (gallery redirect)

---

## Monitoring & Health Checks

### Health Check Endpoint (Recommended Addition)

```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    sessions: Object.keys(photosDatabase).length,
    uploadQueueLength: uploadQueue.length,
    memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
  });
});
```

Use in production:
```bash
# Monitor every 30 seconds
watch -n 30 'curl -s http://localhost:3000/health | jq .'
```

---

## Troubleshooting

### "No active session"
- Ensure session started before triggering
- Check browser console for errors
- Verify polling is active

### "Camera trigger failed"
- Check camera is connected and powered on
- Verify OS-specific trigger method:
  - Windows: `CameraControlCmd.exe` installed
  - Mac/Linux: `gphoto2` installed
- Check file permissions for `./captured` folder

### "Upload stuck in queue"
- Check Cloudinary credentials
- Verify internet connectivity
- Check for quota exceeded
- Review logs in `./logs` folder

### "QR code inaccessible from phone"
- Verify phone on same WiFi network
- Check firewall rules (port 3000 accessible)
- Use local IP instead of localhost:
  ```bash
  ipconfig getifaddr en0  # Mac
  hostname -I            # Linux
  ipconfig                # Windows (find IPv4)
  ```

### "Memory keeps growing"
- Verify cleanup interval is working (check logs hourly)
- Restart server if needed
- Consider adding persistent database for long-running events

---

## Performance Tuning

### For High-Volume Events (100+ sessions/hour)

1. **Reduce polling interval** (more real-time)
   ```javascript
   const POLL_INTERVAL = 1000; // 1 second instead of 2
   ```

2. **Lower session expiry** (free up memory faster)
   ```javascript
   const SESSION_EXPIRY_TIME = 3600000; // 1 hour instead of 24
   ```

3. **Increase cleanup frequency**
   ```javascript
   const SESSION_CLEANUP_INTERVAL = 600000; // 10 min instead of 1 hour
   ```

4. **Use persistent database** (recommended)
   - Switch to MongoDB/PostgreSQL
   - Move photo metadata to DB instead of memory

5. **Enable compression**
   ```javascript
   const compression = require('compression');
   app.use(compression());
   ```

---

## Security Considerations

1. **API Rate Limiting** (recommended)
   ```bash
   npm install express-rate-limit
   ```
   ```javascript
   const rateLimit = require('express-rate-limit');
   app.use(limiter);
   ```

2. **CORS Configuration**
   - Currently open to all origins
   - Restrict in production: `cors({ origin: 'yourdomain.com' })`

3. **Input Validation**
   - File size limit: 10MB (configurable)
   - File type validation: images only
   - Session ID format validation

4. **Secrets Management**
   - Never commit `.env` to Git
   - Use different keys per environment
   - Rotate Cloudinary credentials periodically

---

## Deployment

### Heroku
```bash
heroku create photobooth-app
heroku config:set CLOUDINARY_CLOUD_NAME=...
git push heroku main
```

### Vercel (Serverless)
```bash
vercel --prod
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### AWS EC2
```bash
# On Ubuntu/Amazon Linux:
sudo apt update && sudo apt install nodejs npm
git clone <repo>
cd dis-social-night-photobooth
npm install
npm start
```

---

## Support & Documentation

- **Bug Reports**: Open GitHub issue
- **Feature Requests**: Discuss in issues
- **Detailed Fixes**: See `FIXES.md`
- **Testing Guide**: See `TESTING.md`
- **Camera Setup**: See `README_CAMERA.md`
- **Windows Guide**: See `README_WINDOWS.md`

---

## Version History

### v2.0.0 (Current) - Production Ready
- ✅ Camera trigger retry logic
- ✅ Photo auto-detection with file watcher
- ✅ Session memory cleanup
- ✅ Session collision prevention
- ✅ Upload failure handling with retry queue
- ✅ Polling timeout protection
- ✅ Local IP QR codes
- ✅ Photo count validation
- ✅ Webcam session integration
- ✅ Network resilience
- ✅ Enhanced error handling

### v1.0.0 (Legacy)
- Basic photobooth functionality
- Manual file upload
- QR code generation

---

## Contributing

Improvements welcome! Please:
1. Create a branch for your feature
2. Add tests (see `TESTING.md`)
3. Submit PR with description
4. Wait for review

---

## License

[Add your license here]

---

**Last Updated**: November 27, 2025
**Status**: Production Ready ✅
