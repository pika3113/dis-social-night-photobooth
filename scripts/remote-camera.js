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
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary (Direct Upload)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Use explicit Vercel URL (required for remote camera)
const API_URL = process.env.VERCEL_URL || process.env.API_URL || 'https://dis-social-night-photobooth.vercel.app';
let currentSessionId = null;

console.log(`🎥 Remote Camera Script`);
console.log(`📡 API URL: ${API_URL}`);
console.log(`☁️  Cloudinary: ${process.env.CLOUDINARY_CLOUD_NAME ? 'Configured' : 'Missing Credentials'}`);

// Helper: Send status update to API
async function updateStatus(status, sessionId) {
  try {
    await axios.post(`${API_URL}/api/session/status`, {
      status,
      sessionId
    });
    console.log(`ℹ️  Status updated: ${status}`);
  } catch (err) {
    console.error(`⚠️ Failed to update status: ${err.message}`);
  }
}

// Helper: Execute gphoto2 command (or simulate)
function capturePhoto(simulate = false) {
  return new Promise((resolve, reject) => {
    const filename = path.join('/tmp', `camera-${Date.now()}.jpg`);
    
    if (simulate) {
      // SIMULATION: Copy a test image instead of using camera
      const testImage = path.join(__dirname, '../Testing/Myanmar_Protest.jpg');
      
      if (fs.existsSync(testImage)) {
        fs.copyFileSync(testImage, filename);
        console.log('🤖 [SIMULATION] Copied test image');
        setTimeout(() => resolve(filename), 1000); // Fake delay
      } else {
        // Create minimal JPEG if test image missing
        const minimalJpeg = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=', 'base64');
        fs.writeFileSync(filename, minimalJpeg);
        console.log('🤖 [SIMULATION] Created minimal JPEG');
        setTimeout(() => resolve(filename), 500);
      }
      return;
    }

    // REAL CAMERA
    exec(`gphoto2 --capture-image-and-download --filename ${filename}`, (err, stdout) => {
      if (err) {
        reject(new Error(`Camera capture failed: ${err.message}`));
        return;
      }
      
      if (fs.existsSync(filename)) {
        resolve(filename);
      } else {
        reject(new Error('Photo file not created'));
      }
    });
  });
}

// Upload photo directly to Cloudinary, then notify API
async function uploadPhoto(filePath, sessionId) {
  try {
    console.log('☁️  Uploading directly to Cloudinary...');
    const photoId = `capture_${Date.now()}`;
    
    // 1. Upload to Cloudinary directly
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `dis social night 2025/${sessionId}`,
      public_id: photoId,
      resource_type: 'auto'
    });
    
    console.log(`✅ Cloudinary Upload Success: ${result.secure_url}`);

    // 2. Notify Vercel API with the URL (lightweight request)
    const response = await axios.post(`${API_URL}/api/upload`, {
      sessionId: sessionId,
      cloudinaryUrl: result.secure_url,
      publicId: result.public_id
    });
    
    console.log(`✅ API Notified for session ${sessionId}`);
    fs.unlinkSync(filePath); // Clean up temp file
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
    console.log(`👂 Listening for remote commands... ${simulate ? '(SIMULATION MODE)' : ''}`);
    console.log('   (Press Ctrl+C to stop)');
    
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
            console.log('⚡ Received TRIGGER command!');
            
            // Get current session ID to upload to
            try {
              const sessionRes = await axios.get(`${API_URL}/api/session/current`);
              if (sessionRes.data.active) {
                const sessionId = sessionRes.data.sessionId;
                console.log(`📸 Capturing for session ${sessionId}...`);
                
                // 1. Status: Capturing
                await updateStatus('Capturing', sessionId);

                try {
                  const filePath = await capturePhoto(simulate);
                  console.log(`✅ Captured: ${filePath}`);
                  
                  // 2. Status: Uploading
                  await updateStatus('Uploading', sessionId);
                  
                  await uploadPhoto(filePath, sessionId);
                  
                  // 3. Status: Ready (Done)
                  await updateStatus('Ready', sessionId);
                } catch (err) {
                  console.error('❌ Capture/Upload failed:', err.message);
                  await updateStatus('Error', sessionId);
                }
              } else {
                console.log('⚠️ Trigger received but no active session');
              }
            } catch (err) {
              console.error('❌ Failed to process trigger:', err.message);
            }
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
      console.log(`🎬 Session started: ${currentSessionId}`);
      console.log(`💡 Use: node remote-camera.js capture ${currentSessionId}`);
    } catch (err) {
      console.error(`❌ Failed to start session: ${err.message}`);
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
      console.log('📸 Capturing photo...');
      const filePath = await capturePhoto();
      console.log(`✅ Photo captured: ${filePath}`);
      
      await uploadPhoto(filePath, sessionId);
    } catch (err) {
      console.error(`❌ Error: ${err.message}`);
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
      console.log(`🏁 Session finished: ${sessionId}`);
      console.log(`📊 Photos: ${response.data.photoCount}`);
      console.log(`🔗 Gallery: ${response.data.downloadUrl}`);
    } catch (err) {
      console.error(`❌ Failed to finish session: ${err.message}`);
    }
  }
  else {
    console.log(`
Usage:
  node scripts/remote-camera.js listen [--simulate]    # Listen for web triggers (add --simulate to test without camera)
  node scripts/remote-camera.js start-session          # Start a new session
  node scripts/remote-camera.js capture SESSION_ID     # Capture & upload photo
  node scripts/remote-camera.js finish SESSION_ID      # Finish session & get QR

Example:
  # Run this on the laptop connected to the camera:
  node scripts/remote-camera.js listen
  
  # Test without camera:
  node scripts/remote-camera.js listen --simulate
    `);
  }
}

main();
