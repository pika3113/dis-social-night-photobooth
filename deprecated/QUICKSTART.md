# Quick Reference Guide

## 🚀 Startup Commands

```bash
# Development (with hot reload)
npm run dev

# Production
npm start

# With file watcher (camera auto-detect)
npm start &
npm run watcher

# Electron desktop app
npm run electron
```

---

## 🔧 Configuration

### Environment Variables
```bash
# .env file
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
PORT=3000
NODE_ENV=development
IS_ELECTRON=false
LOCAL_TRIGGER=true
DEBUG=false
```

### Tuning Parameters (in server.js)
```javascript
CAMERA_TRIGGER_TIMEOUT = 5000        // Max wait for camera
CAMERA_TRIGGER_RETRIES = 3           // Retry attempts
SESSION_EXPIRY_TIME = 86400000        // 24 hours
SESSION_CLEANUP_INTERVAL = 3600000    // 1 hour
UPLOAD_RETRY_ATTEMPTS = 3
UPLOAD_RETRY_DELAY = 1000             // 1 second
```

---

## 📝 Common Tasks

### Test Full Flow
1. Go to `http://localhost:3000`
2. Click "Start Photobooth"
3. Click "📸 Trigger Camera"
4. Wait for photo
5. Click "📸 Trigger Camera" again (take 2+ photos)
6. Click "Finish"
7. Scan QR code from phone

### Debug Issues
```bash
# Verbose logging
DEBUG=* npm start

# Monitor memory
watch -n 2 'free -h'

# Check logs
tail -f logs/photobooth-*.log
```

### Monitor System
```bash
# Health check
curl http://localhost:3000/health

# Session info
curl http://localhost:3000/api/session/current

# View captured photos
ls -la ./captured/
```

---

## 🎯 Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/session/start` | Start new session |
| GET | `/api/session/current` | Check session status |
| POST | `/api/session/finish` | End session, get QR |
| POST | `/api/session/trigger` | Trigger camera |
| POST | `/api/upload` | Upload photos manually |
| GET | `/:sessionId` | View gallery |

---

## 🐛 Troubleshooting

### Issue: "No active session"
**Solution**: 
- Start session first (click "Start Photobooth")
- Don't close browser tab
- Check console for errors

### Issue: Camera not triggering
**Solution**:
- Verify camera connected: `ls /dev/video*` (Linux)
- Check folder exists: `ls ./captured/`
- Review console logs for specific error

### Issue: QR code inaccessible
**Solution**:
- Find local IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
- Test: `http://192.168.x.x:3000/sessionId`
- Ensure phone on same WiFi

### Issue: Memory keeps growing
**Solution**:
- Check cleanup running: `tail -f logs/*.log | grep "Cleaned up"`
- Restart server if needed
- Consider adding persistent DB

---

## 📊 Monitoring Checklist

**Every Hour**
- [ ] Check cleanup log: `grep "Cleaned up" logs/*`
- [ ] Monitor memory: `free -h`
- [ ] Verify polling active in browser console

**Every Day**
- [ ] Check for errors: `grep "ERROR\|❌" logs/*`
- [ ] Review upload queue backlog
- [ ] Test full photo booth flow
- [ ] Check disk space: `df -h`

**Weekly**
- [ ] Review log file sizes
- [ ] Test camera connection
- [ ] Verify network connectivity
- [ ] Check Cloudinary quota

---

## 🚨 Emergency Procedures

### Server Hanging
```bash
# Kill process
pkill -f "node server.js"

# Restart
npm start
```

### Out of Memory
```bash
# Force cleanup immediately
# Add to server.js and restart:
await cleanupOldSessions();

# Or lower expiry time:
SESSION_EXPIRY_TIME = 3600000  // 1 hour
```

### Photos Lost in Queue
```bash
# Check queue status
curl http://localhost:3000/api/session/current

# Force retry (waits 5 seconds anyway)
# Or restart server:
npm restart
```

---

## 📱 Mobile Access

