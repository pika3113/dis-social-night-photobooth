#!/usr/bin/env node
/**
 * Remote Camera Trigger Script
 * Runs locally with camera, sends photos directly to Vercel API
 */

require('dotenv').config();
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cloudinary = require('cloudinary').v2;
const chokidar = require('chokidar');
const EventEmitter = require('events');

// Event emitter for watcher
const cameraEvents = new EventEmitter();

// Watcher Configuration
const WATCH_DIR = path.join(__dirname, '../captured');
if (!fs.existsSync(WATCH_DIR)) {
  fs.mkdirSync(WATCH_DIR, { recursive: true });
}

// Initialize Watcher
const watcher = chokidar.watch(WATCH_DIR, {
  ignored: /(^|[\/\\])\../,
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 100, // Reduced to 100ms for instant detection
    pollInterval: 100
  }
});

watcher.on('add', filePath => {
  // Ignore files in subdirectories (already processed/moved)
  const relativePath = path.relative(WATCH_DIR, filePath);
  if (path.dirname(relativePath) !== '.') return;

  console.log(`New photo detected: ${filePath}`);
  cameraEvents.emit('photo', filePath);
});

// console.log(`Watching for photos in: ${WATCH_DIR}`);

// Configure Cloudinary (Direct Upload)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Use localhost by default for local setup
const API_URL = process.env.API_URL || 'http://localhost:3000';
let currentSessionId = null;

console.log(`Remote Camera Script`);
// console.log(`API URL: ${API_URL}`);
// console.log(`Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : 'Missing Credentials'}`);

// Helper: Send status update to API
async function updateStatus(status, sessionId) {
  try {
    await axios.post(`${API_URL}/api/session/status`, {
      status,
      sessionId
    });
    console.log(`Status updated: ${status}`);
  } catch (err) {
    console.error(`Failed to update status: ${err.message}`);
  }
}

// Helper: Execute gphoto2 command (or simulate)
function capturePhoto(simulate = false) {
  return new Promise((resolve, reject) => {
    // SIMULATION
    if (simulate) {
      const filename = path.join(os.tmpdir(), `camera-${Date.now()}.jpg`);
      const testImage = path.join(__dirname, '../Testing/Myanmar_Protest.jpg');
      
      if (fs.existsSync(testImage)) {
        fs.copyFileSync(testImage, filename);
        console.log('[SIMULATION] Copied test image');
        setTimeout(() => resolve(filename), 1000);
      } else {
        const minimalJpeg = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=', 'base64');
        fs.writeFileSync(filename, minimalJpeg);
        console.log('[SIMULATION] Created minimal JPEG');
        setTimeout(() => resolve(filename), 500);
      }
      return;
    }

    // REAL CAMERA (Watcher + Trigger Automation)
    console.log('Triggering camera');
    
    // 1. Set up a one-time listener for the next photo
    let photoDetected = false;
    
    const photoListener = (filePath) => {
      photoDetected = true;
      resolve(filePath);
    };
    
    cameraEvents.once('photo', photoListener);

    // 2. Trigger the camera via PowerShell (Automate Sony Remote App)
    const psScript = path.join(__dirname, 'trigger-sony.ps1');
    const cmd = `powershell -ExecutionPolicy Bypass -File "${psScript}"`;
    
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error(`⚠️ Trigger script error: ${err.message}`);
        console.error(`   (Make sure Sony Imaging Edge 'Remote' window is open)`);
        // Don't reject immediately, maybe the user presses the button manually?
        // But if the script fails, we should probably warn.
      } else {
        console.log(stdout.trim());
      }
    });

    // 3. Set a timeout (e.g., 10 seconds)
    setTimeout(() => {
      if (!photoDetected) {
        cameraEvents.removeListener('photo', photoListener);
        reject(new Error('Timeout: No photo detected after 10 seconds.'));
      }
    }, 10000);
  });
}

// Upload photo directly to Cloudinary, then notify API
async function uploadPhoto(filePath, sessionId) {
  try {
    console.log('Uploading directly to Cloudinary...');
    const photoId = `capture_${Date.now()}`;
    
    // 1. Upload to Cloudinary directly
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `dis social night 2025/${sessionId}`,
      public_id: photoId,
      resource_type: 'auto'
    });
    
    console.log(`Cloudinary Upload Success: ${result.secure_url}`);

    // 2. Notify Vercel API with the URL (lightweight request)
    const response = await axios.post(`${API_URL}/api/upload`, {
      sessionId: sessionId,
      cloudinaryUrl: result.secure_url,
      publicId: result.public_id
    });
    
    console.log(`API Notified for session ${sessionId}`);
    
    // Move file to session folder instead of deleting
    const sessionDir = path.join(path.dirname(filePath), sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    const newPath = path.join(sessionDir, path.basename(filePath));
    
    try {
      fs.renameSync(filePath, newPath);
      console.log(`Photo moved to ${sessionId}/${path.basename(filePath)}`);
    } catch (err) {
      console.error(`Failed to move photo: ${err.message}`);
      // If move fails, try to delete to avoid reprocessing? 
      // But we want to keep it. 
      // Since we ignore subdirs now, leaving it in root would cause it to be detected again if we restart?
      // Actually, if we leave it in root, the watcher (which ignores subdirs) WILL see it.
      // But we only emit 'photo' on 'add'. Existing files on startup are ignored by ignoreInitial: true.
    }

    return response.data;
  } catch (err) {
    console.error(`❌ Upload failed: ${err.message}`);
    throw err;
  }
}

