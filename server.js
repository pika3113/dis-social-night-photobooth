require('dotenv').config();
const express = require('express');
const multer = require('multer');
const QRCode = require('qrcode');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log(`[DEBUG] Cloudinary config loaded:`);
console.log(`  - cloud_name: ${cloudinary.config().cloud_name ? '✓ SET' : '✗ MISSING'}`);
console.log(`  - api_key: ${cloudinary.config().api_key ? '✓ SET' : '✗ MISSING'}`);
console.log(`  - api_secret: ${cloudinary.config().api_secret ? '✓ SET' : '✗ MISSING'}`);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for memory storage (Vercel-friendly)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// ===== CONFIGURATION =====
const CAPTURED_FOLDER = path.join(__dirname, 'captured');
const CAMERA_TRIGGER_TIMEOUT = 5000; // 5s timeout for camera command
const CAMERA_TRIGGER_RETRIES = 3; // Retry failed triggers 3 times
const SESSION_CLEANUP_INTERVAL = 3600000; // Clean old sessions every 1 hour
const SESSION_EXPIRY_TIME = 86400000; // Keep sessions for 24 hours
const UPLOAD_RETRY_ATTEMPTS = 3; // Retry failed uploads 3 times
const UPLOAD_RETRY_DELAY = 1000; // Wait 1s between retries
const DEV_MODE = process.env.DEV_MODE === 'true' || process.env.DEV_MODE === 'TRUE' || process.env.DEV_MODE === '1'; // Enable simulated camera

console.log(`[DEBUG] DEV_MODE env var: "${process.env.DEV_MODE}"`);
console.log(`[DEBUG] DEV_MODE enabled: ${DEV_MODE}`);

// Ensure captured folder exists (Only if not on Vercel)
if (!process.env.VERCEL && !fs.existsSync(CAPTURED_FOLDER)) {
  try {
    fs.mkdirSync(CAPTURED_FOLDER, { recursive: true });
    console.log(`📁 Created captured folder: ${CAPTURED_FOLDER}`);
  } catch (err) {
    console.warn(`⚠️  Could not create captured folder: ${err.message}`);
  }
}

// Store photo metadata (in production, use a database like MongoDB/PostgreSQL)
const photosDatabase = {};
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');

// Load sessions from disk (Persistence)
if (fs.existsSync(SESSIONS_FILE)) {
  try {
    const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
    const loaded = JSON.parse(data);
    // Restore dates from strings
    for (const key in loaded) {
      if (loaded[key].uploadDate) loaded[key].uploadDate = new Date(loaded[key].uploadDate);
    }
    Object.assign(photosDatabase, loaded);
    console.log(`📂 Loaded ${Object.keys(photosDatabase).length} sessions from disk`);
  } catch (err) {
    console.error('❌ Failed to load sessions:', err);
  }
}

function saveSessions() {
  // Only save in local/dev mode or if explicitly enabled, to avoid Vercel read-only errors
  if (!process.env.VERCEL) {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(photosDatabase, null, 2));
    } catch (err) {
      console.error('❌ Failed to save sessions:', err);
    }
  }
}

let activeSessionId = null; // Global state for the current active session
let commandQueue = []; // Queue for commands to the watcher script
const uploadQueue = []; // Queue for failed uploads (offline resilience)

// Generate random 4-char ID (Alphabets/Numbers, no ambiguous chars)
function generateSessionId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  do {
    result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (photosDatabase[result]); // Ensure uniqueness
  return result;
}

// ===== UTILITY FUNCTIONS =====

