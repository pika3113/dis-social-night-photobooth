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

// Use explicit Vercel URL (required for remote camera)
const API_URL = process.env.VERCEL_URL || process.env.API_URL || 'https://dis-social-night-photobooth.vercel.app';
let currentSessionId = null;

console.log(`🎥 Remote Camera Script`);
console.log(`📡 API URL: ${API_URL}`);

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

// Send photo to API
async function uploadPhoto(filePath, sessionId) {
  try {
    const fileStream = fs.createReadStream(filePath);
    const FormData = require('form-data');
    const formData = new FormData();
    
    formData.append('photos', fileStream);
    formData.append('sessionId', sessionId);
    
    const response = await axios.post(`${API_URL}/api/upload`, formData, {
      headers: formData.getHeaders()
    });
    
    console.log(`✅ Photo uploaded to session ${sessionId}`);
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
    
    // Poll for commands every 1 second
    setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/api/session/command`);
        const cmd = res.data.command;
        
        if (cmd === 'trigger') {
          console.log('⚡ Received TRIGGER command!');
          
          // Get current session ID to upload to
          try {
            const sessionRes = await axios.get(`${API_URL}/api/session/current`);
            if (sessionRes.data.active) {
              const sessionId = sessionRes.data.sessionId;
              console.log(`📸 Capturing for session ${sessionId}...`);
              
              const filePath = await capturePhoto(simulate);
              console.log(`✅ Captured: ${filePath}`);
              
              await uploadPhoto(filePath, sessionId);
            } else {
              console.log('⚠️ Trigger received but no active session');
            }
          } catch (err) {
            console.error('❌ Failed to process trigger:', err.message);
          }
        }
      } catch (err) {
        // Ignore network errors during polling to keep running
        if (err.code !== 'ECONNREFUSED') {
          console.error('Polling error:', err.message);
        }
      }
    }, 1000);
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
