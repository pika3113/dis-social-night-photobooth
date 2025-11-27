const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');

// Create a 'captured' folder if it doesn't exist
const WATCH_DIR = path.join(__dirname, '../captured');
if (!fs.existsSync(WATCH_DIR)) {
  fs.mkdirSync(WATCH_DIR, { recursive: true });
}

console.log('📸 Sony a7IV Watcher Test');
console.log('-------------------------');
console.log(`👀 Watching folder: ${WATCH_DIR}`);
console.log('\nINSTRUCTIONS:');
console.log('1. Open "Sony Imaging Edge Desktop" -> "Remote"');
console.log('2. In Remote settings, set "Save Destination" to this folder:');
console.log(`   ${WATCH_DIR}`);
console.log('3. Take a picture using the camera or the Sony app.');
console.log('-------------------------');

// Initialize Watcher
const watcher = chokidar.watch(WATCH_DIR, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true, // Don't report existing files
  awaitWriteFinish: {
    stabilityThreshold: 2000, // Wait 2s for file to finish saving
    pollInterval: 100
  }
});

watcher
  .on('add', filePath => {
    console.log(`\n✅ New photo detected!`);
    console.log(`   File: ${filePath}`);
    console.log(`   Size: ${fs.statSync(filePath).size} bytes`);
    console.log('   (In the real app, this would now be uploaded)');
  })
  .on('error', error => console.error(`❌ Watcher error: ${error}`));
