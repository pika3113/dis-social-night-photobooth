const chokidar = require('chokidar');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configuration
const WATCH_FOLDER = process.argv[2] || './captured'; // Folder to watch
const UPLOAD_URL = process.argv[3] || 'http://localhost:3000/api/upload'; // Server URL

// Derive Command URL from Upload URL
const BASE_URL = UPLOAD_URL.replace('/api/upload', '');
const COMMAND_URL = `${BASE_URL}/api/session/command`;

console.log(`
📸 Camera Watcher Started
-----------------------
Watching: ${WATCH_FOLDER}
Uploading to: ${UPLOAD_URL}
Listening for triggers at: ${COMMAND_URL}
-----------------------
Waiting for new photos...
`);

// Ensure watch folder exists
if (!fs.existsSync(WATCH_FOLDER)) {
  fs.mkdirSync(WATCH_FOLDER, { recursive: true });
}

// --- Polling for Remote Trigger ---
setInterval(async () => {
  try {
    const response = await axios.get(COMMAND_URL);
    if (response.data.command === 'capture') {
      console.log('\n📸 Received REMOTE TRIGGER command!');
      triggerCamera();
    }
  } catch (error) {
    // Silent fail on connection errors to avoid spam
  }
}, 1000);

function triggerCamera() {
  console.log('⚡ Triggering Camera...');
  
  // OPTION 1: gphoto2 (Best for Mac/Linux)
  // Requires: brew install gphoto2
  // exec('gphoto2 --capture-image-and-download --filename "' + path.join(WATCH_FOLDER, 'capture-%H%M%S.jpg') + '"', (err, stdout, stderr) => {
  //   if (err) console.error('Trigger failed:', stderr);
  //   else console.log('Trigger success:', stdout);
  // });

  // OPTION 2: Sony Imaging Edge (Mac AppleScript)
  // Requires: Imaging Edge "Remote" app to be open and focused
  /*
  if (process.platform === 'darwin') {
    const script = `
      tell application "Remote" to activate
      tell application "System Events" to keystroke return
    `;
    exec(`osascript -e '${script}'`, (err) => {
      if (err) console.error('AppleScript failed:', err);
    });
  }
  */

  // OPTION 3: Windows PowerShell (Simulate Enter key)
  /*
  if (process.platform === 'win32') {
    // This is tricky and requires a specific window title
    console.log('Windows trigger not implemented yet. Please press the shutter manually.');
  }
  */
 
  console.log('⚠️  No trigger method configured! Edit scripts/camera-watcher.js to enable gphoto2 or keypress simulation.');
}

// Initialize watcher
const watcher = chokidar.watch(WATCH_FOLDER, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  awaitWriteFinish: {
    stabilityThreshold: 2000, // Wait 2s for file to finish writing
    pollInterval: 100
  }
});

watcher
  .on('add', async (filePath) => {
    console.log(`\n🆕 New photo detected: ${path.basename(filePath)}`);
    await uploadPhoto(filePath);
  });

async function uploadPhoto(filePath) {
  try {
    const formData = new FormData();
    formData.append('photos', fs.createReadStream(filePath));

    console.log('🚀 Uploading...');
    
    const response = await axios.post(UPLOAD_URL, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    if (response.data.success) {
      console.log('✅ Upload Successful!');
      console.log(`🔗 URL: ${response.data.downloadUrl}`);
      
      // Handle QR Code
      if (response.data.qrCode) {
        const base64Data = response.data.qrCode.replace(/^data:image\/png;base64,/, "");
        const qrPath = path.join(__dirname, 'latest-qr.png');
        
        fs.writeFileSync(qrPath, base64Data, 'base64');
        console.log(`📱 QR Code saved to: ${qrPath}`);
        
        // Open the QR code automatically
        openFile(qrPath);
      }
    } else {
      console.error('❌ Upload failed:', response.data);
    }

  } catch (error) {
    console.error('❌ Error uploading file:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
  }
}

function openFile(filePath) {
  const platform = process.platform;
  let command = '';

  if (platform === 'win32') {
    command = `start "" "${filePath}"`;
  } else if (platform === 'darwin') {
    command = `open "${filePath}"`;
  } else {
    command = `xdg-open "${filePath}"`;
  }

  exec(command, (err) => {
    if (err) console.error('Failed to open QR code:', err);
  });
}