// Main CLI
async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === 'listen') {
    const simulate = args.includes('--simulate');
    console.log(`Listening for remote commands... ${simulate ? '(SIMULATION MODE)' : ''}`);
    console.log('(Press Ctrl+C to stop)');
    
    // Long Polling Loop
    const pollLoop = async () => {
      while (true) {
        try {
          // Request with wait=true (Long Polling)
          // Set axios timeout slightly longer than server timeout (10s vs 8s)
          const res = await axios.get(`${API_URL}/api/session/command?wait=true`, { 
            timeout: 15000 
          });
          
          const cmd = res.data.command;
          
          if (cmd === 'trigger') {
            console.log('Received trigger command');
            
            // Get current session ID to upload to
            try {
              const sessionRes = await axios.get(`${API_URL}/api/session/current`);
              if (sessionRes.data.active) {
                const sessionId = sessionRes.data.sessionId;
                console.log(`Capturing for session ${sessionId}...`);
                
                // 1. Status: Capturing
                await updateStatus('Capturing', sessionId);

                try {
                  const filePath = await capturePhoto(simulate);
                  console.log(`Captured: ${filePath}`);
                  
                  // 2. Status: Ready (Immediately allow next photo)
                  await updateStatus('Ready', sessionId);
                  
                  // Upload in background
                  (async () => {
                    try {
                      // Check if running locally (localhost, 127.0.0.1, or local LAN IP)
                      const localIps = Object.values(os.networkInterfaces())
                        .flat()
                        .filter(i => i.family === 'IPv4')
                        .map(i => i.address);
                      
                      const isLocal = API_URL.includes('localhost') || 
                                      API_URL.includes('127.0.0.1') || 
                                      localIps.some(ip => API_URL.includes(ip));

                      if (isLocal) {
                        console.log('🏠 Local server detected: Skipping remote upload (Server watcher will handle it)');
                      } else {
                        await uploadPhoto(filePath, sessionId);
                      }
                    } catch (e) {
                      console.error("Background upload failed", e);
                    }
                  })();

                } catch (err) {
                  console.error('Capture failed:', err.message);
                  await updateStatus('Error', sessionId);
                }
              } else {
                console.log('Trigger received but no active session');
              }
            } catch (err) {
              console.error('Failed to process trigger:', err.message);
            }
          }
          else if (cmd === 'session_start') {
            console.log(`\n NEW SESSION STARTED: ${res.data.sessionId}`);
            console.log('Waiting for trigger...');
          }
          else if (cmd === 'session_finish') {
            console.log(`\nSESSION FINISHED: ${res.data.sessionId}`);
            console.log('   Returning to idle mode...');
          }
        } catch (err) {
          // Ignore network errors/timeouts and retry
          if (err.code !== 'ECONNREFUSED' && err.code !== 'ECONNABORTED') {
            console.error('Polling error:', err.message);
          }
          // Small delay before retry on error to prevent spamming
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    };

    // Start the loop
    pollLoop();
  }
  else if (args[0] === 'start-session') {
    // Start a new session
    try {
      const response = await axios.post(`${API_URL}/api/session/start`, {
        participants: 1
      });
      currentSessionId = response.data.sessionId;
      console.log(`Session started: ${currentSessionId}`);
      console.log(`Use: node remote-camera.js capture ${currentSessionId}`);
    } catch (err) {
      console.error(`Failed to start session: ${err.message}`);
    }
  } 
  else if (args[0] === 'capture') {
    // Capture and upload a photo
    const sessionId = args[1] || currentSessionId;
    
    if (!sessionId) {
      console.error('❌ No session ID provided. Use: node remote-camera.js capture SESSION_ID');
      process.exit(1);
    }
    
    try {
      console.log('Capturing photo...');
      const filePath = await capturePhoto();
      console.log(`Photo captured: ${filePath}`);
      
      await uploadPhoto(filePath, sessionId);
    } catch (err) {
      console.error(`Error: ${err.message}`);
    }
  }
  else if (args[0] === 'finish') {
    // Finish session and get QR code
    const sessionId = args[1] || currentSessionId;
    
    if (!sessionId) {
      console.error('❌ No session ID provided. Use: node remote-camera.js finish SESSION_ID');
      process.exit(1);
    }
    
    try {
      const response = await axios.post(`${API_URL}/api/session/finish`, {
        sessionId: sessionId
      });
      console.log(`Session finished: ${sessionId}`);
      console.log(`Photos: ${response.data.photoCount}`);
      console.log(`Gallery: ${response.data.downloadUrl}`);
    } catch (err) {
      console.error(`Failed to finish session: ${err.message}`);
    }
  }
  else {
    console.log(`
Usage:
  node scripts/remote-camera.js listen
    `);
  }
}

main();