// Get local IP address (for QR codes)
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Sleep utility
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry logic wrapper
async function retryAsync(fn, retries = CAMERA_TRIGGER_RETRIES, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`⚠️  Attempt ${i + 1} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
}

// Cleanup old sessions from memory
function cleanupOldSessions() {
  const now = Date.now();
  let deletedCount = 0;
  
  for (const [sessionId, session] of Object.entries(photosDatabase)) {
    if (now - session.uploadDate.getTime() > SESSION_EXPIRY_TIME) {
      delete photosDatabase[sessionId];
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`🧹 Cleaned up ${deletedCount} expired sessions`);
  }
}

// Run cleanup every hour (DISABLED for persistence)
// setInterval(cleanupOldSessions, SESSION_CLEANUP_INTERVAL);

// ===== SIMULATED CAMERA (DEV MODE) =====
function createSimulatedPhoto() {
  // Use the real test image from Testing folder
  const testImagePath = path.join(__dirname, 'Testing', 'Myanmar_Protest.jpg');
  if (fs.existsSync(testImagePath)) {
    return fs.readFileSync(testImagePath);
  }
  
  // Fallback: Create a minimal valid JPEG if test image not found
  const minimalJpeg = Buffer.from(
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=',
    'base64'
  );
  return minimalJpeg;
}

function simulateCameraCapture() {
  try {
    // Skip file write on Vercel (read-only filesystem)
    // The simulated photo buffer will be handled directly in the trigger endpoint
    if (process.env.VERCEL) {
      console.log(`📸 [DEV] Simulated photo ready for upload (Vercel mode)`);
      return;
    }
    
    const filename = path.join(CAPTURED_FOLDER, `simulated-${Date.now()}.jpg`);
    const buffer = createSimulatedPhoto();
    fs.writeFileSync(filename, buffer);
    console.log(`📸 [DEV] Simulated photo saved: ${path.basename(filename)}`);
  } catch (err) {
    console.error(`❌ [DEV] Failed to create simulated photo:`, err.message);
  }
}

// ===== FILE WATCHER FOR PHOTO DETECTION (LOCAL ONLY) =====
let fileWatcher = null;

function initializeFileWatcher() {
  // Skip file watcher on Vercel (no local filesystem access)
  if (process.env.VERCEL) {
    return;
  }
  
  // Only initialize if chokidar is available
  let chokidar;
  try {
    chokidar = require('chokidar');
  } catch (err) {
    console.warn('⚠️  File watcher skipped (chokidar not available)');
    return;
  }
  
  if (fileWatcher) return; // Already watching
  
  fileWatcher = chokidar.watch(CAPTURED_FOLDER, {
    ignored: /(^|[\/\\])\./,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });

  fileWatcher.on('add', async (filePath) => {
    console.log(`🆕 Photo detected: ${path.basename(filePath)}`);
    
    if (!activeSessionId || !photosDatabase[activeSessionId]) {
      console.log('⚠️  No active session, skipping upload');
      return;
    }

    try {
      const buffer = fs.readFileSync(filePath);
      const photoId = `capture_${Date.now()}`;
      
      const uploadResult = await uploadToCloudinaryWithRetry(
        buffer,
        activeSessionId,
        photoId
      );

      if (uploadResult) {
        photosDatabase[activeSessionId].photos.push({
          cloudinaryUrl: uploadResult.secure_url,
          cloudinaryPublicId: uploadResult.public_id,
          photoId: photoId,
          timestamp: Date.now()
        });
        saveSessions(); // Persist
        console.log(`✅ Photo added to session ${activeSessionId}`);
      }
    } catch (err) {
      console.error(`❌ Failed to upload detected photo: ${err.message}`);
      // Queue for retry
      uploadQueue.push({ filePath, sessionId: activeSessionId, attempts: 0 });
    }
  });

  console.log(`👁️  File watcher initialized for ${CAPTURED_FOLDER}`);
}

// ===== CLOUDINARY UPLOAD WITH RETRY =====
async function uploadToCloudinaryWithRetry(buffer, sessionId, photoId, attempt = 1) {
  try {
    const Readable = require('stream').Readable;
    return await new Promise((resolve, reject) => {
      // Create a readable stream from buffer
      const stream = Readable.from(buffer);
      
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `dis social night 2025/${sessionId}`,
          public_id: photoId,
          resource_type: 'auto',
          timeout: CAMERA_TRIGGER_TIMEOUT
        },
        (error, result) => {
          if (error) {
            console.log(`📤 Upload callback error (attempt ${attempt}):`, error.message);
            reject(error);
          } else {
            console.log(`✅ Upload success for ${photoId}:`, result.secure_url);
            resolve(result);
          }
        }
      );
      
      uploadStream.on('error', (err) => {
        console.log(`📤 Upload stream error (attempt ${attempt}):`, err.message);
        reject(err);
      });
      stream.pipe(uploadStream);
    });
  } catch (err) {
    if (attempt < UPLOAD_RETRY_ATTEMPTS) {
      console.log(`⚠️  Upload attempt ${attempt} failed, retrying... (${err.message})`);
      await sleep(UPLOAD_RETRY_DELAY);
      return uploadToCloudinaryWithRetry(buffer, sessionId, photoId, attempt + 1);
    }
    console.log(`❌ Upload failed after ${UPLOAD_RETRY_ATTEMPTS} attempts: ${err.message}`);
    throw err;
  }
}

// ===== PROCESS RETRY QUEUE PERIODICALLY =====
setInterval(async () => {
  while (uploadQueue.length > 0) {
    const { filePath, sessionId, attempts } = uploadQueue.shift();
    
    if (attempts >= UPLOAD_RETRY_ATTEMPTS) {
      console.log(`❌ Gave up on ${filePath} after ${attempts} attempts`);
      continue;
    }

    try {
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const photoId = `retry_${Date.now()}`;
        
        const result = await uploadToCloudinaryWithRetry(buffer, sessionId, photoId);
        console.log(`✅ Retry successful for ${path.basename(filePath)}`);
      }
    } catch (err) {
      console.log(`⚠️  Retry failed, re-queueing...`);
      uploadQueue.push({ filePath, sessionId, attempts: attempts + 1 });
    }
  }
}, 5000); // Retry queue every 5 seconds

// --- Session Management Endpoints ---

// Trigger the camera (Watcher script picks this up OR direct execution)
app.post('/api/session/trigger', async (req, res) => {
  console.log('📸 Trigger requested');

  if (!activeSessionId) {
    return res.status(400).json({ error: 'No active session', success: false });
  }

  let success = false;
  let errorMsg = '';

  // DEV MODE: Use simulated camera
  if (DEV_MODE) {
    console.log('🎮 [DEV MODE] Using simulated camera');
    
    // On Vercel: Upload simulated photo directly (no filesystem write)
    if (process.env.VERCEL) {
      try {
        const buffer = createSimulatedPhoto();
        const photoId = `capture_${Date.now()}`;
        
        const uploadResult = await uploadToCloudinaryWithRetry(
          buffer,
          activeSessionId,
          photoId
        );

        if (uploadResult) {
          photosDatabase[activeSessionId].photos.push({
            cloudinaryUrl: uploadResult.secure_url,
            cloudinaryPublicId: uploadResult.public_id,
            photoId: photoId,
            timestamp: Date.now()
          });
          saveSessions(); // Persist
          console.log(`✅ Photo added to session ${activeSessionId}`);
          success = true;
        }
      } catch (err) {
        console.error(`❌ Failed to upload simulated photo: ${err.message}`);
        errorMsg = err.message;
      }
    } else {
      // Local: Save to filesystem (watcher will detect and upload)
      simulateCameraCapture();
      success = true;
    }
  }
  // PRODUCTION: Direct Execution (If running locally/Electron)
  else if (process.env.IS_ELECTRON || process.env.LOCAL_TRIGGER) {
    console.log('⚡ Executing direct trigger command...');
    
    try {
      await retryAsync(async () => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Camera trigger timeout'));
          }, CAMERA_TRIGGER_TIMEOUT);

          if (process.platform === 'win32') {
            const filename = path.join(CAPTURED_FOLDER, `capture-${Date.now()}.jpg`);
            const cmd = `CameraControlCmd.exe /capture /filename "${filename}"`;
            
            exec(cmd, { timeout: CAMERA_TRIGGER_TIMEOUT }, (err, stdout) => {
              clearTimeout(timeout);
              if (err) reject(err);
              else {
                console.log('✅ Direct trigger success');
                resolve();
              }
            });
          } else {
            // Mac/Linux (gphoto2)
            const filename = path.join(CAPTURED_FOLDER, `capture-${Date.now()}.jpg`);
            const cmd = `gphoto2 --capture-image-and-download --filename "${filename}"`;
            
            exec(cmd, { timeout: CAMERA_TRIGGER_TIMEOUT }, (err, stdout) => {
              clearTimeout(timeout);
              if (err) reject(err);
              else {
                console.log('✅ Direct trigger success');
                resolve();
              }
            });
          }
        });
      });
      success = true;
    } catch (err) {
      console.error('❌ Direct trigger failed:', err);
      errorMsg = 'Camera trigger failed';
    }
  }
  // REMOTE TRIGGER: Queue command for remote camera script
  else {
    console.log('📡 Queuing remote trigger command...');
    commandQueue.push({ type: 'trigger', timestamp: Date.now() });
    success = true;
  }

  if (success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: errorMsg || 'Trigger failed', success: false });
  }
});

// Endpoint for Watcher Script to poll for commands (Long Polling Support)
app.get('/api/session/command', async (req, res) => {
  const waitForCommand = req.query.wait === 'true';
  // Vercel serverless functions have a default 10s timeout on free tier.
  // We'll wait up to 8s to be safe, checking every 200ms.
  const MAX_WAIT_TIME = 8000; 
  const CHECK_INTERVAL = 200;
  const startTime = Date.now();

  const checkQueue = async () => {
    // 1. Check if command exists
    if (commandQueue.length > 0) {
      const cmd = commandQueue.shift(); // Get oldest command
      // Return full command object so we can pass data like sessionId
      return res.json({ command: cmd.type, ...cmd });
    }

    // 2. If long-polling enabled and time remains, wait and retry
    if (waitForCommand && (Date.now() - startTime < MAX_WAIT_TIME)) {
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
      return checkQueue();
    }

    // 3. Timeout or no wait requested
    res.json({ command: null });
  };

  await checkQueue();
});

// Start a new session
app.post('/api/session/start', (req, res) => {
  // FORCE RESET: If a session is already active, discard it
  if (activeSessionId) {
    console.log(`⚠️  Force starting new session. Discarding old session: ${activeSessionId}`);
    
    // Delete the old session from memory (effectively deleting its photos from the app)
    if (photosDatabase[activeSessionId]) {
      const photoCount = photosDatabase[activeSessionId].photos.length;
      console.log(`🗑️  Deleted ${photoCount} photos from discarded session ${activeSessionId}`);
      delete photosDatabase[activeSessionId];
    }
    
    // Clear pending commands to prevent cross-talk
    commandQueue = [];
    activeSessionId = null;
  }

  const newSessionId = generateSessionId();
  activeSessionId = newSessionId;
  
  // Initialize file watcher if not already watching
  initializeFileWatcher();
  
  // Initialize session in database
  photosDatabase[newSessionId] = {
    photos: [],
    isSinglePhoto: false,
    uploadDate: new Date(),
    isActive: true,
    status: 'Ready', // New status field
    createdAt: Date.now()
  };
  
  saveSessions(); // Persist

  console.log(`🎬 Session started: ${newSessionId}`);
  
  // Notify remote camera
  commandQueue.push({ type: 'session_start', sessionId: newSessionId });
  
  res.json({ success: true, sessionId: newSessionId });
});

// Update session status (from remote camera)
app.post('/api/session/status', (req, res) => {
  const { status, sessionId } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required', success: false });
  }

  // RESILIENCE: If session is missing (e.g. server restart), recreate it
  if (!photosDatabase[sessionId]) {
    console.log(`⚠️  Session ${sessionId} not found (server restart?), recreating...`);
    photosDatabase[sessionId] = {
      photos: [],
      isSinglePhoto: false,
      uploadDate: new Date(),
      isActive: true,
      status: status,
      createdAt: Date.now()
    };
    // Restore as active session if none exists
    if (!activeSessionId) {
      activeSessionId = sessionId;
      console.log(`🔄 Restored ${sessionId} as active session`);
    }
  }
  
  photosDatabase[sessionId].status = status;
  saveSessions(); // Persist
  console.log(`ℹ️  Session ${sessionId} status: ${status}`);
  res.json({ success: true });
});

// Get current session status (polling)
app.get('/api/session/current', (req, res) => {
  // Allow client to specify which session they are tracking
  const targetSessionId = req.query.sessionId || activeSessionId;

  if (!targetSessionId || !photosDatabase[targetSessionId]) {
    return res.json({ active: false });
  }

  const session = photosDatabase[targetSessionId];
  res.json({
    active: true,
    sessionId: targetSessionId,
    photoCount: session.photos.length,
    photos: session.photos,
    status: session.status || 'Ready'
  });
});

// Finish current session
app.post('/api/session/finish', async (req, res) => {
  if (!activeSessionId) {
    return res.status(400).json({ error: 'No active session', success: false });
  }

  const sessionId = activeSessionId;
  const session = photosDatabase[sessionId];
  
  // VALIDATION: Prevent finishing with 0 photos
  if (!session.photos || session.photos.length === 0) {
    return res.status(400).json({
      error: 'Cannot finish with 0 photos. Take at least one photo.',
      success: false,
      photoCount: 0
    });
  }

  try {
    // Build URL based on environment
    let baseUrl;
    
    // Option 1: Explicit Public URL (Best for Local Booth + Cloud Gallery)
    if (process.env.PUBLIC_URL) {
      baseUrl = process.env.PUBLIC_URL.replace(/\/$/, ''); // Remove trailing slash
      console.log(`🔗 Using configured PUBLIC_URL: ${baseUrl}`);
    }
    // Option 2: Force Vercel URL (Legacy env var)
    else if (process.env.FORCE_VERCEL_URL === 'true') {
      baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://dis-social-night-photobooth.vercel.app';
    }
    // Option 3: On Vercel: use the Vercel URL directly
    else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    }
    // Option 4: Local: use LAN IP so phones can connect (Fallback)
    else {
      const port = process.env.PORT || 3000;
      const ip = getLocalIp();
      baseUrl = `http://${ip}:${port}`;
      console.log(`🔗 Generated QR code using LAN IP: ${baseUrl}`);
    }
    
    const shortUrl = `${baseUrl}/${sessionId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(shortUrl);

    const photoCount = session.photos.length;

    // Mark as inactive
    session.isActive = false;
    activeSessionId = null;

    // OPTIMIZATION: Clear session data after photos uploaded
    // DISABLED for persistence: User wants to keep history unless manually cleared
    /*
    const clearDelay = DEV_MODE ? 1800000 : 300000; // 30 min vs 5 min
    setTimeout(() => {
      if (photosDatabase[sessionId]) {
        delete photosDatabase[sessionId];
        console.log(`🧹 Cleared session ${sessionId} (photos already in Cloudinary)`);
      }
    }, clearDelay);
    */

    console.log(`🏁 Session finished: ${sessionId} with ${photoCount} photos`);

    // Notify remote camera
    commandQueue.push({ type: 'session_finish', sessionId: sessionId });

    res.json({
      success: true,
      sessionId: sessionId,
      qrCode: qrCodeDataUrl,
      downloadUrl: shortUrl,
      photoCount: photoCount
    });
  } catch (err) {
    console.error('Error finishing session:', err);
    res.status(500).json({ error: 'Failed to finish session', success: false });
  }
});

// Upload multiple photos endpoint (Supports files OR direct URLs)
app.post('/api/upload', upload.array('photos', 20), async (req, res) => {
  try {
    // Handle direct URL upload (from remote camera script)
    if (req.body.cloudinaryUrl && req.body.sessionId) {
      const { sessionId, cloudinaryUrl, publicId } = req.body;
      
      if (!photosDatabase[sessionId]) {
        // Create session if missing (shouldn't happen often)
        photosDatabase[sessionId] = {
          photos: [],
          isSinglePhoto: false,
          uploadDate: new Date(),
          isActive: true,
          createdAt: Date.now()
        };
      }

      const photoId = publicId || `capture_${Date.now()}`;
      
      photosDatabase[sessionId].photos.push({
        cloudinaryUrl: cloudinaryUrl,
        cloudinaryPublicId: publicId,
        photoId: photoId,
        timestamp: Date.now()
      });
      
      saveSessions(); // Persist
      console.log(`✅ Photo URL added to session ${sessionId} (Direct Upload)`);
      return res.json({ success: true, sessionId });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded', success: false });
    }

    // Determine Session ID: Use active session if available, otherwise create new (legacy/drag-drop)
    let sessionId = activeSessionId;
    let isNewSession = false;

    // Allow sessionId override from body
    if (req.body.sessionId) {
      sessionId = req.body.sessionId;
    }

    if (!sessionId) {
      sessionId = generateSessionId();
      isNewSession = true;
    }

    const isSinglePhoto = req.files.length === 1 && isNewSession;
    
    // Upload all files to Cloudinary with retry logic
    const uploadPromises = req.files.map(async (file, index) => {
      const suffix = isNewSession ? (index + 1) : Date.now() + index; 
      const photoId = isSinglePhoto ? sessionId : `${sessionId}_${suffix}`;
      
      try {
        const result = await uploadToCloudinaryWithRetry(
          file.buffer,
          sessionId,
          photoId
        );
        return { photoId, result, success: true };
      } catch (err) {
        console.error(`❌ Failed to upload photo ${photoId}:`, err.message);
        // Queue for retry
        uploadQueue.push({
          buffer: file.buffer,
          sessionId,
          photoId,
          attempts: 0
        });
        return { photoId, result: null, success: false, error: err.message };
      }
    });

    const uploads = await Promise.all(uploadPromises);
    const successfulUploads = uploads.filter(u => u.success);
    const failedCount = uploads.length - successfulUploads.length;

    if (successfulUploads.length > 0) {
      console.log(`✅ Uploaded ${successfulUploads.length}/${uploads.length} photo(s) (Session: ${sessionId})`);
    } else {
      console.error(`❌ All uploads failed, queued for retry`);
      return res.status(500).json({
        error: 'Upload failed, will retry',
        success: false,
        queued: true,
        failedCount
      });
    }

    // Update Database
    if (!photosDatabase[sessionId]) {
      photosDatabase[sessionId] = {
        photos: [],
        isSinglePhoto,
        uploadDate: new Date(),
        isActive: !isNewSession,
        createdAt: Date.now()
      };
    }

    const newPhotos = successfulUploads
      .filter(u => u.result)
      .map(u => ({
        cloudinaryUrl: u.result.secure_url,
        cloudinaryPublicId: u.result.public_id,
        photoId: u.photoId,
        timestamp: Date.now()
      }));

    photosDatabase[sessionId].photos.push(...newPhotos);
    saveSessions(); // Persist

    // Response
    if (isNewSession) {
      // Legacy behavior: Return QR code immediately
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const shortUrl = `${baseUrl}/${sessionId}`;
      const qrCodeDataUrl = await QRCode.toDataURL(shortUrl);
      
      res.json({
        success: true,
        sessionId: sessionId,
        qrCode: qrCodeDataUrl,
        downloadUrl: shortUrl,
        photoCount: successfulUploads.length,
        failedCount: failedCount > 0 ? failedCount : undefined,
        message: failedCount > 0 ? `${failedCount} photos queued for retry` : undefined
      });
    } else {
      // Session behavior: Just confirm upload
      res.json({
        success: true,
        sessionId: sessionId,
        message: 'Added to active session',
        photoCount: photosDatabase[sessionId].photos.length,
        failedCount: failedCount > 0 ? failedCount : undefined
      });
    }

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload photos', success: false });
  }
});

// Get photo info endpoint
app.get('/api/photo/:photoId', async (req, res) => {
  const { photoId } = req.params;
  
  try {
    // Fetch directly from Cloudinary
    const result = await cloudinary.api.resource(`dis social night 2025/${photoId}`);
    
    console.log('📷 Fetched from Cloudinary:', result.secure_url);
    
    res.json({
      photoId: photoId,
      cloudinaryUrl: result.secure_url,
      uploadDate: result.created_at,
      downloadUrl: `${req.protocol}://${req.get('host')}/download/${photoId}`
    });
  } catch (error) {
    console.error('❌ Cloudinary fetch error:', error);
    return res.status(404).json({ error: 'Photo not found' });
  }
});

