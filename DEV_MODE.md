# Dev Mode - Simulated Camera

## Quick Start

Run the photobooth with a simulated camera (no real camera needed):

```bash
DEV_MODE=true npm start
```

Or on Windows:
```bash
set DEV_MODE=true && npm start
```

---

## What It Does

In dev mode:
- ✅ Camera trigger is simulated with fake photos
- ✅ Each click generates a test image
- ✅ Full flow works without real camera
- ✅ Perfect for testing UI/workflows
- ✅ All uploads work normally (goes to Cloudinary)

---

## Testing the Flow

1. **Start dev mode**:
   ```bash
   DEV_MODE=true npm start
   ```

2. **Open browser**:
   ```
   http://localhost:3000
   ```

3. **Test photobooth**:
   - Click "Start Photobooth"
   - Click "📸 Trigger Camera" → Simulated photo appears
   - Click again for more photos
   - Click "Finish" → QR code generated
   - Scan QR to view gallery

4. **Watch logs**:
   ```
   📸 [DEV] Simulated photo saved: simulated-1234567890.jpg
   ```

---

## Features in Dev Mode

### Simulated Photos
- Simple 100x100 pixel blue images
- Filename: `simulated-{timestamp}.jpg`
- Stored in `./captured/` folder

### Real Uploads
- Photos still upload to Cloudinary (if credentials set)
- QR codes still work
- Galleries still generate
- Everything else works normally

### Console Output
```
🎮 [DEV MODE] Using simulated camera
📸 [DEV] Simulated photo saved: simulated-1234567890.jpg
```

---

## Switching Modes

### Development (Simulated):
```bash
DEV_MODE=true npm start
```

### Production (Real Camera):
```bash
npm start
```

### Production on Mac/Linux (gphoto2):
```bash
LOCAL_TRIGGER=true npm start
```

### Production on Windows (CameraControlCmd):
```bash
IS_ELECTRON=true npm start
```

---

## Why Use Dev Mode?

✅ **No camera needed** - Test on any computer
✅ **Fast development** - Instant fake photos
✅ **Repeatable testing** - Same results every time
✅ **No hardware issues** - Focus on logic
✅ **CI/CD ready** - Automated testing possible

---

## Limitations in Dev Mode

- Simulated photos are tiny (100x100 px)
- Not actual camera output
- All simulated photos look the same
- Just for development/testing

---

## Environment Variables

```bash
# Enable dev mode with simulated camera
DEV_MODE=true

# Still needed for uploads
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

---

## Example Workflow

```bash
# Terminal 1: Start server in dev mode
DEV_MODE=true npm start

# Terminal 2: Monitor captured photos
watch -n 1 'ls -la ./captured/'

# Browser: Test full flow
# Click Start → Trigger 3 times → Finish → Scan QR
```

---

## Troubleshooting Dev Mode

### Photos not appearing
- Check console for `[DEV]` messages
- Verify `./captured/` folder exists
- Check file watcher is running

### Upload failing
- Set Cloudinary credentials
- Check internet connection
- Verify API keys are valid

### Need real camera?
```bash
# Switch to production
npm start
```

---

## Next Steps

Once happy with the flow in dev mode:
1. Connect real camera
2. Switch to production mode
3. Test with actual camera
4. Deploy to event venue

---

**Tips**: Use dev mode to test workflows quickly, then switch to production with real camera for actual use!
