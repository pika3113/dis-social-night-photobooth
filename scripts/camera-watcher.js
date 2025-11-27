const chokidar = require('chokidar');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configuration
const WATCH_FOLDER = process.argv[2] || './captured'; // Folder to watch
const UPLOAD_URL = process.argv[3] || 'http://localhost:3000/api/upload'; // Server URL

console.log(`
📸 Camera Watcher Started
-----------------------
Watching: ${WATCH_FOLDER}
Uploading to: ${UPLOAD_URL}
-----------------------
Waiting for new photos...
`);

// Ensure watch folder exists
if (!fs.existsSync(WATCH_FOLDER)) {
  fs.mkdirSync(WATCH_FOLDER, { recursive: true });
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