// Short URL redirect
app.get('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  // Skip if it's a file request
  if (sessionId.includes('.')) {
    return res.status(404).send('Not found');
  }
  
  try {
    // Try memory first
    if (photosDatabase[sessionId]) {
      const session = photosDatabase[sessionId];
      
      // Single photo: redirect directly to image
      if (session.isSinglePhoto) {
        return res.redirect(session.photos[0].cloudinaryUrl);
      }
      
      // Multiple photos: show gallery page
      return res.send(generateGalleryPage(session, sessionId));
    }
    
    // Fallback: try to fetch from Cloudinary
    try {
      const result = await cloudinary.api.resource(`dis social night 2025/${sessionId}/${sessionId}`);
      return res.redirect(result.secure_url);
    } catch {
      // Try as folder
      const folder = await cloudinary.api.resources({
        type: 'upload',
        prefix: `dis social night 2025/${sessionId}/`,
        max_results: 50
      });
      
      if (folder.resources.length === 1) {
        return res.redirect(folder.resources[0].secure_url);
      }
      
      return res.send(generateGalleryPage({ photos: folder.resources }, sessionId));
    }
  } catch (error) {
    console.error('Session not found:', error);
    res.status(404).send('Photos not found');
  }
});

// Generate simple gallery page for multiple photos
function generateGalleryPage(session, sessionId) {
  const photos = session.photos || session;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Photo Gallery</title>
  <style>
    body { 
      margin: 0; 
      padding: 20px; 
      background: #1a1a1a; 
      font-family: Arial, sans-serif;
    }
    .container { 
      max-width: 1200px; 
      margin: 0 auto; 
    }
    h1 { 
      color: white; 
      text-align: center; 
      margin-bottom: 30px; 
    }
    .gallery { 
      display: grid; 
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
      gap: 20px; 
    }
    .photo { 
      position: relative; 
      overflow: hidden; 
      border-radius: 10px; 
      background: #2a2a2a;
    }
    .photo img { 
      width: 100%; 
      height: 100%; 
      object-fit: cover; 
      display: block; 
    }
    .photo a {
      display: block;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📸 Your Photos</h1>
    <div class="gallery">
      ${photos.map((photo) => `
        <div class="photo">
          <a href="${photo.cloudinaryUrl || photo.secure_url}" target="_blank">
            <img src="${photo.cloudinaryUrl || photo.secure_url}" alt="Photo" loading="lazy">
          </a>
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>
  `;
}

// Start server only if not in Vercel
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    const modeStr = DEV_MODE ? '🎮 DEV (Simulated)' : '🎥 PRODUCTION';
    console.log(`
╔═══════════════════════════════════════╗
║  Photobooth Server Running            ║
╠═══════════════════════════════════════╣
║  URL: http://localhost:${PORT}${' '.repeat(19 - PORT.toString().length)}║
║  Mode: ${modeStr}${' '.repeat(28 - modeStr.length)}║
╚═══════════════════════════════════════╝
    `);
  });

  // Graceful shutdown on Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down gracefully...');
    server.close(() => {
      console.log('✅ Server stopped');
      process.exit(0);
    });
  });
}

// Export for Vercel
module.exports = app;