### Share Gallery QR Code
1. Finish session → QR code appears
2. Guest scans with phone
3. Automatic redirect to gallery
4. Photos display and can be downloaded

### IP Address for Manual URL
```bash
# Get your local IP
hostname -I                    # Linux
ipconfig getifaddr en0        # Mac
ipconfig                       # Windows (find IPv4)

# Manual URL format
http://192.168.1.100:3000/sessionId
```

---

## 📝 Logging

### Log Levels
```
ERROR   - Red    - Critical failures
WARN    - Yellow - Important warnings
INFO    - Cyan   - General information
SUCCESS - Green  - Successful operations
DEBUG   - Purple - Detailed debugging (when DEBUG=true)
```

### Log Location
```
logs/photobooth-YYYY-MM-DD.log
```

### Enable Debug Logging
```bash
DEBUG=* npm start
```

---

## 🔄 Backup & Restore

### Backup Session Data (Before Restart)
```bash
# Dump in-memory sessions
curl http://localhost:3000/api/session/current > session-backup.json

# Or just capture folder
cp -r ./captured ./captured-backup-$(date +%s)
```

### Restore After Restart
```bash
# Sessions auto-recreate on next startup
# Photos stay in ./captured folder
# Manual restore not needed for production use
```

---

## 📈 Performance Tips

### For High-Volume Events (100+ photos/hour)
1. Reduce polling: `POLL_INTERVAL = 1000` (1s)
2. Lower cleanup interval: `SESSION_CLEANUP_INTERVAL = 600000` (10 min)
3. Enable compression: `npm install compression`
4. Use SSD for better I/O

### For Slow Networks
1. Increase retry delay: `UPLOAD_RETRY_DELAY = 2000`
2. Lower file size limit: Check multer config
3. Enable caching: Use CloudFront
4. Test with `throttle: 'Slow 4G'` in DevTools

---

## 🔐 Security

### Before Production Deployment
- [ ] Set strong Cloudinary credentials
- [ ] Enable HTTPS/SSL
- [ ] Add rate limiting
- [ ] Validate file types
- [ ] Set CORS origin restriction
- [ ] Disable public file listing
- [ ] Regular backups
- [ ] Monitor access logs

### CORS Configuration
```javascript
const cors = require('cors');
app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true
}));
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Overview & setup |
| `FIXES.md` | Detailed fix documentation |
| `TESTING.md` | Comprehensive test guide |
| `ARCHITECTURE.md` | System design |
| `README_CAMERA.md` | Camera setup |
| `README_WINDOWS.md` | Windows guide |
| `IMPLEMENTATION_SUMMARY.md` | What was fixed |

---

## 🆘 Getting Help

### Common Resources
1. Check `TESTING.md` for your specific issue
2. Enable debug logging: `DEBUG=* npm start`
3. Review logs in `./logs` folder
4. Check browser console (F12)

### Specific Issues
| Issue | File |
|-------|------|
| Camera won't trigger | `README_CAMERA.md` |
| Windows setup | `README_WINDOWS.md` |
| Upload failing | `FIXES.md` → Gap #5 |
| QR not working | `FIXES.md` → Gap #7 |
| Memory issues | `FIXES.md` → Gap #3 |

---

## ⚡ Pro Tips

1. **Always check logs**: `tail -f logs/*` while testing
2. **Use DevTools**: Network tab for upload debugging
3. **Test on real device**: QR code scanning on actual phone
4. **Monitor memory**: Watch `free -h` during event
5. **Have backup camera**: USB webcam as fallback
6. **Test night before**: Full flow test 24 hours ahead
7. **Keep power stable**: UPS for server if possible

---

## 📞 When All Else Fails

```bash
# Kill everything
pkill -f "node"
pkill -f "electron"

# Clear temp files
rm -rf ./captured/*
rm -rf ./logs/*

# Fresh start
npm install
npm start
```

---

**Last Updated**: November 27, 2025
**Version**: 2.0.0
