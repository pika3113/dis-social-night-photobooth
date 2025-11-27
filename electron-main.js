const { app, BrowserWindow } = require('electron');
const path = require('path');

// Set environment variable so server.js knows it's in Electron
process.env.IS_ELECTRON = 'true';
process.env.PORT = 3000;

// Start the Express Server internally
// This runs the server.js code, which starts listening on port 3000
require('./server.js');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Photobooth Pro",
    icon: path.join(__dirname, 'public/favicon.ico'),
    webPreferences: {
      nodeIntegration: false, // Security best practice
      contextIsolation: true
    }
  });

  // Load the local server URL instead of a file
  // This ensures all API routes and paths work exactly like the web version
  mainWindow.loadURL('http://localhost:3000');

  // Optional: Remove menu bar for a cleaner look
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
